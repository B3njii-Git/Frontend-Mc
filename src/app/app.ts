import { Component, OnInit, OnDestroy, Inject, ChangeDetectorRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MsalService, MsalBroadcastService, MSAL_GUARD_CONFIG, MsalGuardConfiguration } from '@azure/msal-angular';
import { AuthenticationResult, InteractionStatus, InteractionType, PopupRequest, RedirectRequest } from '@azure/msal-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

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
  }

  agregarAlCarrito(producto: any) {
    const dto = { productoId: producto.id, cantidad: 1 };
    this.http.post<any>(`${environment.apiGatewayUrl}/api/carrito/items`, dto).subscribe(data => {
        this.carrito = data;
        this.cdr.detectChanges();
    });
  }

  eliminarDelCarrito(productoId: string) {
    this.http.delete<any>(`${environment.apiGatewayUrl}/api/carrito/items/${productoId}`).subscribe(data => {
        this.carrito = data;
        this.cdr.detectChanges();
    });
  }

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
