import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require('fluent-ffmpeg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
ffmpeg.setFfprobePath(ffprobeInstaller.path);

@Injectable()
export class VideoRenderService {
  private readonly logger = new Logger(VideoRenderService.name);

  async render(
    videoBuffer: Buffer,
    audioBuffer: Buffer,
    cleanScript: string,
    orientation: '16:9' | '9:16' = '16:9'
  ): Promise<Buffer> {
    this.logger.log('Descargando música de fondo...');
    const bgMusicUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'; // Canción libre de derechos
    const bgMusicResponse = await fetch(bgMusicUrl);
    const bgMusicBuffer = Buffer.from(await bgMusicResponse.arrayBuffer());

    const words = cleanScript.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    
    for (let i = 0; i < words.length; i++) {
      currentChunk.push(words[i]);
      if (currentChunk.length >= 2 || i === words.length - 1) { // Bloques de 2 palabras (Ritmo Viral TikTok)
        chunks.push(currentChunk.join(' '));
        currentChunk = [];
      }
    }

    const subtitleFilters: string[] = [];
    let currentTime = 0;
    
    // Ajustes equilibrados para subtítulos virales
    const fontSize = orientation === '9:16' ? 55 : 40; // Tamaño reducido para no tapar el vídeo
    const yPos = orientation === '9:16' ? 'h-text_h-250' : 'h-text_h-50'; // Situados en el tercio inferior (lejos del centro)

    chunks.forEach((chunk) => {
      const duration = chunk.split(' ').length * 0.38; // 0.38 seg por palabra
      const startTime = currentTime;
      const endTime = currentTime + duration;
      // Limpiamos caracteres problemáticos y ponemos TODO EN MAYÚSCULAS (estilo viral)
      const safeText = chunk.replace(/['"%,:;\\]/g, '').trim().toUpperCase();

      if (safeText) {
        // Subtítulos tipo "Hormozi": AMARILLOS, borde grueso negro, con sombra pronunciada
        subtitleFilters.push(`drawtext=fontfile=/System/Library/Fonts/Helvetica.ttc:text='${safeText}':fontcolor=yellow:fontsize=${fontSize}:borderw=6:bordercolor=black:shadowcolor=black@0.9:shadowx=4:shadowy=4:x=(w-text_w)/2:y=${yPos}:enable=between(t\\,${startTime.toFixed(2)}\\,${endTime.toFixed(2)})`);
      }
      currentTime = endTime;
    });

    const tempDir = os.tmpdir(); // Usamos la carpeta de temporales segura de Mac
    const timestamp = Date.now();
    const videoPath = path.join(tempDir, `video_${timestamp}.mp4`);
    const audioPath = path.join(tempDir, `audio_${timestamp}.mp3`);
    const bgMusicPath = path.join(tempDir, `bgmusic_${timestamp}.mp3`);
    const mixedAudioPath = path.join(tempDir, `mixed_${timestamp}.mp3`);
    const outputPath = path.join(tempDir, `output_${timestamp}.mp4`);

    // Usamos fs.promises para operaciones asíncronas y no bloqueantes
    await fs.promises.writeFile(videoPath, videoBuffer);
    await fs.promises.writeFile(audioPath, audioBuffer);
    await fs.promises.writeFile(bgMusicPath, bgMusicBuffer);

    this.logger.log('Mezclando voz y música de fondo...');
    await new Promise((resolveMix, rejectMix) => {
      let mixLogs = '';
      ffmpeg()
        .input(audioPath)
        .input(bgMusicPath)
        // Eliminamos el bucle infinito de la música porque la pista dura 6 minutos. 
        // Esto evita que el filtro amix se cuelgue.
        .complexFilter([
          '[0:a]volume=1.5[voice];[1:a]volume=0.03[bg];[voice][bg]amix=inputs=2:duration=first[aout]'
        ])
        .outputOptions(['-map', '[aout]', '-c:a', 'libmp3lame', '-shortest'])
        .save(mixedAudioPath)
        .on('start', (cmd: string) => this.logger.log('Comando Mix: ' + cmd))
        .on('stderr', (l: string) => { mixLogs += l + '\n'; })
        .on('end', () => resolveMix(true))
        .on('error', (err: any) => { this.logger.error('Error FFmpeg Mix:', mixLogs); rejectMix(err); });
    }).catch(async (err) => {
      await Promise.all([
        fs.promises.unlink(videoPath).catch(() => {}),
        fs.promises.unlink(audioPath).catch(() => {}),
        fs.promises.unlink(bgMusicPath).catch(() => {}),
        fs.promises.unlink(mixedAudioPath).catch(() => {}),
      ]);
      throw new InternalServerErrorException('Error al mezclar los audios: ' + err.message);
    });

    this.logger.log('Calculando duraciones para recorte aleatorio...');
    const getDuration = (file: string): Promise<number> => new Promise((res) => ffmpeg.ffprobe(file, (err: any, data: any) => res(err ? 0 : data.format.duration)));
    const videoDuration = await getDuration(videoPath);
    const audioDuration = await getDuration(mixedAudioPath);
    
    let randomStartTime = 0;
    if (videoDuration > audioDuration + 5 && audioDuration > 0) {
      randomStartTime = Math.floor(Math.random() * (videoDuration - audioDuration - 2));
      this.logger.log(`🎬 Vídeo largo detectado (${Math.round(videoDuration)}s). Cortando aleatoriamente desde el segundo ${randomStartTime}`);
    }

    const videoInputOptions = ['-stream_loop', '-1'];
    if (randomStartTime > 0) {
      videoInputOptions.unshift('-ss', randomStartTime.toString());
    }

    return new Promise<Buffer>((resolve, reject) => {
      this.logger.log('Iniciando proceso FFmpeg para unir vídeo, audios y subtítulos...');
      let ffmpegLogs = '';

      ffmpeg()
        .inputOptions(videoInputOptions)
        .input(videoPath)
        .input(mixedAudioPath)
        .videoFilters([
          'format=yuv420p',
          ...(orientation === '9:16' ? ['crop=ih*9/16:ih'] : []),
          ...subtitleFilters
        ])
        .outputOptions([
          '-map', '0:v:0', // Coge SÓLO la imagen del primer archivo (Pexels)
          '-map', '1:a:0', // Coge SÓLO el sonido del segundo archivo (Nuestra mezcla)
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-c:a', 'aac',
          '-shortest', // Terminar cuando el stream más corto acabe
          '-fflags', '+shortest', // Soluciona el bug de renderizado infinito de FFmpeg
          '-max_interleave_delta', '100M' // Mantiene sincronizados los buffers
        ])
        .on('start', (commandLine: string) => {
          this.logger.log('Ejecutando FFmpeg: ' + commandLine);
        })
        .on('stderr', (line: string) => {
          ffmpegLogs += line + '\n';
        })
        .save(outputPath)
        .on('end', async () => {
          this.logger.log('¡Vídeo final creado con éxito!');
          try {
            const finalBuffer = await fs.promises.readFile(outputPath);
            resolve(finalBuffer);
          } catch (readError) {
            reject(readError);
          } finally {
            await Promise.all([
              fs.promises.unlink(videoPath).catch(e => this.logger.warn(`Error limpiando: ${e.message}`)),
              fs.promises.unlink(audioPath).catch(e => this.logger.warn(`Error limpiando: ${e.message}`)),
              fs.promises.unlink(bgMusicPath).catch(e => this.logger.warn(`Error limpiando: ${e.message}`)),
              fs.promises.unlink(mixedAudioPath).catch(e => this.logger.warn(`Error limpiando: ${e.message}`)),
              fs.promises.unlink(outputPath).catch(e => this.logger.warn(`Error limpiando: ${e.message}`)),
            ]);
          }
        })
        .on('error', async (err: any) => {
          this.logger.error('Error de FFmpeg:', ffmpegLogs);
          try {
            await Promise.all([
              fs.promises.unlink(videoPath).catch(() => {}),
              fs.promises.unlink(audioPath).catch(() => {}),
              fs.promises.unlink(bgMusicPath).catch(() => {}),
              fs.promises.unlink(mixedAudioPath).catch(() => {}),
              fs.promises.unlink(outputPath).catch(() => {}),
            ]);
          } finally {
            reject(new InternalServerErrorException(`Error al renderizar el vídeo: ${err.message}`));
          }
        });
    });
  }
}