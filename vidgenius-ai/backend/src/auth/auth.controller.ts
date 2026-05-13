import { Controller, Post, Body, Get, UseGuards, Request, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './register-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService
  ) {}

  @Post('register')
  async register(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.register(registerUserDto);
  }

  @Post('login')
  login(@Body() body: any) {
    return this.authService.login(body);
  }

  // --- RUTA PROTEGIDA DE PRUEBA ---
  @UseGuards(AuthGuard('jwt'))
  @Get('perfil')
  getProfile(@Request() req: any) {
    return { message: '¡Pase VIP aceptado!', user: req.user };
  }

  // Endpoint para obtener los datos del usuario (Nombre, Créditos, Webhook, etc.)
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Request() req: any) {
    return this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        credits: true,
        n8nWebhookUrl: true,
      }
    });
  }

  // Endpoint para que el cliente guarde su propio webhook de n8n
  @UseGuards(AuthGuard('jwt'))
  @Post('webhook')
  async updateWebhook(@Request() req: any, @Body('webhookUrl') webhookUrl: string) {
    return this.prisma.user.update({
      where: { id: req.user.userId },
      data: { n8nWebhookUrl: webhookUrl },
    });
  }

  // Endpoint oculto para Administradores: Añadir créditos manualmente a clientes
  @UseGuards(AuthGuard('jwt'))
  @Post('admin/add-credits')
  async addCredits(@Request() req: any, @Body() body: { targetEmail: string, amount: number }) {
    // 1. Verificar que quien hace la petición es el Administrador
    const adminUser = await this.prisma.user.findUnique({ where: { id: req.user.userId } });
    
    // ⚠️ REEMPLAZA ESTO POR TU EMAIL REAL ⚠️
    if (!adminUser || adminUser.email !== 'allinare@hotmail.com') {
      throw new UnauthorizedException('No tienes permisos de administrador.');
    }

    try {
      // 2. Buscar al usuario cliente por email y sumarle los créditos
      return await this.prisma.user.update({
        where: { email: body.targetEmail },
        data: { credits: { increment: Number(body.amount) } },
      });
    } catch (error) {
      throw new NotFoundException('No se encontró ningún usuario con ese email.');
    }
  }
}
