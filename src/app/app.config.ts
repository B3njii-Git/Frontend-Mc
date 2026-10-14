import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { MsalModule, MsalService, MsalGuard, MsalInterceptor, MsalBroadcastService, MSAL_INSTANCE, MSAL_GUARD_CONFIG, MSAL_INTERCEPTOR_CONFIG, MsalGuardConfiguration, MsalInterceptorConfiguration } from '@azure/msal-angular';
import { IPublicClientApplication, PublicClientApplication, InteractionType } from '@azure/msal-browser';
import { msalConfig, protectedResources } from './auth-config';
import { environment } from '../environments/environment';

export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication(msalConfig);
}

export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string>>();
  const baseUrl = (environment.apiGatewayUrl || '').replace(/\/+$/, '');
  const scopes = protectedResources.apiGateway.scopes;

  const rutas = [
    '/api/v1/auth',
    '/api/productos',
    '/api/carrito',
    '/api/pedidos',
    '/api/pagos',
    '/api/notificaciones'
  ];

  rutas.forEach(r => {
    if (baseUrl) {
      protectedResourceMap.set(`${baseUrl}${r}`, scopes);
      protectedResourceMap.set(`${baseUrl}${r}/`, scopes);
      protectedResourceMap.set(`${baseUrl}${r}/*`, scopes);
    }
    protectedResourceMap.set(r, scopes);
    protectedResourceMap.set(`${r}/`, scopes);
    protectedResourceMap.set(`${r}/*`, scopes);
  });

  if (baseUrl) {
    protectedResourceMap.set(`${baseUrl}/api`, scopes);
    protectedResourceMap.set(`${baseUrl}/api/`, scopes);
    protectedResourceMap.set(`${baseUrl}/api/*`, scopes);
  }
  protectedResourceMap.set('/api', scopes);
  protectedResourceMap.set('/api/', scopes);
  protectedResourceMap.set('/api/*', scopes);

  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap,
    strictMatching: false
  };
}

export function MSALGuardConfigFactory(): MsalGuardConfiguration {
  return { 
    interactionType: InteractionType.Redirect,
    authRequest: {
      scopes: ['User.Read']
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalInterceptor,
      multi: true
    },
    {
      provide: MSAL_INSTANCE,
      useFactory: MSALInstanceFactory
    },
    {
      provide: MSAL_GUARD_CONFIG,
      useFactory: MSALGuardConfigFactory
    },
    {
      provide: MSAL_INTERCEPTOR_CONFIG,
      useFactory: MSALInterceptorConfigFactory
    },
    MsalService,
    MsalGuard,
    MsalBroadcastService
  ]
};
