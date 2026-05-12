import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { VideoRenderService } from './video-render.service';
import { AiController } from './ai.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [AiController],
  providers: [AiService, VideoRenderService],
  imports: [PrismaModule, ConfigModule],
})
export class AiModule {}
