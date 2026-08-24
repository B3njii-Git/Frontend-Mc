import { Configuration, LogLevel } from "@azure/msal-browser";

/**
 * Configuración para Microsoft Authentication Library (MSAL)
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "FALTA_CLIENT_ID",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || "common"}`,
    redirectUri: "/", 
  },
  cache: {
    cacheLocation: "sessionStorage", // Recomendado para web apps
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
        }
      },
    },
  },
};

/**
 * Los "scopes" o permisos que pedirás al momento de iniciar sesión.
 * Para probar que AWS rechaza/acepta, debes incluir el scope expuesto de tu microservicio.
 */
export const loginRequest = {
  scopes: ["User.Read"], 
  // Nota: Más adelante debes añadir aquí el scope de tu API expuesta en Azure.
  // Ejemplo: "api://<tu-api-client-id>/access_as_user"
};
