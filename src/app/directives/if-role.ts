import { Directive, Input, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { User } from '@store/auth/auth.state';
import { Store, select } from '@ngrx/store';
import { selectUser } from '@store/auth/selectors/auth.selectors'; // Asegúrate de tener este selector

@Directive({
  selector: '[ifRole]',
  standalone: true,
})
export class IfRoleDirective implements OnInit, OnDestroy {
  private allowedRoles: string[] = [];
  private subscription: Subscription | undefined;
  private hasView = false;
  private currentUser: User | null = null;

  constructor(
    private viewContainer: ViewContainerRef,
    private templateRef: TemplateRef<any>,
    // ✅ CAMBIO: Inyectamos el Store de NgRx en lugar de AuthService
    private store: Store
  ) { }

  /**
   * Setter para el input 'ifRole'.
   * Recibe el rol o la lista de roles permitidos desde el HTML.
   * Ej: *ifRole="'super_admin'" o *ifRole="['admin', 'supervisor']"
   */
  @Input()
  set ifRole(roles: string | string[]) {
    this.allowedRoles = Array.isArray(roles) ? roles : [roles];
    // Forzar la re-evaluación usando el último usuario conocido del store
    this.updateView(this.currentUser);
  }

  ngOnInit() {
    // ✅ CAMBIO: Nos suscribimos al selector del usuario en el store
    this.subscription = this.store.pipe(select(selectUser)).subscribe((user: User | null) => {
      this.currentUser = user; // Guardamos el usuario actual
      this.updateView(this.currentUser);
    });
  }

  /**
   * Método principal que decide si mostrar u ocultar el elemento.
   */
  private updateView(user: User | null) {
    const userHasRole = user && user.role ? this.checkRole(user.role.code) : false;

    if (userHasRole) {
      if (!this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      }
    } else {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }

  /**
   * Comprueba si el código de rol del usuario está en la lista de roles permitidos.
   */
  private checkRole(userRoleCode: string): boolean {
    if (!userRoleCode || !this.allowedRoles || this.allowedRoles.length === 0) {
      return false;
    }
    return this.allowedRoles.includes(userRoleCode);
  }

  /**
   * Limpiamos la suscripción para evitar fugas de memoria cuando el componente se destruye.
   */
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}

