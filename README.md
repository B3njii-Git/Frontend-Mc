# FrontendAngular

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Versión Actual: 2.5.0
- **Integración con Transbank Webpay Plus y Kafka Velocity Check (`app.ts` & `app.html`)**:
  - Redirección POST automática (`token_ws`) hacia el portal de integración de Transbank Webpay Plus mediante `POST /api/pagos/iniciar`.
  - Captura automática de callback (`?token_ws=...` o `?TBK_TOKEN=...`) en `ngOnInit()` y confirmación con `POST /api/pagos/commit`, actualizando el estado del pedido, notificaciones y el Top 5 de recomendaciones (`purchase = 3 pts`).
  - Simulador de ráfaga **Kafka Velocity Check** (3+ intentos en `<10s` hacia `payment-attempts` $\rightarrow$ bloqueo temporal de 30 minutos `HTTP 429 Too Many Requests`) e indicador/desbloqueo de estado en el modal de pago y perfil.
- **Sistema Propio de Notificaciones Toast y Modales de Estado**:
  - Stack de notificaciones flotantes en `bottom-6 right-6` con acción rápida (*"Ver pedido"*) y modales de confirmación libres de librerías intrusivas.
- **Rediseño UI Corporativo sin emojis**: Interfaz renovada con iconografía vectorial SVG, contenedor alineado `max-w-[1440px]`, grilla de 4 columnas, favicon de arcos dorados y tipografías *Plus Jakarta Sans* y *JetBrains Mono*.
- **Panel de Inteligencia y Ranking Top 5 en Tiempo Real (`ms-recomendaciones` + Kafka)**:
  - Visualización del **Top 5 (`TOP #1` a `TOP #5`)** con puntaje acumulado en vivo (`pts`) según ponderación de interacciones (`Vista: +1 pt`, `Carrito: +2 pts`, `Compra: +3 pts`).
- **Sincronización Segura MSAL (`asegurarTokenYCargar`)**: Renovación silenciosa del token JWT (`acquireTokenSilent`) antes de disparar consultas paralelas a Pedidos, Notificaciones y Alertas de Fraude.

### Versión 2.3.0
- Integración y comunicación completa con AWS API Gateway Backend (Carrito, Pedidos, Pagos, Notificaciones).
- Configuración de MSAL Interceptor con strictMatching desactivado para adjuntar token Bearer a todas las subrutas de microservicios.
- Resiliencia en peticiones HTTP con SweetAlert2 y sincronización de estado del carrito y pedidos.
