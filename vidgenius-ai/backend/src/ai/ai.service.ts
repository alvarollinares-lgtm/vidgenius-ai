import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { VideoRenderService } from './video-render.service';
import * as dotenv from 'dotenv';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const textToSpeech = require('@google-cloud/text-to-speech');
dotenv.config();

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;
  private openrouter: OpenAI;
  private supabase: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly videoRenderService: VideoRenderService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY', 'missing_openai_key'),
    });
    this.openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.configService.get<string>('OPENROUTER_API_KEY', 'missing_key'),
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Llinatube',
      },
    });
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL', ''),
      this.configService.get<string>('SUPABASE_KEY', '')
    );
  }

  private _getAiClient(modelId: string): OpenAI {
    // OpenRouter usa un formato "autor/modelo", mientras que OpenAI no.
    if (modelId.includes('/')) {
      return this.openrouter;
    }
    return this.openai;
  }

  // Función para buscar vídeos de recurso (B-roll) gratuitos en Pexels
  async searchStockVideo(query: string, orientation: 'landscape' | 'portrait' = 'landscape') {
    try {
      const pexelsKey = this.configService.get<string>('PEXELS_API_KEY');
      if (!pexelsKey) return null;
      
      const response = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=${orientation}`, {
        headers: { Authorization: pexelsKey }
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data.videos && data.videos.length > 0) {
        const file = data.videos[0].video_files.find((f: any) => f.quality === 'hd') || data.videos[0].video_files[0];
        return file.link;
      }
    } catch (error) {
      this.logger.error('Error buscando vídeo en Pexels', error.stack);
    }
    return null;
  }

  // Función para leer internet y sugerir nichos virales
  async suggestTopics(modelId: string = 'gpt-4o-mini') {
    try {
      const client = this._getAiClient(modelId);
      const response = await client.chat.completions.create({
        // Usamos el modelo que nos pasen o uno gratuito por defecto
        model: modelId,
        messages: [
          { role: 'system', content: 'Eres un analista de tendencias virales. Genera 3 ideas de nichos o noticias muy actuales para YouTube. IMPORTANTE: NO digas que eres una IA ni que no tienes acceso a internet. Si no tienes datos en tiempo real, inventa 3 tendencias hiperrealistas. Devuelve SOLO las 3 ideas separadas por el símbolo "|", sin enumerar ni explicar nada más.' }
        ]
      });
      const text = response.choices[0].message.content || '';
      return text.split('|').map(t => t.trim()).filter(t => t.length > 0);
    } catch (error) {
      this.logger.warn(`Error al sugerir temas con ${modelId}. Usando fallback.`, error.stack);
      return ['Avances en Inteligencia Artificial hoy', 'El mercado de las criptomonedas', 'Descubrimientos del espacio profundos'];
    }
  }

  private async _generateScriptContent(topic: string, modelId: string): Promise<string> {
    const systemPrompt = `Eres un guionista experto en YouTube y retención de audiencia con millones de suscriptores. 
Tu objetivo es escribir un guion de vídeo MUY dinámico, de al menos 150 a 200 palabras (para que el vídeo dure aproximadamente un minuto), sin relleno y diseñado para retener la atención del espectador de principio a fin.

REGLAS ESTRICTAS:
1. ESTRUCTURA: El resultado DEBE empezar con la palabra "TÍTULO:" seguida de un título viral. Luego, en una nueva línea, escribe "DESCRIPCIÓN:" con una breve descripción SEO y añade al final de ella una lista de etiquetas (hashtags) relevantes para YouTube. Finalmente, escribe "GUION:" seguido del texto del vídeo. Empieza el guion con un "Gancho" (Hook) impactante, desarrolla el tema rápido y termina con una llamada a la acción (CTA).
2. FORMATO: Escribe directamente lo que el locutor va a decir. NO uses etiquetas como "Locutor:", "Narrador:", ni marcas de tiempo dentro del guion.
3. INSTRUCCIONES VISUALES: Si quieres sugerir qué mostrar en pantalla, ponlo SIEMPRE entre corchetes [ ] (ejemplo: [Vídeo de un volcán en erupción]).
4. SÍMBOLOS: NO uses asteriscos (**), negritas, ni símbolos raros en el texto hablado.
5. TONO: Conversacional, enérgico, intrigante y fácil de entender.`

    const client = this._getAiClient(modelId);
    try {
      const response = await client.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Escribe el guion perfecto y viral para un vídeo sobre: ${topic}` }
        ],
        temperature: 0.7,
      });
      return response.choices[0].message.content || '';
    } catch (aiError: any) {
      this.logger.warn(`El modelo ${modelId} falló (${aiError.message}). Usando guion de emergencia.`);
      return `TÍTULO: Los increíbles secretos de ${topic}\nDESCRIPCIÓN:\nDescubre los misterios ocultos sobre ${topic}. ¡No te lo pierdas!\n\n#${topic.replace(/\s+/g, '')} #curiosidades #misterio #viral\nGUION:\n¿Sabías que el tema de ${topic} es uno de los más fascinantes del momento? [Vídeo impresionante de ${topic}]. Muchos creen que lo saben todo, pero la realidad es muy diferente. Quédate hasta el final para descubrir el secreto. ¡Suscríbete y dale like para más contenido!`;
    }
  }

  private _parseScriptResponse(fullContent: string, topic: string) {
    let script = fullContent;
    let title = topic.substring(0, 100);
    let description = '';

    const titleMatch = script.match(/\**T[IÍ]TULO:?\**\s*([^\n]+)/i);
    if (titleMatch) {
      title = titleMatch[1].trim().replace(/["'\*]/g, '');
    }

    const descMatch = script.match(/\**DESCRIPCI[OÓ]N:?\**\s*([\s\S]*?)\**GUI[OÓ]N:?\**/i);
    if (descMatch) {
      description = descMatch[1].trim().replace(/\**/g, '');
    }

    const scriptMatch = script.match(/\**GUI[OÓ]N:?\**\s*([\s\S]*)/i);
    if (scriptMatch) {
      script = scriptMatch[1].trim();
    } else {
      // Fallback si el formato no es exacto
      script = script
        .replace(/\**T[IÍ]TULO:?\**\s*([^\n]+)/i, '')
        .replace(/\**DESCRIPCI[OÓ]N:?\**\s*([\s\S]*?)\**GUI[OÓ]N:?\**/i, '')
        .replace(/\**GUI[OÓ]N:?\**/i, '')
        .trim();
    }

    return { title, description, script };
  }

  private async _extractSearchQuery(content: string, modelId: string): Promise<string> {
    const client = this._getAiClient(modelId);
    try {
      const queryResponse = await client.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: 'You are a keyword extractor. Reply ONLY with 1 or 2 English words that describe the visual subject of the text. NO quotes, NO punctuation, NO extra text.' },
          { role: 'user', content }
        ]
      });
      const rawKeywords = queryResponse.choices[0].message.content?.replace(/["'.,]/g, '').trim();
      return (rawKeywords || 'nature').split(' ').slice(0, 2).join(' ');
    } catch (err) {
      this.logger.warn('Error en la segunda llamada a IA para extraer keywords. Usando "nature" por defecto.');
      return 'nature';
    }
  }

  private async _findStockVideo(searchQuery: string, topic: string, videoModel: string, orientation: '16:9' | '9:16'): Promise<string | null> {
    const pexelsOrientation = orientation === '9:16' ? 'portrait' : 'landscape';
    
    if (videoModel === 'pexels') {
      let stockVideoUrl = await this.searchStockVideo(searchQuery, pexelsOrientation);
      if (!stockVideoUrl) {
        this.logger.log('No se encontraron vídeos en Pexels con keywords en inglés, intentando con el tema original...');
        stockVideoUrl = await this.searchStockVideo(topic, pexelsOrientation);
      }
      return stockVideoUrl;
    }

    if (videoModel === 'wan') {
      this.logger.log(`Generando vídeo con IA (Fal.ai)... (Puede tardar ~1 minuto)`);
      try {
        const falKey = this.configService.get<string>('FAL_KEY');
        if (!falKey) throw new InternalServerErrorException('Falta FAL_KEY en el archivo .env');
        
        const response = await fetch('https://fal.run/fal-ai/hunyuan-video', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: `Cinematic, hyperrealistic documentary video, ${searchQuery}. Epic lighting, photorealistic, 8k resolution.`,
            aspect_ratio: orientation
          })
        });
        
        if (!response.ok) {
          const errText = await response.text();
          throw new InternalServerErrorException(`Fal.ai HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        if (data?.video?.url) {
          return data.video.url;
        }
        throw new InternalServerErrorException(`Fal.ai no devolvió un vídeo válido: ${JSON.stringify(data)}`);
      } catch (error) {
        this.logger.error("Error en Fal.ai:", error.stack);
        return "https://www.w3schools.com/html/mov_bbb.mp4"; // Fallback de emergencia
      }
    }

    // Placeholder para otros modelos de vídeo
    this.logger.log(`Generación con ${videoModel} no implementada. Usando vídeo de prueba.`);
    return "https://www.w3schools.com/html/mov_bbb.mp4";
  }

  async generateScript(topic: string, userId: number, modelId: string = 'gpt-4o-mini', videoModel: string = 'pexels', orientation: '16:9' | '9:16' = '16:9', customVideo?: any) {
    try {
      // 1. Comprobar si el usuario tiene créditos suficientes
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new InternalServerErrorException('Usuario no encontrado');
      
      // ESTRATEGIA 1: Modo Dios para el creador (Cambia este email por el tuyo)
      const isAdmin = user.email === 'allinare@hotmail.com';

      if (user.credits <= 0 && !isAdmin) {
        throw new InternalServerErrorException('No te quedan créditos. ¡Vuelve más tarde o mejora tu plan!');
      }

      const fullContent = await this._generateScriptContent(topic, modelId);
      const { title, description, script } = this._parseScriptResponse(fullContent, topic);

      const searchQuery = await this._extractSearchQuery(script || topic, modelId);
      this.logger.log(`Buscando vídeo con keywords: "${searchQuery}"`);

      let stockVideoUrl: string | null = null;
      
      if (videoModel === 'custom' && customVideo) {
        // Comprobamos si el vídeo pesa más de 50MB (50 * 1024 * 1024 bytes)
        if (customVideo.size > 50 * 1024 * 1024) {
          throw new InternalServerErrorException('Tu vídeo supera los 50MB permitidos. Por favor, usa un vídeo más ligero para las pruebas.');
        }
        this.logger.log('Subiendo vídeo personalizado a Supabase...');
        const fileName = `custom_${userId}_${Date.now()}.mp4`;
        const { error } = await this.supabase.storage.from('videos').upload(fileName, customVideo.buffer, { contentType: customVideo.mimetype });
        if (error) throw new InternalServerErrorException('Error subiendo tu vídeo a Supabase: ' + error.message);
        stockVideoUrl = this.supabase.storage.from('videos').getPublicUrl(fileName).data.publicUrl;
      } else {
        stockVideoUrl = await this._findStockVideo(searchQuery, topic, videoModel, orientation);
      }

      // 1.5 Generar miniatura con DALL-E 3
      this.logger.log('Generando miniatura hiperrealista con FLUX.1 (Fal.ai)...');
      let thumbnailUrl: string | null = null;
      try {
        const falKey = this.configService.get<string>('FAL_KEY');
        const imageResponse = await fetch('https://fal.run/fal-ai/flux/dev', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: `YouTube thumbnail for a viral video about: ${searchQuery}. Eye-catching, cinematic, highly detailed, vibrant colors, no text.`,
            image_size: orientation === '16:9' ? 'landscape_16_9' : 'portrait_16_9'
          })
        });
        const imageData = await imageResponse.json();
        const rawImageUrl = imageData?.images?.[0]?.url;
        if (rawImageUrl) {
          const imgBuffer = Buffer.from(await (await fetch(rawImageUrl)).arrayBuffer());
          const thumbName = `thumb_${userId}_${Date.now()}.png`;
          await this.supabase.storage.from('videos').upload(thumbName, imgBuffer, { contentType: 'image/png' });
          thumbnailUrl = this.supabase.storage.from('videos').getPublicUrl(thumbName).data.publicUrl;
        }
      } catch (imgError: any) {
        this.logger.warn('Error generando miniatura con DALL-E 3: ' + imgError.message);
      }

      // 2. Guardar el vídeo y descontar 1 crédito al mismo tiempo (Transacción)
      const txOperations: any[] = [
        this.prisma.video.create({
          data: {
            title: title,
            topic: topic,
            script: script,
            videoUrl: stockVideoUrl,
            thumbnailUrl: thumbnailUrl,
            userId: userId,
          },
        })
      ];

      if (!isAdmin) {
        txOperations.push(this.prisma.user.update({
          where: { id: userId },
          data: { credits: { decrement: 1 } }
        }));
      }

      const [newVideo] = await this.prisma.$transaction(txOperations);

      return {
        message: 'Guion generado y guardado con éxito',
        video: newVideo,
        description: description,
      };
    } catch (error: any) {
      throw new InternalServerErrorException('Error al generar el guion con IA: ' + error.message);
    }
  }

  // Nueva función para obtener el historial del usuario
  async getUserVideos(userId: number) {
    return this.prisma.video.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }, // Los más nuevos primero
    });
  }

  // Nueva función para enviar datos al Webhook de n8n
  async publishVideo(videoId: number, userId: number, platforms: string[] = ['tiktok']) {
    try {
      const video = await this.prisma.video.findUnique({
        where: { id: videoId },
      });

      if (!video || video.userId !== userId) {
        throw new NotFoundException('Vídeo no encontrado o no tienes permisos');
      }

      // Obtenemos al usuario para saber si tiene un webhook propio configurado
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      // ESTRATEGIA 2: SaaS Multi-tenant. Si el cliente tiene su webhook, úsalo. Si no, usa el tuyo.
      const webhookUrl = (user as any).n8nWebhookUrl || 'https://n8n-llinaria.yfciuh.easypanel.host/webhook/d92259d5-6d79-4b4e-84fa-3a41f0917a45';

      // Enviamos los metadatos del vídeo a n8n
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: video.id,
          title: video.title,
          topic: video.topic,
          script: video.script,
          final_video_url: video.videoUrl, // <-- Ahora enviaremos la URL del MP4 final de Supabase
          thumbnail_url: video.thumbnailUrl, // <-- Enviamos la miniatura a n8n
          platforms: platforms, // <-- ¡Aquí está la magia!
          created_at: video.createdAt,
        }),
      });

      if (!response.ok) {
        throw new Error(`n8n respondió con error: ${response.statusText}`);
      }

      return { message: 'Enviado a n8n con éxito' };
    } catch (error: any) {
      this.logger.error('Error publicando en n8n:', error.stack);
      throw new InternalServerErrorException('Error publicando: ' + error.message);
    }
  }

  private _cleanScriptForTTS(script: string): string {
    // Limpiar el guion: quitamos acotaciones, símbolos raros y palabras clave
    return script.replace(/\[[^\]]*\]|\([^)]*\)|\*\*|\+\+|T[ií]tulo:?\s*|Gui[oó]n:?\s*/gi, '').trim();
  }

  // Nueva función para convertir Texto a Audio con ElevenLabs
  async generateAudio(script: string, voiceId: string = 'google-es-journey-f') {
    try {
      const cleanScript = this._cleanScriptForTTS(script);

      // --- PLAN GOOGLE CLOUD TTS ---
      if (voiceId.startsWith('google-')) {
        this.logger.log('Generando voz con Google Cloud Premium...');
        
        // Mapeamos nuestro ID personalizado al nombre de la voz real de Google
        const googleVoiceName = voiceId === 'google-es-journey-f' 
          ? 'es-ES-Journey-F' // Mujer
          : 'es-ES-Journey-D'; // Hombre

        const googleClientEmail = this.configService.get<string>('GOOGLE_CLIENT_EMAIL');
        const googlePrivateKey = this.configService.get<string>('GOOGLE_PRIVATE_KEY');

        if (!googleClientEmail || !googlePrivateKey) {
          throw new InternalServerErrorException('Faltan las credenciales de Google (GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY) en el archivo .env');
        }

        const client = new textToSpeech.TextToSpeechClient({
          credentials: {
            client_email: googleClientEmail,
            private_key: googlePrivateKey.replace(/\\n/g, '\n'), // Arreglamos los saltos de línea del .env
          },
        });

        const request = {
          input: { text: cleanScript },
          voice: { languageCode: 'es-ES', name: googleVoiceName },
          audioConfig: { audioEncoding: 'MP3' as const },
        };

        const [response] = await client.synthesizeSpeech(request);
        return Buffer.from(response.audioContent, 'binary');
      }

      // --- PLAN ELEVENLABS ---
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.configService.get<string>('ELEVENLABS_API_KEY', ''),
        },
        body: JSON.stringify({
          text: cleanScript,
          model_id: 'eleven_multilingual_v2', // Soporta español perfecto
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(`ElevenLabs falló (${errorText}). Usando fallback de Google TTS gratuito.`);
        
        // Fallback de emergencia: Google TTS (Gratis) para que no se rompa el vídeo
        const fallbackText = encodeURIComponent(cleanScript.substring(0, 200));
        const fallbackResponse = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&tl=es-ES&client=tw-ob&q=${fallbackText}`);
        
        if (!fallbackResponse.ok) {
          throw new InternalServerErrorException(`Error de ElevenLabs: ${errorText}`);
        }
        
        return Buffer.from(await fallbackResponse.arrayBuffer());
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      throw new InternalServerErrorException('Error al generar el audio: ' + error.message);
    }
  }

  // Nueva función para unir Audio y Vídeo
  async mergeAudioVideo(videoId: number, videoUrl: string, script: string, voiceId: string = 'google-es-journey-f', orientation: '16:9' | '9:16' = '16:9'): Promise<Buffer> {
    try {
      this.logger.log('Iniciando fusión de vídeo y audio...');
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) throw new InternalServerErrorException('No se pudo descargar el vídeo');
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

      this.logger.log('Generando audio para el vídeo final...');
      const audioBuffer = await this.generateAudio(script, voiceId);

      const cleanScript = this._cleanScriptForTTS(script);
      const finalBuffer = await this.videoRenderService.render(videoBuffer, audioBuffer, cleanScript, orientation);

      if (videoId) {
        this.logger.log('Subiendo MP4 final a Supabase Storage...');
        const fileName = `final_${videoId}_${Date.now()}.mp4`;
        const { data, error } = await this.supabase.storage.from('videos').upload(fileName, finalBuffer, { contentType: 'video/mp4' });

        if (error) {
          this.logger.error('Error subiendo a Supabase:', error.message);
        } else {
          const publicUrl = this.supabase.storage.from('videos').getPublicUrl(fileName).data.publicUrl;
          this.logger.log(`¡Vídeo subido con éxito! URL: ${publicUrl}`);
          
          // Sobrescribimos el vídeo de la base de datos con nuestra nueva obra maestra final
          await this.prisma.video.update({ where: { id: Number(videoId) }, data: { videoUrl: publicUrl } });
        }
      }

      return finalBuffer;
    } catch (error: any) {
      this.logger.error('Error en la fusión de vídeo/audio:', error.stack);
      throw new InternalServerErrorException('Error en la fusión: ' + error.message);
    }
  }
}
