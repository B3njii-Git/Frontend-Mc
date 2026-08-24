import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle } from 'lucide-react';
import { useCart } from '../CartContext';
import { apiClient } from '../api/axiosClient';
import { useNavigate } from 'react-router-dom';
import { useIsAuthenticated } from '@azure/msal-react';

export const Checkout: React.FC = () => {
  const { cart, removeFromCart, clearCart } = useCart();
  const [apiResponse, setApiResponse] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const isAuthenticated = useIsAuthenticated();

  // Proteger ruta
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const total = cart.reduce((acc, item) => acc + item.price, 0);

  const handleTestApi = async () => {
    setIsSubmitting(true);
    setApiResponse('Enviando petición a AWS (adjuntando JWT de Microsoft)...');
    
    try {
      // POST protegido al API Gateway (Microservicio 3)
      // El interceptor en axiosClient inyectará automáticamente el token
      const response = await apiClient.post('/carrito', { 
        items: cart,
        total: total 
      });
      
      setApiResponse(`¡Éxito! (200 OK). Pedido registrado.\n\nRespuesta de AWS:\n${JSON.stringify(response.data, null, 2)}`);
      clearCart();
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        setApiResponse(`Bloqueado por AWS API Gateway: Error ${error.response.status} (No autorizado).\nVerifica tu configuración de JWT Authorizer en AWS.`);
      } else {
        setApiResponse(`Error de red: ${error.message}\n(¿Está el API Gateway encendido y permitiendo CORS?)`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-purple-600" />
          Resumen del Pedido (Checkout)
        </h2>
        <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full hidden sm:inline">
          Microservicio Protegido (JWT)
        </span>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 mb-6">
        <h3 className="font-bold mb-4 border-b border-stone-100 pb-2">Artículos en tu carrito</h3>
        
        {cart.length === 0 ? (
          <p className="text-stone-500 italic py-4">No hay productos en tu pedido. Ve al menú para agregar algunos.</p>
        ) : (
          <>
            <ul className="divide-y divide-stone-100">
              {cart.map((item, index) => (
                <li key={index} className="py-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{item.img}</span>
                    <span className="font-semibold">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-stone-600 font-medium">${item.price.toLocaleString('es-CL')}</span>
                    <button 
                      onClick={() => removeFromCart(index)}
                      className="text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="pt-4 mt-2 border-t border-stone-200 flex justify-between items-center text-lg font-black">
              <span>Total a pagar:</span>
              <span>${total.toLocaleString('es-CL')}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end mb-6">
        <button 
          onClick={handleTestApi}
          disabled={cart.length === 0 || isSubmitting}
          className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all ${
            cart.length === 0 || isSubmitting 
              ? 'bg-stone-200 text-stone-400 cursor-not-allowed' 
              : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
          }`}
        >
          {isSubmitting ? 'Validando token en Azure/AWS...' : (
            <>
              <CheckCircle className="w-5 h-5" />
              Pagar y Enviar a API Gateway
            </>
          )}
        </button>
      </div>
      
      {apiResponse && (
        <div className="p-4 bg-stone-900 text-emerald-400 rounded-xl font-mono text-sm overflow-x-auto whitespace-pre-wrap border border-stone-700 shadow-inner">
          {apiResponse}
        </div>
      )}
    </div>
  );
};