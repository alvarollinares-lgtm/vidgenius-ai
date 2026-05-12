import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async register(data: any) {
    }

    const { password, ...result } = user;
    const payload = { sub: user.id, email: user.email };

    return {
      message: 'Login exitoso',
      user: result,
      token: this.jwtService.sign(payload)
    };
  }
}
