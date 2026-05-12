import { Controller, Post, Body, UseGuards, Request, Get, Res, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from './ai.service';
import { CreateVideoDto } from './create-video.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('generate-script')
  @UseInterceptors(FileInterceptor('customVideo'))
  async generateScript(
    @Body() createVideoDto: CreateVideoDto, 
    @Request() req: any,
    @UploadedFile() customVideo?: any
  ) {
    const userId = req.user.userId; // Obtenemos el ID del usuario del token JWT
    return this.aiService.generateScript(createVideoDto.topic, userId, createVideoDto.model, createVideoDto.videoModel, createVideoDto.orientation, customVideo);
  }

  // Nueva ruta para buscar tendencias virales en internet
  @UseGuards(AuthGuard('jwt'))
  @Get('suggest-topics')
  async suggestTopics(@Query('model') model?: string) {
    return this.aiService.suggestTopics(model);
  }

  // Nueva ruta para obtener los vídeos guardados
  @UseGuards(AuthGuard('jwt'))
  @Get('my-videos')
  async getMyVideos(@Request() req: any) {
    return this.aiService.getUserVideos(req.user.userId);
  }

  // Nueva ruta para enviar vídeos a n8n
  @UseGuards(AuthGuard('jwt'))
  @Post('publish-video')
  async publishVideo(
    @Body('videoId') videoId: number, 
    @Body('platforms') platforms: string[],
    @Request() req: any
  ) {
    return this.aiService.publishVideo(videoId, req.user.userId, platforms);
  }

  // Nueva ruta para convertir Texto a Audio (TTS)
  @UseGuards(AuthGuard('jwt'))
  @Post('generate-audio')
  async generateAudio(@Body('script') script: string, @Body('voiceId') voiceId: string, @Res() res: Response) {
    const audioBuffer = await this.aiService.generateAudio(script, voiceId);
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString(),
    });
    res.end(audioBuffer);
  }

  // Nueva ruta para renderizar y descargar el vídeo final
  @UseGuards(AuthGuard('jwt'))
  @Post('merge-video')
  async mergeVideo(
    @Body('videoId') videoId: number,
    @Body('videoUrl') videoUrl: string, 
    @Body('script') script: string, 
    @Body('voiceId') voiceId: string, 
    @Res() res: Response
  ) {
    const videoBuffer = await this.aiService.mergeAudioVideo(videoId, videoUrl, script, voiceId);
    
    res.set({
      'Content-Type': 'video/mp4',
      'Content-Length': videoBuffer.length.toString(),
      'Content-Disposition': 'attachment; filename="VidGenius_Final.mp4"',
    });
    res.end(videoBuffer);
  }
}
