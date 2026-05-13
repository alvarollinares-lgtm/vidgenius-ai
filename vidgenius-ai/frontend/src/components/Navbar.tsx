interface NavbarProps {
  view: 'studio' | 'history' | 'pricing' | 'settings';
  setView: (view: 'studio' | 'history' | 'pricing' | 'settings') => void;
  onLogout: () => void;
  credits?: number | null;
}

export default function Navbar({ view, setView, onLogout, credits }: NavbarProps) {
  return (
    <div className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-xl shadow border border-gray-700">
      <h1 className="text-2xl font-black text-red-500 tracking-tight flex items-center gap-2"><span className="text-3xl">▶</span> Llinatube</h1>
      <div className="flex items-center space-x-6">
        {credits !== undefined && credits !== null && (
          <div className="bg-gray-900 px-4 py-1.5 rounded-full border border-gray-600 flex items-center shadow-inner">
            <span className="text-yellow-400 mr-2 text-lg leading-none">🪙</span>
            <span className="font-bold text-sm text-gray-200">{credits} Créditos</span>
          </div>
        )}
        <div className="space-x-4">
          <button onClick={() => setView('studio')} className={`text-sm transition-colors ${view === 'studio' ? 'text-red-400 font-bold border-b-2 border-red-500 pb-1' : 'text-gray-400 hover:text-white'}`}>Estudio</button>
          <button onClick={() => setView('history')} className={`text-sm transition-colors ${view === 'history' ? 'text-red-400 font-bold border-b-2 border-red-500 pb-1' : 'text-gray-400 hover:text-white'}`}>Historial</button>
          <button onClick={() => setView('pricing')} className={`text-sm transition-colors ${view === 'pricing' ? 'text-red-400 font-bold border-b-2 border-red-500 pb-1' : 'text-gray-400 hover:text-white'}`}>Créditos</button>
          <button onClick={() => setView('settings')} className={`text-sm transition-colors ${view === 'settings' ? 'text-red-400 font-bold border-b-2 border-red-500 pb-1' : 'text-gray-400 hover:text-white'}`}>Configuración</button>
          <button onClick={onLogout} className="text-sm text-red-400 hover:text-red-300 transition-colors">Salir</button>
        </div>
      </div>
    </div>
  );
}