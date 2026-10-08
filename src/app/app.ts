import { Component, OnInit, OnDestroy, Inject, ChangeDetectorRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MsalService, MsalBroadcastService, MSAL_GUARD_CONFIG, MsalGuardConfiguration } from '@azure/msal-angular';
import { AuthenticationResult, InteractionStatus, InteractionType, PopupRequest, RedirectRequest } from '@azure/msal-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
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
  isCartOpen: boolean = false;
  isProfileOpen: boolean = false;
  abrirPerfil() {
    this.isProfileOpen = true;
    this.notificaciones.filter(n => !n.leida).forEach(n => this.marcarNotificacionLeida(n.id));
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
    this.authService.instance.initialize().then(() => {
      this.authService.handleRedirectObservable().subscribe({
        next: (result: AuthenticationResult | null) => {
          if (result) {
            this.authService.instance.setActiveAccount(result.account);
            this.sincronizarUsuario();
            this.setLoginDisplay();
          }
          // Limpiar la URL de hashes feos o query params de MSAL
          window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
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
     this.http.post(`${environment.apiGatewayUrl}/api/v1/auth/login`, {}).subscribe({
         next: (res) => {
             console.log('Usuario sincronizado con backend', res);
             this.cargarDatos();
         },
         error: (err) => console.error('Error sincronizando usuario', err)
     });
  }

  cargarDatos() {
    this.http.get<any[]>(`${environment.apiGatewayUrl}/api/productos`).subscribe({
        next: data => {
            this.productos = data;
            this.cdr.detectChanges();
        },
        error: err => console.error('Error cargando productos', err)
    });
    this.http.get<any>(`${environment.apiGatewayUrl}/api/carrito`).subscribe({
        next: data => {
            this.carrito = data;
            this.cdr.detectChanges();
        },
        error: err => console.error('Error cargando carrito', err)
    });
    this.cargarPedidos();
    this.cargarNotificaciones();
  }

  agregarAlCarrito(producto: any) {
    const dto = { productoId: producto.id, cantidad: 1 };
    this.http.post<any>(`${environment.apiGatewayUrl}/api/carrito/items`, dto).subscribe({
        next: data => {
            this.carrito = data;
            this.cdr.detectChanges();
            
            // SweetAlert2 Toast notification
            Swal.fire({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
              icon: 'success',
              title: `¡${producto.nombre} añadido al carrito!`
            });
        },
        error: err => console.error('Error agregando al carrito', err)
    });
  }

  eliminarDelCarrito(productoId: string) {
    this.http.delete<any>(`${environment.apiGatewayUrl}/api/carrito/items/${productoId}`).subscribe(data => {
        this.carrito = data;
        this.cdr.detectChanges();
    });
  }

  // --- NUEVAS FUNCIONES PARA PEDIDOS ---
  pedidos: any[] = [];

  // Estado de pagos y notificaciones
  notificaciones: any[] = [];
  contadorNoLeidas: number = 0;
  mostrarModalPago: boolean = false;
  pedidoPendientePago: any = null;
  metodoPagoSeleccionado: string = 'TARJETA_CREDITO';
  procesandoPago: boolean = false;
  
  cargarPedidos() {
    this.http.get<any[]>(`${environment.apiGatewayUrl}/api/pedidos`).subscribe({
        next: data => {
            this.pedidos = data;
            this.cdr.detectChanges();
        },
        error: err => console.error('Error cargando pedidos', err)
    });
  }

  crearPedido() {
    if (!this.carrito || !this.carrito.items || this.carrito.items.length === 0) {
      alert('El carrito esta vacio');
      return;
    }

    this.http.post<any>(`${environment.apiGatewayUrl}/api/pedidos`, {}).subscribe({
        next: data => {
            this.pedidoPendientePago = data;
            this.carrito = { items: [] };
            this.cargarPedidos();
            this.mostrarModalPago = true;
            this.cdr.detectChanges();
        },
        error: err => {
            console.error('Error creando pedido', err);
            alert('Hubo un error al crear tu pedido.');
        }
    });
  }

  confirmarPago() {
    if (!this.pedidoPendientePago) return;
    this.procesandoPago = true;

    const dto = {
      pedidoId: this.pedidoPendientePago.id,
      monto: this.pedidoPendientePago.total,
      metodoPago: this.metodoPagoSeleccionado
    };

    this.http.post<any>(`${environment.apiGatewayUrl}/api/pagos`, dto).subscribe({
        next: data => {
            this.procesandoPago = false;
            this.mostrarModalPago = false;
            if (data.estado === 'APROBADO') {
                alert('Pago aprobado! Tu pedido #' + data.pedidoId + ' esta en preparacion. Codigo: ' + data.codigoTransaccion);
            } else {
                alert('Pago rechazado. Por favor intenta con otro metodo.');
            }
            this.cargarPedidos();
            this.cargarNotificaciones();
            this.cdr.detectChanges();
        },
        error: err => {
            this.procesandoPago = false;
            console.error('Error procesando pago', err);
            alert('Error al procesar el pago.');
        }
    });
  }

  cancelarPago() {
    this.mostrarModalPago = false;
    this.pedidoPendientePago = null;
    this.cdr.detectChanges();
  }

  cargarNotificaciones() {
    this.http.get<any[]>(`${environment.apiGatewayUrl}/api/notificaciones`).subscribe({
        next: data => {
            this.notificaciones = data;
            this.contadorNoLeidas = data.filter((n: any) => !n.leida).length;
            this.cdr.detectChanges();
        },
        error: err => console.error('Error cargando notificaciones', err)
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

    this.http.patch<any>(`${environment.apiGatewayUrl}/api/notificaciones/${id}/leer`, {}).subscribe({
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
    this.http.patch<any>(`${environment.apiGatewayUrl}/api/pedidos/${pedidoId}/estado?estado=${nuevoEstado}`, {}).subscribe({
        next: data => {
            alert("El pedido " + pedidoId + " ahora está " + nuevoEstado);
            this.cargarPedidos();
            this.cdr.detectChanges();
        },
        error: err => {
            console.error('Error actualizando pedido', err);
            alert("Hubo un error al actualizar el estado.");
        }
    });
  }
  // -------------------------------------

  setLoginDisplay() {
    console.log('Cambiando estado de loginDisplay a:', this.authService.instance.getAllAccounts().length > 0);
    this.loginDisplay = this.authService.instance.getAllAccounts().length > 0;
    
    let activeAccount = this.authService.instance.getActiveAccount();
    if (!activeAccount && this.authService.instance.getAllAccounts().length > 0) {
      let accounts = this.authService.instance.getAllAccounts();
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
      // Forzar carga de datos y refresco
      this.cargarDatos();
    }
    this.cdr.detectChanges();
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
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
}
