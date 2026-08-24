import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { ShoppingBag, LogOut, Home, Store } from 'lucide-react';
import { useCart } from '../CartContext';

export const Navbar: React.FC = () => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { cart } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: "/" });
  };

  return (
    <header className="bg-white border-b border-stone-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to={isAuthenticated ? "/menu" : "/"} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-yellow-400 font-black text-2xl">M</div>
          <h1 className="font-bold text-lg hidden sm:block text-stone-900">Pedidos360</h1>
        </Link>
        
        <div className="flex items-center gap-4">
          {isAuthenticated && (
            <>
              <Link to="/menu" className="hidden sm:flex items-center gap-1 text-sm font-bold text-stone-600 hover:text-stone-900">
                <Store className="w-4 h-4" /> Menú
              </Link>
              <div className="h-6 w-px bg-stone-300 mx-2 hidden sm:block"></div>
              <span className="text-sm font-semibold hidden md:inline">Hola, {accounts[0]?.name?.split(' ')[0]}</span>
              
              <Link 
                to="/checkout"
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-red-700 transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{cart.length}</span>
              </Link>

              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm font-bold transition-colors cursor-pointer ml-2"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};