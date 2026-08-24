import React, { useState, useEffect } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from './authConfig';
import { apiClient } from './api/axiosClient';
import { ShoppingBag, LogIn, LogOut, ShieldCheck, Server } from 'lucide-react';

interface Product {
  id: string | number;
  name: string;
  price: number;
  img?: string;
}

const App: React.FC = () => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  
  // Estados para el carrito y los productos
  const [cart, setCart] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [apiResponse, setApiResponse] = useState<string>('');

  // Efecto para cargar productos desde el Microservicio (API Gateway)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await apiClient.get('/productos');
        setProducts(response.data);
      } catch (error) {
        console.warn("No se pudo conectar al API Gateway. Cargando catálogo de respaldo local.");
        // Catálogo de respaldo por si el backend de AWS aún no está listo
        setProducts([
          { id: 1, name: 'Big Mac', price: 4500, img: '🍔' },
          { id: 2, name: 'Papas Fritas Grandes', price: 2000, img: '🍟' },
          { id: 3, name: 'McFlurry Oreo', price: 2500, img: '🍦' },
        ]);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  // --- MÉTODOS DE AUTENTICACIÓN CON MSAL ---
  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch((e) => {
      console.error(e);
    });
  };

  const handleLogout = () => {
    instance.logoutPopup({
      postLogoutRedirectUri: "/",
      mainWindowRedirectUri: "/"
    });
  };

  // --- MÉTODOS DE INTEGRACIÓN CON EL API GATEWAY ---
  const handleTestApi = async () => {
    try {
      setApiResponse('Cargando petición protegida...');
      // Esto usará el Interceptor que creamos, inyectando el token JWT de Azure
      const response = await apiClient.post('/carrito', { items: cart });
      setApiResponse(`¡Éxito! 200 OK. Respuesta: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        setApiResponse(`Bloqueado por API Gateway: ${error.response.status} (No autorizado).`);
      } else {
        setApiResponse(`Error de red: ${error.message}`);
      }
    }
  };

  const removeFromCart = (indexToRemove: number) => {
    setCart(cart.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      {/* NAVBAR SIMPLIFICADO */}
      <header className="bg-white border-b border-stone-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-yellow-400 font-black text-2xl">M</div>
            <h1 className="font-bold text-lg hidden sm:block">Pedidos360 (Cloud-Native)</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold">Hola, {accounts[0]?.name}</span>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" /> Salir
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" /> Login Microsoft Entra
              </button>
            )}
            
            <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold shadow-md">
              <ShoppingBag className="w-4 h-4" />
              <span>{cart.length}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!isAuthenticated && (
          <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-4">
            <ShieldCheck className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-bold text-lg mb-1">Protección perimetral activa</h2>
              <p className="text-sm">Inicia sesión con Azure AD para obtener un token JWT. Sin el token, el API Gateway de AWS (Microservicio Carrito) bloqueará tus peticiones.</p>
            </div>
          </div>
        )}

        {/* MICROSERVICIO PRODUCTOS (Visualización) */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600" />
            Catálogo de Productos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {products.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex flex-col items-center">
                <div className="text-5xl mb-2">{p.img}</div>
                <h3 className="font-bold">{p.name}</h3>
                <p className="text-stone-500 mb-4">${p.price}</p>
                <button 
                  onClick={() => setCart([...cart, p])}
                  className="w-full py-2 bg-amber-400 hover:bg-amber-500 rounded-lg text-stone-900 font-bold text-sm transition-colors cursor-pointer"
                >
                  Agregar al Carrito
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* MICROSERVICIO CARRITO (Prueba de Integración API Gateway) */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            Prueba de Seguridad al Microservicio Carrito
          </h2>

          {/* Lista de productos en el carrito */}
          <div className="mb-6 bg-stone-50 p-4 rounded-lg border border-stone-200">
            <h3 className="font-bold text-sm mb-3">Tu Pedido ({cart.length} items):</h3>
            {cart.length === 0 ? (
              <p className="text-sm text-stone-500 italic">El carrito está vacío. Agrega productos arriba.</p>
            ) : (
              <ul className="divide-y divide-stone-200">
                {cart.map((item, index) => (
                  <li key={index} className="py-2 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span>{item.img}</span>
                      <span className="text-sm font-semibold">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-stone-500">${item.price}</span>
                      <button 
                        onClick={() => removeFromCart(index)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 px-2 py-1 rounded cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
                <li className="pt-3 mt-2 flex justify-between items-center font-bold">
                  <span>Total:</span>
                  <span>${cart.reduce((total, item) => total + item.price, 0)}</span>
                </li>
              </ul>
            )}
          </div>

          <div className="flex items-center gap-4 mb-4">
            <button 
              onClick={handleTestApi}
              disabled={cart.length === 0}
              className={`px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-colors cursor-pointer ${cart.length === 0 ? 'bg-stone-300 text-stone-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
            >
              Enviar Pedido al API Gateway
            </button>
            <span className="text-sm text-stone-500">
              (Verificará el interceptor y enviará el token JWT)
            </span>
          </div>
          
          {apiResponse && (
            <div className="p-4 bg-stone-900 text-green-400 rounded-lg font-mono text-sm overflow-x-auto">
              {apiResponse}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;