import { Configuration, LogLevel } from '@azure/msal-browser';

export const msalConfig: Configuration = {
    auth: {
        clientId: '24a66d14-c9c3-41c1-a93b-7e5926389c91', // Tu Client ID
        authority: 'https://login.microsoftonline.com/c59a4270-0c88-46d9-a708-38639783c0b1', // Tu Tenant ID
        redirectUri: window.location.origin
    },
    cache: {
        cacheLocation: 'sessionStorage'
    },
    system: {
        loggerOptions: {
            loggerCallback(logLevel: LogLevel, message: string) {
                console.log(message);
            },
            logLevel: LogLevel.Info,
            piiLoggingEnabled: false
        }
    }
};

export const protectedResources = {
    apiGateway: {
        endpoint: "/api", // Se resolvera al dominio base de la pagina
        scopes: ["api://24a66d14-c9c3-41c1-a93b-7e5926389c91/access_as_user"] 
    }
}
