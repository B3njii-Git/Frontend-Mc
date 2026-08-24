import axios from 'axios';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '../authConfig';

// Inicializamos la instancia de MSAL fuera de React para poder usarla en Axios
export const msalInstance = new PublicClientApplication(msalConfig);

// Cliente Axios principal
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_AWS_API_GATEWAY_URL || 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// INTERCEPTOR: Se ejecuta ANTES de que cualquier petición HTTP salga hacia AWS
apiClient.interceptors.request.use(
  async (config) => {
    // 1. Buscamos si hay un usuario autenticado
    const account = msalInstance.getAllAccounts()[0];

    if (account) {
      try {
        // 2. Intentamos obtener un token válido de forma silenciosa
        const response = await msalInstance.acquireTokenSilent({
          ...loginRequest,
          account: account
        });
        
        // 3. Adjuntamos el token JWT a las cabeceras (Header) de la petición
        config.headers.Authorization = `Bearer ${response.accessToken}`;
      } catch (error) {
        console.warn("No se pudo obtener el token silenciosamente.", error);
        // Opcional: Podrías forzar un cierre de sesión o pedir login manual aquí si el token expira
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
