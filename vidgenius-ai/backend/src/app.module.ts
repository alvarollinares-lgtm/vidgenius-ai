import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [PrismaModule, AuthModule, AiModule], // <-- ¡Aquí debe estar AiModule!
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
