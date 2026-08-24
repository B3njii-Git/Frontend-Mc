import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './api/axiosClient';
import App from './App.tsx';
import './index.css';

// Función para renderizar la app
const renderApp = (msalInitialized = true) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {msalInitialized ? (
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>⚠️ Faltan las credenciales de Azure AD</h2>
          <p>La librería MSAL no pudo inicializarse. Por favor, asegúrate de colocar un <strong>Client ID</strong> y <strong>Tenant ID</strong> válidos en <code>src/authConfig.ts</code>.</p>
          <p>Revisa la consola del navegador para más detalles.</p>
        </div>
      )}
    </StrictMode>
  );
};

// Inicializamos MSAL antes de renderizar la app
msalInstance.initialize()
  .then(() => {
    renderApp(true);
  })
  .catch(error => {
    console.error("Error inicializando MSAL. Probablemente el Client ID aún no ha sido configurado en src/authConfig.ts", error);
    renderApp(false);
  });