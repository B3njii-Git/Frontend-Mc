import { Component, OnInit, OnDestroy, Inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MsalService, MsalBroadcastService, MSAL_GUARD_CONFIG, MsalGuardConfiguration } from '@azure/msal-angular';
import { AuthenticationResult, InteractionStatus, InteractionType, PopupRequest, RedirectRequest } from '@azure/msal-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { protectedResources } from './auth-config';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  title = 'Pedidos360';
  isIframe = false;
  loginDisplay = false;
  private readonly _destroying$ = new Subject<void>();
  userEmail: string = '';
  userProfile: any = null;
  productos: any[] = [];
  carrito: any = null;
  recomendacionesData: any = null;
  wsEstado: 'conectado' | 'fallback' | 'desconectado' = 'desconectado';
  private wsMetricas: WebSocket | null = null;
  private wsFallbackTimer: any = null;
  private wsReconnectTimer: any = null;
  busquedaTexto: string = '';
  categoriaActiva: string = 'Todos';
  productoDetalle: any = null;
  isCartOpen: boolean = false;
  isProfileOpen: boolean = false;

  // Sistema de notificaciones Toast (abajo a la derecha, sin tapar el Navbar/Carrito) y Modal de Estado
  toasts: Array<{
    id: number;
    tipo: 'success' | 'error' | 'info' | 'warning';
    titulo: string;
    detalle?: string;
    accionTexto?: string;
    accion?: 'carrito' | 'perfil';
  }> = [];
  alertaModal: {
    tipo: 'success' | 'error' | 'warning' | 'info';
    titulo: string;
    mensaje: string;
    subtitulo?: string;
    accionPrimariaTexto?: string;
    accionPrimaria?: 'perfil' | 'reintentar_pago';
  } | null = null;
  private toastSeq = 0;

  mostrarToast(
    tipo: 'success' | 'error' | 'info' | 'warning',
    titulo: string,
    detalle?: string,
    accionTexto?: string,
    accion?: 'carrito' | 'perfil'
  ) {
    const id = ++this.toastSeq;
    // Reemplaza la notificación anterior para mantener una sola alerta limpia al pedir rápido
    this.toasts = [{ id, tipo, titulo, detalle, accionTexto, accion }];
    this.cdr.detectChanges();
    setTimeout(() => this.cerrarToast(id), 2500);
  }

  @HostListener('document:mousedown', ['$event'])
  onGlobalMouseDown(event: MouseEvent) {
    if (this.toasts.length === 0) return;
    const target = event.target as HTMLElement | null;
    if (target && target.closest('.toast-action-btn')) {
      return;
    }
    this.toasts = [];
    this.cdr.detectChanges();
  }

  cerrarToast(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.cdr.detectChanges();
  }

  ejecutarAccionToast(toast: any) {
    this.cerrarToast(toast.id);
    if (toast.accion === 'carrito') {
      this.isCartOpen = true;
    } else if (toast.accion === 'perfil') {
      this.abrirPerfil();
    }
    this.cdr.detectChanges();
  }

  ejecutarAccionAlertaModal() {
    if (!this.alertaModal) return;
    const accion = this.alertaModal.accionPrimaria;
    this.alertaModal = null;
    if (accion === 'perfil') {
      this.abrirPerfil();
    } else if (accion === 'reintentar_pago' && this.pedidoPendientePago) {
      this.mostrarModalPago = true;
    }
    this.cdr.detectChanges();
  }
  get apiUrl(): string {
    return (environment.apiGatewayUrl || '').replace(/\/+$/, '');
  }

  abrirPerfil() {
    this.isProfileOpen = true;
    this.asegurarTokenYCargar(() => {
      this.cargarPedidos();
      this.cargarAlertasFraude();
      this.http.get<any[]>(`${this.apiUrl}/api/notificaciones`).subscribe({
        next: data => {
          this.notificacionesEnColaError = false;
          this.notificaciones = data || [];
          this.contadorNoLeidas = (data || []).filter((n: any) => !n.leida).length;
          this.cdr.detectChanges();
          this.notificaciones.filter(n => !n.leida).forEach(n => this.marcarNotificacionLeida(n.id));
        },
        error: () => {
          this.notificacionesEnColaError = true;
          this.iniciarPollingPedidos();
          this.cdr.detectChanges();
        }
      });
    });
  }

  getNombreProducto(productoId: string): string {
    const prod = this.productos.find(p => p.id === productoId);
    return prod ? prod.nombre : 'Cargando producto...';
  }

  constructor(
    @Inject(MSAL_GUARD_CONFIG) private msalGuardConfig: MsalGuardConfiguration,
    private authService: MsalService,
    private msalBroadcastService: MsalBroadcastService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isIframe = window !== window.parent && !window.opener;

    // Capturar parametros de retorno de Transbank Webpay Plus antes de que MSAL limpie la URL
    const searchParams = new URLSearchParams(window.location.search);
    const tokenWs = searchParams.get('token_ws');
    const tbkToken = searchParams.get('TBK_TOKEN');

    this.authService.instance.initialize().then(() => {
      this.authService.handleRedirectObservable().subscribe({
        next: (result: AuthenticationResult | null) => {
          if (result) {
            this.authService.instance.setActiveAccount(result.account);
            this.sincronizarUsuario();
            this.setLoginDisplay();
          }
          // Limpiar la URL de hashes feos o query params de MSAL o Webpay
          window.history.replaceState({}, document.title, window.location.origin + '/');

          if (tokenWs) {
            this.procesarRetornoWebpay(tokenWs);
          } else if (tbkToken) {
            this.alertaModal = {
              tipo: 'warning',
              subtitulo: 'Transbank Webpay Plus',
              titulo: 'Pago anulado en la pasarela',
              mensaje: 'Anulaste la operación desde el portal de Transbank Webpay Plus. Tu orden sigue disponible en tu cuenta por si deseas reintentar.',
              accionPrimariaTexto: 'Ver mis pedidos',
              accionPrimaria: 'perfil'
            };
            this.cdr.detectChanges();
          }
        },
        error: (error) => console.log(error)
      });

      this.msalBroadcastService.inProgress$
        .pipe(
          filter((status: InteractionStatus) => status === InteractionStatus.None),
          takeUntil(this._destroying$)
        )
        .subscribe(() => {
          this.setLoginDisplay();
        });
    });
  }

  sincronizarUsuario() {
     this.http.post(`${this.apiUrl}/api/v1/auth/login`, {}).subscribe({
         next: (res) => {
             console.log('Usuario sincronizado con backend', res);
             this.cargarDatos();
         },
         error: (err) => {
             console.warn('Backend auth/login no disponible o no requerido, continuando...', err);
             this.cargarDatos();
         }
     });
  }

  cargarDatos() {
    this.http.get<any[]>(`${this.apiUrl}/api/productos`).subscribe({
        next: data => {
            this.productos = data || [];
            this.cdr.detectChanges();
        },
        error: err => {
            console.error('Error cargando productos', err);
            this.productos = [];
            this.cdr.detectChanges();
        }
    });
    this.http.get<any>(`${this.apiUrl}/api/carrito`).subscribe({
        next: data => {
            this.carrito = data || { items: [] };
            this.cdr.detectChanges();
        },
        error: err => {
            console.error('Error cargando carrito', err);
            this.carrito = { items: [] };
            this.cdr.detectChanges();
        }
    });
    this.cargarPedidos();
    this.cargarNotificaciones();
    this.cargarAlertasFraude();
    this.cargarRecomendaciones();
  }

  cargarRecomendaciones() {
    this.http.get<any>(`${this.apiUrl}/api/analytics/recomendaciones`).subscribe({
      next: data => {
        this.recomendacionesData = data;
        this.cdr.detectChanges();
        if (this.wsEstado === 'desconectado') {
          this.conectarWebSocketMetricas(data?.usuarioId);
        }
      },
      error: () => {
        // ms-recomendaciones puede estar iniciando
      }
    });
  }

  conectarWebSocketMetricas(userId?: string) {
    if (this.wsMetricas && (this.wsMetricas.readyState === WebSocket.OPEN || this.wsMetricas.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const baseWs = (environment as any).wsUrl as string | undefined;
    if (!baseWs) {
      this.activarFallbackMetricas();
      return;
    }

    // Si la página corre en HTTPS y el endpoint WS no usa TLS (ws://), activar fallback HTTP automático
    if (window.location.protocol === 'https:' && baseWs.startsWith('ws://')) {
      this.activarFallbackMetricas();
      return;
    }

    const targetUser = userId || this.recomendacionesData?.usuarioId || 'visitante-anonimo';
    const url = `${baseWs}?userId=${encodeURIComponent(targetUser)}`;

    try {
      const ws = new WebSocket(url);
      this.wsMetricas = ws;

      ws.onopen = () => {
        this.wsEstado = 'conectado';
        if (this.wsFallbackTimer) {
          clearInterval(this.wsFallbackTimer);
          this.wsFallbackTimer = null;
        }
        this.cdr.detectChanges();
      };

      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data) {
            if (!this.recomendacionesData || data.usuarioId === this.recomendacionesData.usuarioId) {
              this.recomendacionesData = data;
            } else {
              this.recomendacionesData = {
                ...this.recomendacionesData,
                totalEventosClickstream: data.totalEventosClickstream,
                totalEventosAntifraude: data.totalEventosAntifraude,
                totalBloqueosFraude: data.totalBloqueosFraude,
                ultimosEventos: data.ultimosEventos
              };
            }
            this.cdr.detectChanges();
          }
        } catch {}
      };

      ws.onerror = () => {
        this.activarFallbackMetricas();
      };

      ws.onclose = () => {
        if (this.wsEstado === 'conectado') {
          this.wsEstado = 'desconectado';
          this.wsReconnectTimer = setTimeout(() => {
            if (this.loginDisplay) this.conectarWebSocketMetricas(targetUser);
          }, 5000);
        } else {
          this.activarFallbackMetricas();
        }
      };
    } catch {
      this.activarFallbackMetricas();
    }
  }

  private activarFallbackMetricas() {
    this.wsEstado = 'fallback';
    this.cdr.detectChanges();
    if (this.wsFallbackTimer) return;
    this.wsFallbackTimer = setInterval(() => {
      if (!this.loginDisplay) return;
      this.http.get<any>(`${this.apiUrl}/api/analytics/recomendaciones`).subscribe({
        next: data => {
          this.recomendacionesData = data;
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    }, 5000);
  }

  filtrarCatalogo(categoria?: string) {
    if (categoria !== undefined) {
      this.categoriaActiva = categoria;
    }
    const params: string[] = [];
    if (this.busquedaTexto.trim()) params.push(`q=${encodeURIComponent(this.busquedaTexto.trim())}`);
    if (this.categoriaActiva && this.categoriaActiva !== 'Todos') {
      params.push(`categoria=${encodeURIComponent(this.categoriaActiva)}`);
    }
    const qs = params.length ? `?${params.join('&')}` : '';
    this.http.get<any[]>(`${this.apiUrl}/api/productos${qs}`).subscribe({
      next: data => {
        this.productos = data || [];
        this.cdr.detectChanges();
        setTimeout(() => this.cargarRecomendaciones(), 500);
      },
      error: err => console.error('Error filtrando productos', err)
    });
  }

  verDetalleProducto(producto: any) {
    this.http.get<any>(`${this.apiUrl}/api/productos/${producto.id}?registrarVista=true`).subscribe({
      next: data => {
        this.productoDetalle = data;
        this.cdr.detectChanges();
        setTimeout(() => this.cargarRecomendaciones(), 500);
      },
      error: () => {
        this.productoDetalle = producto;
        this.cdr.detectChanges();
      }
    });
  }

  get subtotalCarrito(): number {
    if (!this.carrito?.items?.length) return 0;
    return this.carrito.items.reduce((acc: number, i: any) => acc + (i.cantidad * i.precioUnitario), 0);
  }

  cambiarTipoEnvio(tipo: string) {
    this.http.post<any>(`${this.apiUrl}/api/carrito/envio?tipo=${encodeURIComponent(tipo)}`, {}).subscribe({
      next: data => {
        this.carrito = data;
        this.cdr.detectChanges();
      },
      error: err => console.error('Error actualizando envio', err)
    });
  }

  agregarAlCarrito(producto: any) {
    const dto = { productoId: producto.id, cantidad: 1 };
    this.http.post<any>(`${this.apiUrl}/api/carrito/items`, dto).subscribe({
        next: data => {
            this.carrito = data;
            this.cdr.detectChanges();
            setTimeout(() => this.cargarRecomendaciones(), 500);

            this.mostrarToast(
              'success',
              `${producto.nombre} agregado`,
              `Total actual: $${this.subtotalCarrito.toLocaleString('es-CL')}`,
              'Ver pedido',
              'carrito'
            );
        },
        error: err => {
            console.error('Error agregando al carrito', err);
            this.mostrarToast(
              'error',
              'No se pudo agregar el producto',
              'Verifica la disponibilidad e intenta nuevamente.'
            );
        }
    });
  }

  eliminarDelCarrito(productoId: string) {
    this.http.delete<any>(`${this.apiUrl}/api/carrito/items/${productoId}`).subscribe({
        next: data => {
            this.carrito = data;
            this.cdr.detectChanges();
            setTimeout(() => this.cargarRecomendaciones(), 500);
        },
        error: err => {
            console.error('Error eliminando del carrito', err);
        }
    });
  }

  // --- NUEVAS FUNCIONES PARA PEDIDOS ---
  pedidos: any[] = [];

  // Estado de pagos y notificaciones
  notificaciones: any[] = [];
  alertasFraude: any[] = [];
  contadorNoLeidas: number = 0;
  notificacionesEnColaError: boolean = false;
  mostrarModalPago: boolean = false;
  pedidoPendientePago: any = null;
  itemsUltimoPedido: any[] = [];
  metodoPagoSeleccionado: string = 'WEBPAY';
  numeroTarjeta: string = '4532 0151 1283 4242';
  procesandoPago: boolean = false;
  estadoVelocityCliente: any = null;

  get clientIdSanitizado(): string {
    const base = this.userEmail || this.userProfile?.email || 'cliente-pedidos360';
    return base.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  cargarEstadoVelocityCliente() {
    const cid = this.clientIdSanitizado;
    if (!cid) return;
    this.http.get<any>(`${this.apiUrl}/api/pagos/estado-cliente/${encodeURIComponent(cid)}`).subscribe({
      next: data => {
        this.estadoVelocityCliente = data;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  desbloquearMiCuentaVelocity() {
    const cid = this.clientIdSanitizado;
    this.http.post<any>(`${this.apiUrl}/api/pagos/estado-cliente/${encodeURIComponent(cid)}/desbloquear`, {}).subscribe({
      next: data => {
        this.estadoVelocityCliente = data;
        this.mostrarToast('success', 'Bloqueo temporal levantado', 'Tu cuenta ya puede iniciar nuevas transacciones con Webpay Plus.');
        this.cdr.detectChanges();
      },
      error: () => {
        this.mostrarToast('error', 'No se pudo desbloquear', 'Verifica la conexión con el servicio de pagos.');
      }
    });
  }

  cargarAlertasFraude() {
    this.cargarEstadoVelocityCliente();
    this.http.get<any[]>(`${this.apiUrl}/api/pagos/alertas-fraude`).subscribe({
      next: data => {
        this.alertasFraude = data || [];
        this.cdr.detectChanges();
      },
      error: () => {
        // ms-pagos puede estar caido en pruebas de resiliencia
      }
    });
  }
  
  cargarPedidos() {
    this.http.get<any[]>(`${this.apiUrl}/api/pedidos`).subscribe({
        next: data => {
            this.pedidos = data || [];
            this.cdr.detectChanges();
        },
        error: err => console.error('Error cargando pedidos', err)
    });
  }

  crearPedido() {
    if (!this.carrito || !this.carrito.items || this.carrito.items.length === 0) {
      this.mostrarToast('warning', 'Tu bolsa está vacía', 'Agrega productos antes de continuar al pago.');
      return;
    }

    // No vaciamos ni creamos el pedido en BD hasta que el usuario confirme el pago.
    // Así si cierra el modal de pago, su carrito sigue intacto.
    this.pedidoPendientePago = {
      id: 'Nuevo',
      total: this.subtotalCarrito
    };
    this.isCartOpen = false;
    this.mostrarModalPago = true;
    this.cdr.detectChanges();
  }

  reabrirPagoPedidoPendiente(pedido: any) {
    this.pedidoPendientePago = pedido;
    this.isProfileOpen = false;
    this.mostrarModalPago = true;
    this.cdr.detectChanges();
  }

  private asegurarPedidoCreado(callback: (pedido: any) => void) {
    if (this.pedidoPendientePago && typeof this.pedidoPendientePago.id === 'number') {
      callback(this.pedidoPendientePago);
      return;
    }

    this.itemsUltimoPedido = this.carrito?.items ? [...this.carrito.items] : [];
    this.http.post<any>(`${this.apiUrl}/api/pedidos`, {}).subscribe({
      next: pedidoCreado => {
        this.pedidoPendientePago = pedidoCreado;
        this.carrito = { items: [] };
        this.cargarPedidos();
        callback(pedidoCreado);
      },
      error: err => {
        this.procesandoPago = false;
        console.error('Error creando pedido antes de pagar', err);
        this.alertaModal = {
          tipo: 'error',
          titulo: 'No se pudo generar tu orden',
          mensaje: 'Ocurrió un inconveniente al registrar tu pedido. Intenta nuevamente en unos segundos.'
        };
        this.cdr.detectChanges();
      }
    });
  }

  confirmarPago() {
    if (!this.pedidoPendientePago) return;
    if (this.metodoPagoSeleccionado === 'WEBPAY') {
      this.iniciarPagoWebpayPlus();
      return;
    }
    this.procesandoPago = true;

    this.asegurarPedidoCreado(pedido => {
      const pedidoId = pedido.id;
      const dto = {
        metodoPago: this.metodoPagoSeleccionado,
        numeroTarjeta: this.numeroTarjeta
      };

      this.http.post<any>(`${this.apiUrl}/api/pedidos/${pedidoId}/pagar`, dto).subscribe({
        next: () => {
            setTimeout(() => {
                this.procesandoPago = false;
                this.mostrarModalPago = false;
                this.cargarAlertasFraude();
                this.http.get<any[]>(`${this.apiUrl}/api/pedidos`).subscribe({
                    next: pedidos => {
                        this.pedidos = pedidos || [];
                        const pedidoActualizado = this.pedidos.find(p => p.id === pedidoId);
                        if (pedidoActualizado && pedidoActualizado.estado === 'EN_PREPARACION') {
                            // Registrar interacción 'purchase' (peso 3) en ms-recomendaciones + Kafka por cada artículo comprado
                            this.registrarInteraccionesCompra();
                            this.alertaModal = {
                                tipo: 'success',
                                subtitulo: `Orden #${pedidoId}`,
                                titulo: 'Pago confirmado con éxito',
                                mensaje: 'Tu pedido ya entró a cocina y está en preparación. Puedes hacer seguimiento en tu cuenta.',
                                accionPrimariaTexto: 'Ver estado del pedido',
                                accionPrimaria: 'perfil'
                            };
                        } else if (pedidoActualizado && pedidoActualizado.estado === 'CANCELADO') {
                            this.http.get<any>(`${this.apiUrl}/api/pagos/pedido/${pedidoId}`).subscribe({
                                next: pagoInfo => {
                                    if (pagoInfo?.estado === 'BLOQUEADO_FRAUDE') {
                                        this.alertaModal = {
                                            tipo: 'error',
                                            subtitulo: `Alerta de Seguridad • Orden #${pedidoId}`,
                                            titulo: 'Transacción bloqueada por seguridad',
                                            mensaje: pagoInfo.motivoRechazo || 'Detectamos más de 3 intentos de cobro con esta tarjeta en menos de 10 segundos.',
                                            accionPrimariaTexto: 'Ver alerta en mi cuenta',
                                            accionPrimaria: 'perfil'
                                        };
                                    } else {
                                        this.alertaModal = {
                                            tipo: 'warning',
                                            subtitulo: `Orden #${pedidoId}`,
                                            titulo: 'Pago rechazado por el emisor',
                                            mensaje: 'No pudimos autorizar el cargo en tu medio de pago. Revisa tus notificaciones o intenta con otra tarjeta.',
                                            accionPrimariaTexto: 'Ver mis pedidos',
                                            accionPrimaria: 'perfil'
                                        };
                                    }
                                    this.cdr.detectChanges();
                                },
                                error: () => {
                                    this.alertaModal = {
                                        tipo: 'warning',
                                        subtitulo: `Orden #${pedidoId}`,
                                        titulo: 'Pago rechazado o bloqueado',
                                        mensaje: 'Revisa el detalle en la sección de notificaciones de tu cuenta.',
                                        accionPrimariaTexto: 'Ir a mi cuenta',
                                        accionPrimaria: 'perfil'
                                    };
                                    this.cdr.detectChanges();
                                }
                            });
                        } else {
                            this.alertaModal = {
                                tipo: 'info',
                                subtitulo: `Orden #${pedidoId}`,
                                titulo: 'Pago en proceso de confirmación',
                                mensaje: 'Recibimos tu solicitud de pago y la estamos procesando. Te notificaremos apenas se confirme.',
                                accionPrimariaTexto: 'Ver mis pedidos',
                                accionPrimaria: 'perfil'
                            };
                            this.iniciarPollingPedidos();
                        }
                        this.cargarNotificaciones();
                        this.cargarRecomendaciones();
                        this.cdr.detectChanges();
                        setTimeout(() => {
                          this.cargarRecomendaciones();
                          this.cargarAlertasFraude();
                          this.cargarNotificaciones();
                        }, 700);
                    },
                    error: () => {
                        this.cargarPedidos();
                        this.cargarNotificaciones();
                        this.cargarRecomendaciones();
                    }
                });
            }, 900);
        },
        error: err => {
            this.procesandoPago = false;
            console.error('Error encolando pago', err);
            this.mostrarToast('error', 'Error al enviar el pago', 'No pudimos conectar con la pasarela de pago.');
        }
      });
    });
  }

  iniciarPagoWebpayPlus() {
    if (!this.pedidoPendientePago) return;
    this.procesandoPago = true;

    this.asegurarPedidoCreado(pedido => {
      const pedidoId = pedido.id;
      const monto = Math.round(Number(pedido.total) || 0);
      const clientId = this.clientIdSanitizado;
      const transactionId = `ORD-${pedidoId}-${Date.now().toString().slice(-6)}`;

      try {
        sessionStorage.setItem('pedidos360_ultimo_pedido_items', JSON.stringify(this.itemsUltimoPedido || []));
      } catch (e) {}

      const body = {
        clientId,
        amount: monto,
        transactionId,
        pedidoId,
        returnUrl: window.location.origin
      };

      this.http.post<any>(`${this.apiUrl}/api/pagos/iniciar`, body).subscribe({
        next: data => {
          this.procesandoPago = false;
          this.mostrarModalPago = false;
          this.mostrarToast(
            'info',
            'Redirigiendo a Transbank Webpay Plus',
            `Orden #${pedidoId} por $${monto.toLocaleString('es-CL')}`
          );
          this.redirectToWebPay(data.url, data.token);
        },
        error: err => {
          this.procesandoPago = false;
          this.cargarAlertasFraude();
          this.cargarNotificaciones();
          if (err.status === 429) {
            this.mostrarModalPago = false;
            this.alertaModal = {
              tipo: 'error',
              subtitulo: `Velocity Check • Bloqueo 30 Minutos`,
              titulo: 'Cuenta bloqueada temporalmente',
              mensaje: err.error?.message || 'Demasiados intentos detectados en menos de 10 segundos. Estás bloqueado temporalmente por 30 minutos por seguridad.',
              accionPrimariaTexto: 'Ver estado en mi cuenta',
              accionPrimaria: 'perfil'
            };
          } else {
            this.mostrarToast(
              'error',
              'Error al conectar con Webpay Plus',
              err.error?.error || 'No se pudo inicializar la transacción con Transbank.'
            );
          }
          this.cdr.detectChanges();
        }
      });
    });
  }

  redirectToWebPay(url: string, tokenWs: string) {
    const form = document.createElement('form');
    form.action = url;
    form.method = 'POST';
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'token_ws';
    input.value = tokenWs;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }

  procesarRetornoWebpay(tokenWs: string) {
    this.alertaModal = {
      tipo: 'info',
      subtitulo: 'Transbank Webpay Plus',
      titulo: 'Validando transacción...',
      mensaje: 'Estamos confirmando el estado de tu pago con Transbank Webpay Plus.'
    };
    this.cdr.detectChanges();

    try {
      const guardados = sessionStorage.getItem('pedidos360_ultimo_pedido_items');
      if (guardados) {
        this.itemsUltimoPedido = JSON.parse(guardados);
        sessionStorage.removeItem('pedidos360_ultimo_pedido_items');
      }
    } catch (e) {}

    this.http.post<any>(`${this.apiUrl}/api/pagos/commit?token_ws=${encodeURIComponent(tokenWs)}`, {}).subscribe({
      next: data => {
        if (data && data.status === 'AUTHORIZED') {
          this.registrarInteraccionesCompra();
          const montoFmt = Number(data.amount || 0).toLocaleString('es-CL');
          this.alertaModal = {
            tipo: 'success',
            subtitulo: `Webpay Plus • Orden ${data.buyOrder || '#' + data.pedidoId}`,
            titulo: '¡Pago Aprobado por Transbank!',
            mensaje: `Transacción autorizada por $${montoFmt} (Código autorización: ${data.authorizationCode || 'OK'}, Tarjeta **** ${data.cardNumber || '6623'}). Tu pedido ya está en preparación.`,
            accionPrimariaTexto: 'Ver estado del pedido',
            accionPrimaria: 'perfil'
          };
        } else {
          this.alertaModal = {
            tipo: 'warning',
            subtitulo: 'Transbank Webpay Plus',
            titulo: 'Pago Rechazado',
            mensaje: data?.message || 'La transacción fue rechazada por el emisor en Webpay Plus. Los contadores de intentos han sido reiniciados.',
            accionPrimariaTexto: 'Ver mis pedidos',
            accionPrimaria: 'perfil'
          };
        }
        this.cargarPedidos();
        this.cargarNotificaciones();
        this.cargarAlertasFraude();
        this.cargarRecomendaciones();
        this.cdr.detectChanges();
      },
      error: err => {
        const body = err.error || {};
        this.alertaModal = {
          tipo: 'error',
          subtitulo: `Transbank Webpay Plus ${body.buyOrder ? '• ' + body.buyOrder : ''}`,
          titulo: 'Transacción Rechazada por Webpay',
          mensaje: body.message || 'El cargo fue rechazado por Transbank Webpay Plus. Los contadores de intentos han sido reiniciados.',
          accionPrimariaTexto: 'Ir a mi cuenta',
          accionPrimaria: 'perfil'
        };
        this.cargarPedidos();
        this.cargarNotificaciones();
        this.cargarAlertasFraude();
        this.cdr.detectChanges();
      }
    });
  }

  simularRafagaVelocityWebpay() {
    if (!this.pedidoPendientePago) return;
    this.procesandoPago = true;

    this.asegurarPedidoCreado(pedido => {
      const pedidoId = pedido.id;
      const monto = Math.round(Number(pedido.total) || 15000);
      const clientId = this.clientIdSanitizado;
      const crearBody = (idx: number) => ({
        clientId,
        amount: monto,
        transactionId: `TX-${pedidoId}-${idx}-${Date.now().toString().slice(-5)}`,
        pedidoId,
        returnUrl: window.location.origin
      });

      // Enviamos 3 intentos rápidos (<10s) a Kafka ('payment-attempts') y un 4to intento tras 450ms para verificar el bloqueo 429
      this.http.post<any>(`${this.apiUrl}/api/pagos/iniciar`, crearBody(1)).subscribe({
        next: () => {
          this.http.post<any>(`${this.apiUrl}/api/pagos/iniciar`, crearBody(2)).subscribe({
            next: () => {
              this.http.post<any>(`${this.apiUrl}/api/pagos/iniciar`, crearBody(3)).subscribe({
                next: () => {
                  setTimeout(() => {
                    this.http.post<any>(`${this.apiUrl}/api/pagos/iniciar`, crearBody(4)).subscribe({
                      next: () => {
                        this.procesandoPago = false;
                        this.mostrarModalPago = false;
                        this.cargarAlertasFraude();
                        this.cargarNotificaciones();
                        this.alertaModal = {
                          tipo: 'error',
                          subtitulo: `Kafka Velocity Check • Cliente ${clientId}`,
                          titulo: 'Bloqueo preventivo de 30 minutos activado',
                          mensaje: 'Se detectaron 3 o más intentos de pago en menos de 10 segundos en el tópico Kafka payment-attempts. El cliente fue bloqueado por 30 minutos.',
                          accionPrimariaTexto: 'Ver bloqueo en mi cuenta',
                          accionPrimaria: 'perfil'
                        };
                        this.cdr.detectChanges();
                      },
                      error: err429 => {
                        this.procesandoPago = false;
                        this.mostrarModalPago = false;
                        this.cargarAlertasFraude();
                        this.cargarNotificaciones();
                        this.cargarPedidos();
                        this.alertaModal = {
                          tipo: 'error',
                          subtitulo: `HTTP 429 Too Many Requests • Kafka Velocity Check`,
                          titulo: 'Cliente bloqueado por 30 minutos',
                          mensaje: err429.error?.message || 'Demasiados intentos detectados (3+ en menos de 10 segundos). Estás bloqueado temporalmente por 30 minutos.',
                          accionPrimariaTexto: 'Ver estado en mi cuenta',
                          accionPrimaria: 'perfil'
                        };
                        this.cdr.detectChanges();
                      }
                    });
                  }, 450);
                },
                error: () => { this.procesandoPago = false; }
              });
            },
            error: () => { this.procesandoPago = false; }
          });
        },
        error: err => {
          this.procesandoPago = false;
          if (err.status === 429) {
            this.mostrarModalPago = false;
            this.cargarAlertasFraude();
            this.alertaModal = {
              tipo: 'error',
              subtitulo: 'HTTP 429 Too Many Requests • Kafka Velocity Check',
              titulo: 'Cliente bloqueado temporalmente (30 min)',
              mensaje: err.error?.message || 'Demasiados intentos detectados. Estás bloqueado temporalmente por 30 minutos.',
              accionPrimariaTexto: 'Ver o desbloquear en mi cuenta',
              accionPrimaria: 'perfil'
            };
            this.cdr.detectChanges();
          } else {
            this.mostrarToast('error', 'Servicio de pagos no disponible', 'Intenta nuevamente en unos instantes.');
          }
        }
      });
    });
  }

  simularRafagaAntifraude() {
    if (!this.pedidoPendientePago) return;
    this.procesandoPago = true;

    this.asegurarPedidoCreado(pedido => {
      const pedidoId = pedido.id;
      const monto = pedido.total;
      const payload = {
        pedidoId,
        monto,
        metodoPago: 'TARJETA_CREDITO',
        numeroTarjeta: this.numeroTarjeta || '4532 0151 1283 4242'
      };

      // Ejecutamos 4 intentos consecutivos en < 2 segundos con la misma tarjeta
      this.http.post<any>(`${this.apiUrl}/api/pagos`, payload).subscribe({
        next: () => {
          this.http.post<any>(`${this.apiUrl}/api/pagos`, payload).subscribe({
            next: () => {
              this.http.post<any>(`${this.apiUrl}/api/pagos`, payload).subscribe({
                next: () => {
                  this.http.post<any>(`${this.apiUrl}/api/pagos`, payload).subscribe({
                    next: cuartoIntento => {
                      this.procesandoPago = false;
                      this.mostrarModalPago = false;
                      this.cargarPedidos();
                      this.cargarNotificaciones();
                      this.cargarAlertasFraude();
                      this.cargarRecomendaciones();
                      setTimeout(() => {
                        this.cargarRecomendaciones();
                        this.cargarAlertasFraude();
                        this.cargarNotificaciones();
                        this.cargarPedidos();
                      }, 600);
                      setTimeout(() => {
                        this.cargarRecomendaciones();
                        this.cargarNotificaciones();
                      }, 1500);
                      this.alertaModal = {
                        tipo: 'error',
                        subtitulo: `Protección Antifraude • Orden #${pedidoId}`,
                        titulo: 'Tarjeta bloqueada preventivamente',
                        mensaje: cuartoIntento?.motivoRechazo || 'Se detectaron 4 intentos de cobro en menos de 10 segundos con la misma tarjeta. La operación fue bloqueada por seguridad.',
                        accionPrimariaTexto: 'Ver registro de seguridad',
                        accionPrimaria: 'perfil'
                      };
                      this.cdr.detectChanges();
                    },
                    error: () => { this.procesandoPago = false; }
                  });
                },
                error: () => { this.procesandoPago = false; }
              });
            },
            error: () => { this.procesandoPago = false; }
          });
        },
        error: err => {
          this.procesandoPago = false;
          this.mostrarToast('error', 'Servicio de pagos no disponible', 'Intenta nuevamente en unos instantes.');
        }
      });
    });
  }

  private pollingInterval: any = null;

  iniciarPollingPedidos() {
    if (this.pollingInterval) return;
    this.pollingInterval = setInterval(() => {
      if (!this.loginDisplay) return;
      this.cargarPedidos();
      this.cargarNotificaciones();
      const hayPendientes = this.pedidos.some(p => p.estado === 'PENDIENTE');
      if (!hayPendientes && !this.notificacionesEnColaError && this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
    }, 4000);
  }

  cancelarPago() {
    this.mostrarModalPago = false;
    this.pedidoPendientePago = null;
    this.cdr.detectChanges();
  }

  registrarInteraccionesCompra() {
    if (!this.itemsUltimoPedido || !this.itemsUltimoPedido.length) return;
    this.itemsUltimoPedido.forEach(item => {
      const prod = this.productos.find(p => p.id === item.productoId);
      this.http.post(`${this.apiUrl}/api/analytics/interacciones`, {
        itemId: item.productoId,
        action: 'purchase',
        category: prod?.categoria || 'Hamburguesas',
        productType: prod?.nombre || 'menu-item'
      }).subscribe({
        next: () => setTimeout(() => this.cargarRecomendaciones(), 400),
        error: () => {}
      });
    });
    this.itemsUltimoPedido = [];
  }

  cargarNotificaciones() {
    this.http.get<any[]>(`${this.apiUrl}/api/notificaciones`).subscribe({
        next: data => {
            this.notificacionesEnColaError = false;
            this.notificaciones = data || [];
            this.contadorNoLeidas = (data || []).filter((n: any) => !n.leida).length;
            this.cdr.detectChanges();
        },
        error: err => {
            console.error('Error cargando notificaciones', err);
            this.notificacionesEnColaError = true;
            this.iniciarPollingPedidos();
            this.cdr.detectChanges();
        }
    });
  }

  marcarNotificacionLeida(id: number) {
    // Optimistic UI update
    const notif = this.notificaciones.find(n => n.id === id);
    if (notif) {
        notif.leida = true;
        this.contadorNoLeidas = this.notificaciones.filter((n: any) => !n.leida).length;
        this.cdr.detectChanges();
    }

    this.http.patch<any>(`${this.apiUrl}/api/notificaciones/${id}/leer`, {}).subscribe({
        next: () => this.cargarNotificaciones(),
        error: err => {
            console.error('Error marcando notificacion', err);
            // Revert if error
            if (notif) notif.leida = false;
            this.contadorNoLeidas = this.notificaciones.filter((n: any) => !n.leida).length;
            this.cdr.detectChanges();
        }
    });
  }

  cambiarEstadoPedido(pedidoId: number, nuevoEstado: string) {
    this.http.patch<any>(`${this.apiUrl}/api/pedidos/${pedidoId}/estado?estado=${nuevoEstado}`, {}).subscribe({
        next: data => {
            const etiqueta = nuevoEstado === 'ENTREGADO' ? 'marcado como recibido' : 'cancelado';
            this.mostrarToast(
              nuevoEstado === 'ENTREGADO' ? 'success' : 'info',
              `Orden #${pedidoId} ${etiqueta}`,
              'El historial de tu cuenta ha sido actualizado.'
            );
            this.cargarPedidos();
            this.cdr.detectChanges();
        },
        error: err => {
            console.error('Error actualizando pedido', err);
            this.mostrarToast('error', 'No se pudo actualizar la orden', 'Intenta nuevamente en unos segundos.');
        }
    });
  }
  // -------------------------------------

  setLoginDisplay() {
    const accounts = this.authService.instance.getAllAccounts();
    this.loginDisplay = accounts.length > 0;

    let activeAccount = this.authService.instance.getActiveAccount();
    if (!activeAccount && accounts.length > 0) {
      this.authService.instance.setActiveAccount(accounts[0]);
      activeAccount = accounts[0];
    }

    if (activeAccount) {
      this.userEmail = activeAccount.username;
      this.userProfile = {
        name: activeAccount.name,
        email: activeAccount.username,
        tenantId: activeAccount.tenantId,
        roles: activeAccount.idTokenClaims?.['roles'] || activeAccount.idTokenClaims?.['scp'] || 'Sin roles',
        oid: activeAccount.idTokenClaims?.['oid']
      };
      // Asegurar que el Access Token de los microservicios esté fresco antes de disparar las peticiones en paralelo
      this.asegurarTokenYCargar(() => {
        this.cargarDatos();
      });
    }
    this.cdr.detectChanges();
  }

  private asegurarTokenYCargar(callback: () => void) {
    const activeAccount = this.authService.instance.getActiveAccount() || this.authService.instance.getAllAccounts()[0];
    if (!activeAccount) {
      callback();
      return;
    }
    this.authService.instance.acquireTokenSilent({
      scopes: protectedResources.apiGateway.scopes,
      account: activeAccount
    }).then(() => {
      callback();
    }).catch(() => {
      callback();
    });
  }

  login() {
    if (this.msalGuardConfig.interactionType === InteractionType.Popup) {
      if (this.msalGuardConfig.authRequest) {
        this.authService.loginPopup({...this.msalGuardConfig.authRequest} as PopupRequest)
          .subscribe((response: AuthenticationResult) => {
            this.authService.instance.setActiveAccount(response.account);
          });
      } else {
        this.authService.loginPopup()
          .subscribe((response: AuthenticationResult) => {
            this.authService.instance.setActiveAccount(response.account);
          });
      }
    } else {
      if (this.msalGuardConfig.authRequest) {
        this.authService.loginRedirect({...this.msalGuardConfig.authRequest} as RedirectRequest);
      } else {
        this.authService.loginRedirect();
      }
    }
  }

  logout() {
    this.authService.logoutRedirect({
      postLogoutRedirectUri: window.location.origin
    });
  }

  ngOnDestroy(): void {
    if (this.wsMetricas) {
      this.wsMetricas.close();
      this.wsMetricas = null;
    }
    if (this.wsFallbackTimer) {
      clearInterval(this.wsFallbackTimer);
      this.wsFallbackTimer = null;
    }
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
}
