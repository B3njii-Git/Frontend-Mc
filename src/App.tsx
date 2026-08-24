import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Menu } from './pages/Menu';
import { Checkout } from './pages/Checkout';
import { CartProvider } from './CartContext';

const App: React.FC = () => {
  return (
    <CartProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-stone-50 font-sans text-stone-900">
          <Navbar />
          <main className="flex flex-col flex-1">
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/checkout" element={<Checkout />} />
            </Routes>
          </main>
        </div>
      </Router>
    </CartProvider>
  );
};

export default App;