import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './register-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
