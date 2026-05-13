import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Settings() {
  const { user, token, fetchUser } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState(user?.n8nWebhookUrl || '');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [targetEmail, setTargetEmail] = useState('');
  const [creditsToAdd, setCreditsToAdd] = useState(10);
  const [adminMessage, setAdminMessage] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/auth/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ webhookUrl })
      });

      if (res.ok) {
        setMessage('¡Webhook de auto-publicación guardado correctamente! 🚀');
        fetchUser(); // Refrescamos el usuario global
      }
    } catch (error) {
      setMessage('Error al guardar el webhook.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCredits = async () => {
    if (!targetEmail) return;
    try {
      const res = await fetch(`${API_URL}/auth/admin/add-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetEmail, amount: creditsToAdd })
      });
      
      if (res.ok) {
        setAdminMessage(`¡Se han añadido ${creditsToAdd} créditos a ${targetEmail}! 💸`);
      } else {
        setAdminMessage('Error: No se pudo añadir los créditos (Comprueba el email).');
      }
    } catch (error) {
      setAdminMessage('Error al conectar con el servidor.');
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 max-w-2xl mx-auto mt-10">
      <h2 className="text-2xl font-extrabold text-white mb-6">⚙️ Configuración de Auto-Publicación</h2>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2 text-gray-300">Tu URL de Webhook (n8n, Make, Zapier)</label>
        <input 
          type="url" 
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://n8n.tu-servidor.com/webhook/..."
          className="w-full p-4 rounded-xl bg-gray-900 border border-gray-700 text-white outline-none focus:border-red-500 shadow-inner"
        />
        <p className="text-xs text-gray-400 mt-3">Si dejas esto en blanco, se usará la ruta de publicación estándar por defecto.</p>
      </div>

      <button onClick={handleSave} disabled={isSaving} className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-rose-500 hover:to-red-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg">
        {isSaving ? 'Guardando...' : '💾 Guardar Configuración'}
      </button>

      {message && <p className="mt-4 text-center text-green-400 font-medium">{message}</p>}

      {/* 👑 PANEL DE ADMINISTRADOR 👑 (Solo visible para ti) */}
      {/* ⚠️ REEMPLAZA ESTO POR TU EMAIL REAL ⚠️ */}
      {user?.email === 'allinare@hotmail.com' && (
        <div className="mt-12 p-6 bg-red-900/30 border border-red-500 rounded-xl shadow-inner animate-fade-in-up">
          <h3 className="text-xl font-bold text-red-400 mb-2 flex items-center gap-2">👑 Panel de Administrador</h3>
          <p className="text-sm text-gray-300 mb-6">Recarga créditos a cualquier usuario sin necesidad de base de datos.</p>
          
          <div className="flex flex-col md:flex-row gap-4 mb-2">
            <input 
              type="email" 
              placeholder="Email del cliente" 
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              className="flex-1 p-3 rounded-lg bg-gray-900 border border-gray-600 text-white outline-none focus:border-red-500"
            />
            <input 
              type="number" 
              value={creditsToAdd}
              onChange={(e) => setCreditsToAdd(Number(e.target.value))}
              className="w-full md:w-32 p-3 rounded-lg bg-gray-900 border border-gray-600 text-white outline-none focus:border-red-500"
              min="1"
            />
            <button 
              onClick={handleAddCredits}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition whitespace-nowrap shadow-lg"
            >
              Dar Créditos
            </button>
          </div>
          {adminMessage && <p className="text-sm font-medium text-yellow-400">{adminMessage}</p>}
        </div>
      )}
    </div>
  );
}