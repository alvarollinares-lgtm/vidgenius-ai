import { Controller, Post, Body, Headers, Request, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Controller('stripe')
export class StripeController {
  private stripe: any;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY', ''), {
      apiVersion: '2024-04-10' as any,
    });
  }

  // 1. Endpoint para crear la sesión de pago
  @Post('create-checkout-session')
  async createCheckoutSession(@Body() body: { priceId: string, userId: number }) {
    let credits = '0';
    // ⚠️ REEMPLAZA ESTOS price_... POR TUS IDs REALES DE STRIPE ⚠️
    if (body.priceId === 'price_1TWYMaCnf4RT3hroVfPJUa8h') {
      credits = '10';
    } else if (body.priceId === 'price_1TWYNYCnf4RT3hrohPURiMBB') {
      credits = '50';
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: body.priceId, // ej: 'price_1P...' (ID del producto en Stripe)
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${this.configService.get('FRONTEND_URL', 'http://localhost:5173')}/studio?payment=success`,
      cancel_url: `${this.configService.get('FRONTEND_URL', 'http://localhost:5173')}/studio?payment=cancelled`,
      // ¡Magia! Guardamos el ID del usuario y los créditos en texto
      metadata: {
        userId: body.userId.toString(),
        credits: credits,
      },
    });

    return { url: session.url };
  }

  // 2. Endpoint para recibir la notificación de Stripe (Webhook)
  @Post('webhook')
  async handleWebhook(@Headers('stripe-signature') signature: string, @Request() req:any, @Res() res: Response) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');
    let event: any;

    try {
      // Usamos el "rawBody" para verificar la firma de Stripe
      event = this.stripe.webhooks.constructEvent((req as any).rawBody, signature, webhookSecret);
    } catch (err:any) {
      console.log(`Webhook signature verification failed.`, err.message);
      return res.sendStatus(400);
    }

    // Escuchamos el evento de pago completado
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = parseInt(session.metadata.userId, 10);
      const creditsToAdd = parseInt(session.metadata.credits || '0', 10);
      
      if (creditsToAdd > 0) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: creditsToAdd } },
        });
        console.log(`Usuario ${userId} ha comprado ${creditsToAdd} créditos.`);
      }
    }

    res.sendStatus(200);
  }
}
