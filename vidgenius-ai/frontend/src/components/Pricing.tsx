import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Pricing() {
  const { user, token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleBuy = async (priceId: string) => {
    if (!user) return alert("Debes iniciar sesión para comprar créditos.");
    setIsLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ priceId, userId: user.id })
      });
      
      const data = await res.json();
      if (data.url) {
        // Redirigimos al usuario a la pasarela de pago segura de Stripe
        window.location.href = data.url;
      } else {
        alert("No se pudo iniciar el pago: " + (data.message || JSON.stringify(data)));
      }
    } catch (error) {
      alert('Error al conectar con la pasarela de pago.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 max-w-4xl mx-auto mt-10">
      <h2 className="text-3xl font-extrabold text-white mb-8 text-center">💎 Recarga tus Créditos</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Pack 10 Créditos */}
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-700 flex flex-col items-center transition-transform hover:-translate-y-1">
          <h3 className="text-2xl font-bold text-gray-200 mb-2">Pack Básico</h3>
          <div className="text-5xl font-black text-white mb-4">9€</div>
          <p className="text-gray-400 mb-6 text-center">10 Créditos de IA<br/>(~10 vídeos generados)</p>
          <button onClick={() => handleBuy('price_1TWYMaCnf4RT3hroVfPJUa8h')} disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg">
            {isLoading ? 'Cargando...' : 'Comprar 10 Créditos'}
          </button>
        </div>

        {/* Pack 50 Créditos */}
        <div className="bg-gray-900 p-6 rounded-xl border border-red-500 flex flex-col items-center relative shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-transform hover:-translate-y-1">
          <div className="absolute top-0 transform -translate-y-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Más popular</div>
          <h3 className="text-2xl font-bold text-gray-200 mb-2">Pack Creador</h3>
          <div className="text-5xl font-black text-white mb-4">39€</div>
          <p className="text-gray-400 mb-6 text-center">50 Créditos de IA<br/>(~50 vídeos generados)</p>
          <button onClick={() => handleBuy('price_1TWYNYCnf4RT3hrohPURiMBB')} disabled={isLoading} className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-rose-500 hover:to-red-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg">
            {isLoading ? 'Cargando...' : 'Comprar 50 Créditos'}
          </button>
        </div>
      </div>
    </div>
  );
}