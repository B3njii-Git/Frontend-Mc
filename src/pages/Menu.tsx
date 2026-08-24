import React, { useState, useEffect } from 'react';
import { Server, ShoppingCart } from 'lucide-react';
import { apiClient } from '../api/axiosClient';
import { useCart, Product } from '../CartContext';
import { useNavigate } from 'react-router-dom';
import { useIsAuthenticated } from '@azure/msal-react';

export const Menu: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const isAuthenticated = useIsAuthenticated();

  // Proteger ruta
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // GET público al API Gateway (Microservicio 2)
        const response = await apiClient.get('/productos');
        setProducts(response.data);
      } catch (error) {
        console.warn("API de AWS no disponible. Usando datos de respaldo.");
        setProducts([
          { id: 1, name: 'Big Mac', price: 4500, img: '🍔' },
          { id: 2, name: 'Cuarto de Libra', price: 4800, img: '🍔' },
          { id: 3, name: 'McPollo Crispy', price: 4200, img: '🍗' },
          { id: 4, name: 'Papas Fritas Grandes', price: 2000, img: '🍟' },
          { id: 5, name: 'McNuggets 10 un.', price: 3500, img: '🥡' },
          { id: 6, name: 'McFlurry Oreo', price: 2500, img: '🍦' },
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isAuthenticated) fetchProducts();
  }, [isAuthenticated]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black flex items-center gap-2">
          <Server className="w-6 h-6 text-emerald-600" />
          Catálogo de Productos
        </h2>
        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
          Microservicio Público
        </span>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-stone-500">Cargando menú desde AWS...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(p => (
            <div key={p.id} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-col items-center hover:shadow-md transition-shadow">
              <div className="text-6xl mb-4 select-none">{p.img}</div>
              <h3 className="font-bold text-lg text-center leading-tight mb-1">{p.name}</h3>
              <p className="text-stone-500 font-medium mb-6">${p.price.toLocaleString('es-CL')}</p>
              
              <button 
                onClick={() => addToCart(p)}
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-500 rounded-xl text-stone-900 font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Agregar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};