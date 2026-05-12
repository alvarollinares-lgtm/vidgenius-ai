import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Video {
  id: number;
  title: string;
  topic: string;
  script: string;
  videoUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
}

interface HistoryProps {
  token: string;
  onLoadVideo: (video: Video) => void;
}

export default function History({ token, onLoadVideo }: HistoryProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchMyVideos = async () => {
      try {
        const response = await fetch(`${API_URL}/ai/my-videos`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setVideos(data);
        }
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyVideos();
  }, [token]);

  const handlePublish = async (video: Video) => {
    if (!confirm(`¿Quieres enviar "${video.title}" a n8n para auto-publicar en tus redes?`)) return;
    
    setPublishingId(video.id);
    try {
      // Llamaremos a una nueva ruta del backend que configuraremos en el siguiente paso
      const response = await fetch(`${API_URL}/ai/publish-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videoId: video.id })
      });
      if (response.ok) {
        alert('¡Vídeo enviado a la cola de publicación de n8n con éxito! 🚀');
      } else {
        alert('Hubo un error al conectar con el servidor de publicación.');
      }
    } catch (error) {
      console.error('Error publicando:', error);
      alert('Error de conexión con el backend.');
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-200">Tus Vídeos Guardados</h2>
      {loading ? (
        <p className="text-gray-400 text-center mt-10">Cargando historial...</p>
      ) : videos.length === 0 ? (
        <p className="text-gray-400 text-center mt-10">No tienes vídeos creados todavía. ¡Ve al Estudio y crea uno!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden hover:border-red-500 transition-all duration-300 group flex flex-col">
              {/* Miniatura del vídeo (Coge el primer frame del videoUrl) */}
              <div className="relative h-48 bg-black border-b border-gray-700 overflow-hidden">
                {video.thumbnailUrl ? (
                  <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                ) : video.videoUrl ? (
                  <video src={video.videoUrl} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" preload="metadata" muted playsInline />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-600 font-medium">Sin miniatura</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                  <span className="bg-red-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded shadow-lg">Llinatube Pro</span>
                  <span className="text-xs text-gray-300 font-medium bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">{new Date(video.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              {/* Contenido e información */}
              <div className="p-5 flex flex-col flex-1">
                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 leading-tight" title={video.title}>{video.title}</h3>
                <p className="text-sm text-gray-400 mb-4 line-clamp-3 leading-relaxed flex-1">{video.script}</p>
                
                {/* Botones de Acción (Dashboard Premium) */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <button onClick={() => onLoadVideo(video)} className="col-span-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition duration-200 border border-gray-600 flex items-center justify-center gap-2 shadow-sm">
                    ✏️ Abrir Estudio
                  </button>
                  <button disabled className="bg-blue-900/30 text-blue-400 cursor-not-allowed font-bold py-2 px-2 rounded-xl text-xs border border-blue-900/50 flex flex-col items-center justify-center gap-1 transition" title="Fase 2: Muy pronto">
                    <span>📊</span> Estadísticas
                  </button>
                  <button onClick={() => handlePublish(video)} disabled={publishingId === video.id || !video.videoUrl} className={`${publishingId === video.id ? 'bg-green-600 text-white' : 'bg-green-900/40 hover:bg-green-800 text-green-400'} font-bold py-2 px-2 rounded-xl text-xs border border-green-900/50 flex flex-col items-center justify-center gap-1 transition disabled:opacity-50 disabled:cursor-not-allowed`} title="Enviar a n8n para publicar">
                    <span>🚀</span> Auto-Publicar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}