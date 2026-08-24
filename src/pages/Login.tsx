import React, { useEffect } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import { loginRequest } from '../authConfig';
import { ShieldCheck, LogIn } from 'lucide-react';

export const Login: React.FC = () => {
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();

  // Si ya está autenticado, enviarlo automáticamente al menú
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/menu');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch((e) => {
      console.error(e);
    });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-stone-200 text-center">
        <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center text-yellow-400 font-black text-5xl mx-auto mb-6 shadow-md">
          M
        </div>
        
        <h2 className="text-2xl font-black mb-2">Pedidos360</h2>
        <p className="text-stone-500 mb-8 text-sm">
          Portal Corporativo Seguro.<br/>
          Inicia sesión para acceder al catálogo.
        </p>

        <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-left text-sm flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p>La autenticación está delegada a <strong>Microsoft Entra ID</strong> (OAuth 2.0 con PKCE). Tus peticiones usarán Tokens JWT.</p>
        </div>

        <button 
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#0078D4] hover:bg-[#006cbd] text-white rounded-xl font-bold shadow-md transition-all cursor-pointer"
        >
          <LogIn className="w-5 h-5" /> 
          Iniciar sesión con Microsoft
        </button>
      </div>
    </div>
  );
};