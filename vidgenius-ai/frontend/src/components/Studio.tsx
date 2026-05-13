import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface StudioProps {
  token: string;
  topic: string;
  setTopic: (t: string) => void;
  title: string;
  setTitle: (t: string) => void;
  description: string;
  setDescription: (d: string) => void;
  script: string;
  setScript: (s: string) => void;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  videoId: number | null;
  setVideoId: (id: number | null) => void;
}

export default function Studio({
  token, topic, setTopic, title, setTitle, description, setDescription, script, setScript, videoUrl, setVideoUrl, videoId, setVideoId
}: StudioProps) {
  
  // Estados locales (Solo existen mientras estamos en el Estudio)
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [selectedVoice, setSelectedVoice] = useState('google-es-journey-f');
  const [selectedVideoModel, setSelectedVideoModel] = useState('wan');
  const [duration, setDuration] = useState('60'); // 60 segundos por defecto
  const [orientation, setOrientation] = useState<'16:9' | '9:16'>('16:9');
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [showAdvancedVoice, setShowAdvancedVoice] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['Canal 1 (Principal)']);
  const [customVideoFile, setCustomVideoFile] = useState<File | null>(null);

  // Obtenemos los datos del usuario logueado
  const { user, fetchUser } = useAuth();

  // Al salir del estudio, limpiamos los audios que estén reproduciéndose
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (audioElement) audioElement.pause();
    };
  }, [audioElement]);

  const handleSuggestTopics = async () => {
    setIsSuggesting(true);
    setMessage('Buscando tendencias virales en internet... 🌍');
    try {
      const response = await fetch(`${API_URL}/ai/suggest-topics?model=${encodeURIComponent(selectedModel)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const topics = await response.json();
      if (topics && topics.length > 0) {
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        setTopic(randomTopic);
        setMessage('¡Noticia o tendencia encontrada! 🚀');
      }
    } catch (error) {
      setMessage('Error al buscar tendencias.');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleGenerateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setScript('');
    setTitle('');
    setDescription('');
    setVideoUrl('');
    if (audioElement) {
      audioElement.pause();
      setAudioElement(null);
    }
    setMessage('Generando guion (esto puede tardar unos segundos)...');

    try {
      const formData = new FormData();
      
      // Inyectamos la duración directamente en el tema para que la IA la respete
      const topicWithDuration = `${topic} (IMPORTANTE: El guion debe estar escrito para durar aproximadamente ${duration} segundos. Ajusta la longitud de tus palabras estrictamente a este tiempo)`;
      formData.append('topic', topicWithDuration);
      
      formData.append('model', selectedModel);
      formData.append('videoModel', selectedVideoModel);
      formData.append('orientation', orientation);
      if (selectedVideoModel === 'custom' && customVideoFile) {
        formData.append('customVideo', customVideoFile);
      }

      const response = await fetch(`${API_URL}/ai/generate-script`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('¡Guion generado con éxito!');
        setTitle(data.video.title || '');
        setDescription(data.description || '');
        setScript(data.video.script || '');
        setVideoUrl(data.video.videoUrl || '');
        setVideoId(data.video.id);
        // Refrescamos para restar el crédito gastado en pantalla
        fetchUser();
      } else {
        setMessage(`Error: ${data.message || 'No se pudo generar'}`);
      }
    } catch (error) {
      setMessage('Error de conexión con el backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewScript = () => {
    if (isReading) {
      window.speechSynthesis.cancel();
      if (audioElement) audioElement.pause();
      setIsReading(false);
      return;
    }

    setIsReading(true);
    if (audioElement) {
      audioElement.pause();
      setAudioElement(null);
    }
    setMessage('¡Reproduciendo previsualización gratuita! 🤖');
    const cleanScript = script.replace(/\[[^\]]*\]|\([^)]*\)|\*+|\++|(?:T[ií]tulo|Gui[oó]n|Presentador|Locutor|Narrador|Voz en off|Voz)\s*:?\s*/gi, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanScript);
    utterance.lang = 'es-ES';
    utterance.onend = () => setIsReading(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleReadScript = async () => {
    if (isReading) {
      window.speechSynthesis.cancel();
      if (audioElement) audioElement.pause();
      setIsReading(false);
      return;
    }

    setIsReading(true);
    setMessage('🎤 Generando voz hiperrealista (esto puede tardar unos segundos)...');
    
    // Truco: Enviamos los parámetros concatenados en el ID de la voz
    const voicePayload = selectedVoice === 'browser' ? selectedVoice : `${selectedVoice}|${stability}|${similarity}`;

    try {
      const response = await fetch(`${API_URL}/ai/generate-audio`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ script, voiceId: voicePayload }),
      });

      if (!response.ok) throw new Error('Error al generar audio');

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      setAudioElement(audio);
      
      audio.onended = () => setIsReading(false);
      audio.play();
      setMessage('¡Reproduciendo voz de IA! 🎙️');
    } catch (error) {
      setMessage('Error de conexión al generar la voz.');
      setIsReading(false);
    }
  };

  const handleDownloadAudio = () => {
    if (!audioElement) return;
    const a = document.createElement('a');
    a.href = audioElement.src;
    a.download = `Llinatube_Audio.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadVideo = async () => {
    if (!videoUrl || !script) return;
    setIsMerging(true);
    setMessage('🎬 Produciendo vídeo final... (Esto puede tardar unos segundos)');

    try {
      const voiceToUse = selectedVoice === 'browser' ? 'google-es-journey-f' : `${selectedVoice}|${stability}|${similarity}`;
      
      const response = await fetch(`${API_URL}/ai/merge-video`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ videoId, videoUrl, script, voiceId: voiceToUse, orientation }),
      });

      if (!response.ok) throw new Error('Error al generar el vídeo');

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `Llinatube_Final.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setMessage('¡Vídeo descargado con éxito! 🎉');
    } catch (error) {
      setMessage('Error al producir el vídeo final.');
    } finally {
      setIsMerging(false);
    }
  };

  const handleChannelChange = (channel: string) => {
    setSelectedChannels(prev => 
      prev.includes(channel) 
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };


  const handlePublishVideo = async () => {
    if (!videoId) return;
    if (!confirm(`¿Quieres enviar "${title}" a n8n para auto-publicar en tus redes?`)) return;

    setIsPublishing(true);
    setMessage('🚀 Enviando vídeo a n8n para publicación...');

    try {
      const response = await fetch(`${API_URL}/ai/publish-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videoId, platforms: selectedChannels })
      });

      if (response.ok) {
        setMessage('¡Vídeo enviado a la cola de publicación de n8n con éxito! 🚀');
      } else {
        setMessage('Hubo un error al enviar el vídeo a n8n.');
      }
    } catch (error) {
      setMessage('Error de conexión al publicar.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
      {/* Cabecera del Estudio con Datos del Usuario */}
      {user && (
        <div className="flex justify-between items-center mb-6 bg-gray-900/50 p-4 rounded-xl border border-gray-700">
          <h2 className="text-xl font-extrabold text-white">🎬 Estudio de Grabación</h2>
          <div className="flex items-center gap-3">
            <span className="text-gray-300 font-medium">👋 Hola, {user.name}</span>
            <span className="bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg border border-red-500">
              🪙 {user.credits} Créditos
            </span>
          </div>
        </div>
      )}

      {/* Selectores de IA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1 text-gray-300">🧠 Modelo de Guionista</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full p-2 rounded-lg bg-gray-900 border border-gray-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all">
            <optgroup label="Modelos Oficiales (OpenAI)">
              <option value="gpt-4o-mini">GPT-4o Mini (Rápido, Barato y Excelente)</option>
              <option value="gpt-4o">GPT-4o (El Mejor, Máxima Calidad)</option>
            </optgroup>
            <optgroup label="Modelos Premium (Vía OpenRouter)">
              <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (El más creativo)</option>
              <option value="google/gemini-1.5-pro">Gemini 1.5 Pro (Excelente razonamiento)</option>
            </optgroup>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1 text-gray-300">🎙️ Voz del Locutor</label>
          <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="w-full p-2 rounded-lg bg-gray-900 border border-gray-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all">
            <optgroup label="Seguras (100% Gratis siempre)">
              <option value="browser">Voz del Navegador (Robot / Ilimitado)</option>
              <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Femenina / ElevenLabs Gratis)</option>
              <option value="google-es-journey-f">Google Premium (Femenina Hiperrealista)</option>
              <option value="google-es-journey-d">Google Premium (Masculina Hiperrealista)</option>
            </optgroup>
            <optgroup label="Mis Voces Clonadas">
              {/* Cuando clones tu voz en ElevenLabs, cambia "TU_VOICE_ID" por el ID real que te den */}
              <option value="TU_VOICE_ID">🎙️ Mi Propia Voz (Clonada)</option>
            </optgroup>
          </select>
          
          <button type="button" onClick={() => setShowAdvancedVoice(!showAdvancedVoice)} className="text-xs text-red-400 hover:text-red-300 mt-2 flex items-center gap-1 font-medium transition-colors">
            {showAdvancedVoice ? '▲ Ocultar Ajustes' : '▼ ⚙️ Ajustes Avanzados de Voz'}
          </button>
          
          {showAdvancedVoice && (
            <div className="mt-2 p-3 bg-gray-900 border border-gray-700 rounded-lg animate-fade-in-up">
              <label className="block text-[11px] font-bold text-gray-400 mb-1">Estabilidad ({stability})</label>
              <input type="range" min="0" max="1" step="0.05" value={stability} onChange={e => setStability(parseFloat(e.target.value))} className="w-full accent-red-500 mb-1" />
              <p className="text-[10px] text-gray-500 mb-3 leading-tight">Menos = Más emocional e impredecible.<br/>Más = Estable y parejo.</p>
              
              <label className="block text-[11px] font-bold text-gray-400 mb-1">Similitud ({similarity})</label>
              <input type="range" min="0" max="1" step="0.05" value={similarity} onChange={e => setSimilarity(parseFloat(e.target.value))} className="w-full accent-red-500 mb-1" />
              <p className="text-[10px] text-gray-500 leading-tight">Más = Clon exacto (riesgo de ruido).<br/>Menos = Voz más fluida.</p>
            </div>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1 text-gray-300">🎥 Vídeo de Fondo</label>
          <select value={selectedVideoModel} onChange={(e) => setSelectedVideoModel(e.target.value)} className="w-full p-2 rounded-lg bg-gray-900 border border-gray-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all">
            <optgroup label="IA Generativa de Vídeo (APIs Premium)">
              <option value="wan">Wan Video (Vía Fal.ai / Replicate)</option>
            </optgroup>
            <optgroup label="Mis Archivos">
              <option value="custom">📁 Subir mi propio vídeo</option>
            </optgroup>
          </select>
          {selectedVideoModel === 'custom' && (
            <div className="mt-2 animate-fade-in-up">
              <input type="file" accept="video/mp4,video/mov" onChange={(e) => setCustomVideoFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-gray-700 file:text-white hover:file:bg-gray-600 transition outline-none cursor-pointer" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1 text-gray-300">📱 Formato</label>
          <select value={orientation} onChange={(e) => setOrientation(e.target.value as '16:9' | '9:16')} className="w-full p-2 rounded-lg bg-gray-900 border border-gray-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all">
            <option value="16:9">Horizontal (16:9)</option>
            <option value="9:16">Vertical (9:16)</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1 text-gray-300">⏱️ Duración Deseada</label>
          <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full p-2 rounded-lg bg-gray-900 border border-gray-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all">
            <option value="30">Short Rápido (30 seg)</option>
            <option value="60">TikTok / Reel Estándar (1 minuto)</option>
            <option value="120">Vídeo Corto (2 minutos)</option>
            <option value="300">Vídeo Largo (5 minutos)</option>
          </select>
        </div>
      </div>

      <form onSubmit={handleGenerateScript} className="space-y-4 mb-6">
        <div>
          <label className="block text-lg font-bold mb-2 text-white">¿De qué quieres que trate tu próximo vídeo?</label>
          <div className="flex gap-2">
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="flex-1 p-4 rounded-xl bg-gray-900 border-2 border-gray-600 focus:border-red-500 focus:ring-0 outline-none transition text-lg shadow-inner" placeholder="Ej: La historia del Imperio Romano explicada fácil" required disabled={isLoading} />
            <button type="button" onClick={handleSuggestTopics} disabled={isSuggesting || isLoading} className="bg-gray-800 hover:bg-gray-700 text-yellow-400 font-bold px-6 rounded-xl border-2 border-gray-600 transition shadow-lg flex items-center gap-2" title="Buscar ideas virales en internet">
              {isSuggesting ? '⏳' : '💡 Explorar Red'}
            </button>
          </div>
        </div>
        <button type="submit" disabled={isLoading} className={`w-full ${isLoading ? 'bg-red-900 cursor-not-allowed opacity-70' : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 hover:-translate-y-0.5'} text-white font-black text-lg py-4 px-4 rounded-xl shadow-xl transition-all duration-200 transform`}>
          {isLoading ? 'Creando Magia... 🪄' : 'Generar Guion con IA ✨'}
        </button>
      </form>
      
      {message && <div className="mb-4 text-center text-sm font-medium p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-red-200 animate-pulse">{message}</div>}
      
      {script && (
        <div className="mt-6 animate-fade-in-up">
          <div className="mb-4">
            <div className="flex justify-between items-end mb-2">
              <h3 className="text-lg font-bold text-gray-300">🏷️ Título Sugerido:</h3>
              <button type="button" onClick={() => navigator.clipboard.writeText(title)} className="text-sm text-red-400 hover:text-red-300 transition">📋 Copiar</button>
            </div>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-white font-bold focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition"
            />
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between items-end mb-2">
              <h3 className="text-lg font-bold text-gray-300">📝 Descripción:</h3>
              <button type="button" onClick={() => navigator.clipboard.writeText(description)} className="text-sm text-red-400 hover:text-red-300 transition">📋 Copiar</button>
            </div>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition h-24"
            />
          </div>
          
          <h3 className="text-lg font-bold mb-2 text-gray-300">✍️ Tu Guion (Puedes editarlo libremente):</h3>
          <textarea 
            value={script} 
            onChange={(e) => setScript(e.target.value)} 
            className="w-full bg-gray-900 p-5 rounded-xl border border-gray-700 whitespace-pre-wrap text-gray-200 text-lg h-72 overflow-y-auto leading-relaxed focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none shadow-inner"
          />
          
          {videoUrl && (
            <div className="mt-4 rounded-xl overflow-hidden shadow-2xl border border-gray-700">
              <video src={videoUrl} autoPlay loop muted playsInline className="w-full h-auto object-cover max-h-80" />
            </div>
          )}
          
          <div className="mt-4 flex flex-col md:flex-row gap-2">
            <button type="button" onClick={handlePreviewScript} className={`w-full md:w-1/2 py-3 px-4 font-bold rounded-lg shadow-lg transition duration-200 ${isReading ? 'bg-red-600 hover:bg-red-500 border border-red-400' : 'bg-gray-700 hover:bg-gray-600 border border-gray-500 text-white'}`}>
              {isReading ? '⏹️ Detener' : '🤖 Previsualizar (Gratis)'}
            </button>
            <button type="button" onClick={handleReadScript} className={`w-full md:w-1/2 py-3 px-4 font-bold rounded-lg shadow-lg transition duration-200 ${isReading ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
              {isReading ? '⏹️ Detener' : '🎙️ Generar Voz IA'}
            </button>
          </div>
          
          {audioElement && selectedVoice !== 'browser' && (
            <button type="button" onClick={handleDownloadAudio} className="mt-2 w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-200 border border-gray-500">
              💾 Descargar Audio MP3
            </button>
          )}
          
          {videoUrl && (
            <div className="mt-3 flex flex-col gap-3">
              <button type="button" onClick={handleDownloadVideo} disabled={isMerging || isPublishing} className={`w-full ${isMerging ? 'bg-gray-600 cursor-not-allowed opacity-80' : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-rose-500 hover:to-red-500 hover:-translate-y-0.5'} text-white font-black text-lg py-4 px-4 rounded-xl shadow-xl border border-red-400 transition-all duration-200 transform`}>
                {isMerging ? '⏳ Renderizando Vídeo MP4...' : '🎬 Descargar Vídeo Final MP4'}
              </button>
              
              {videoId && (
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-300 mb-2">¿En qué canal de YouTube quieres publicar?</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {['Canal 1 (Principal)', 'Canal 2 (Secundario)', 'Canal 3 (Pruebas)'].map(channel => (
                        <label key={channel} className="flex items-center gap-2 cursor-pointer text-gray-200">
                          <input 
                            type="checkbox" 
                            checked={selectedChannels.includes(channel)} 
                            onChange={() => handleChannelChange(channel)}
                            className="form-checkbox h-5 w-5 text-red-500 bg-gray-800 border-gray-600 rounded focus:ring-red-500"
                          />
                          <span>{channel}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={handlePublishVideo} disabled={isPublishing || isMerging || selectedChannels.length === 0} className={`w-full ${isPublishing || selectedChannels.length === 0 ? 'bg-red-900 cursor-not-allowed opacity-80' : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 hover:-translate-y-0.5'} text-white font-black text-lg py-4 px-4 rounded-xl shadow-xl border border-red-500 transition-all duration-200 transform disabled:opacity-50`}>
                    {isPublishing ? '🚀 Enviando a n8n...' : `🚀 Auto-Publicar en ${selectedChannels.length} canal(es)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}