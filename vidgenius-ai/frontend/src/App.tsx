import { useState, useEffect } from 'react';
import AuthForm from './components/AuthForm';
import Navbar from './components/Navbar';
import History from './components/History';
import Studio from './components/Studio';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useStudioState } from './useStudioState';

function AppContent() {
  const { token, login, logout } = useAuth();
  const { reset, ...studioProps } = useStudioState();
  const [view, setView] = useState<'studio' | 'history'>('studio');
  const [credits, setCredits] = useState<number | null>(null);
  const [videoId, setVideoId] = useState<number | null>(null);

  const fetchProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:3000/auth/perfil', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits);
      }
    } catch (error) {
      console.error("Error obteniendo perfil:", error);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token, view]); // Recargamos los créditos al iniciar sesión y al cambiar de pestaña

  const handleLogout = () => {
    logout();
    reset();
  };

  // Si hay token, mostramos el Estudio (El Generador)
  if (token) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-4xl mx-auto">
          {/* Barra de Navegación */}
          <Navbar view={view} setView={setView} onLogout={handleLogout} credits={credits} />
          
          {view === 'studio' ? (
            <Studio 
              token={token}
              {...studioProps}
              videoId={videoId}
              setVideoId={setVideoId}
            />
          ) : (
            <History 
              token={token} 
              onLoadVideo={(video) => {
                studioProps.setTopic(video.topic);
                studioProps.setTitle(video.title);
                studioProps.setDescription(''); // Historial antiguo, se deja vacío para escribir uno nuevo
                studioProps.setScript(video.script);
                studioProps.setVideoUrl(video.videoUrl || '');
                setVideoId(video.id);
                setView('studio');
              }} 
            />
          )}
        </div>
      </div>
    );
  }

  // Si NO hay token, mostramos el Login
  return <AuthForm onLogin={login} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App
