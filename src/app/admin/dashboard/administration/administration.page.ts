import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppState } from '@capacitor/app';
import { AlertController, ToastController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { AuthService } from '@services/auth.service';
import * as AuthActions from '@store/auth/actions/auth.actions';

@Component({
  selector: 'app-administration',
  templateUrl: './administration.page.html',
  styleUrls: ['./administration.page.scss'],
  standalone: false,
})
export class AdministrationPage implements OnInit {
  private readonly expandedSectionStorageKey = 'comandash.admin.expanded-section';
  public expandedSectionId = 'products';

  public adminSections = [
    {
      id: 'products', title: 'Productos y menú', description: 'Productos, categorías y opciones', icon: 'fast-food-outline', roleVerify: ['super_admin', 'admin'],
      options: [
        { title: 'Gestión de Menú', icon: 'book-outline', url: '/dashboard/administration/menu-management', roleVerify: ['super_admin', 'admin'] },
        { title: 'Gestión de Categorías', icon: 'pricetags-outline', url: '/dashboard/administration/category-management', roleVerify: ['super_admin', 'admin'] },
        { title: 'Personalizaciones', icon: 'options-outline', url: '/dashboard/administration/personalizations', roleVerify: ['super_admin', 'admin'] },
      ],
    },
    {
      id: 'operation', title: 'Operación', description: 'Mesas, pagos y cajas', icon: 'storefront-outline', roleVerify: ['super_admin', 'admin', 'cashier'],
      options: [
        { title: 'Gestión de Mesas', icon: 'restaurant-outline', url: '/dashboard/administration/table-management', roleVerify: ['super_admin', 'admin'] },
        { title: 'Métodos de Pago', icon: 'card-outline', url: '/dashboard/administration/payment-methods-management', roleVerify: ['super_admin', 'admin'] },
        { title: 'Gestión de Cajas', icon: 'cash-outline', url: '/dashboard/administration/cash-box-management', roleVerify: ['super_admin', 'admin', 'cashier'] },
      ],
    },
    {
      id: 'reports', title: 'Reportes', description: 'Consulta el desempeño del negocio', icon: 'stats-chart-outline', roleVerify: ['super_admin', 'admin', 'cashier'],
      options: [
        { title: 'Generar reportes', icon: 'bar-chart-outline', url: '/dashboard/administration/reports', roleVerify: ['super_admin', 'admin', 'cashier'] },
      ],
    },
    {
      id: 'settings', title: 'Configuración', description: 'Ajustes generales del sistema', icon: 'settings-outline', roleVerify: ['super_admin', 'admin', 'manager'],
      options: [
        { title: 'Personalización del recibo', icon: 'receipt-outline', url: '/dashboard/administration/receipt-branding', roleVerify: ['super_admin', 'admin', 'manager'] },
      ],
    },
  ];

  constructor(
    private alertCtrl: AlertController,
    private _authSerivce: AuthService,
    private toastCtrl: ToastController,
    private router: Router,
    private _store: Store<AppState>
  ) { }

  ngOnInit() {
    const storedSection = localStorage.getItem(this.expandedSectionStorageKey);
    if (storedSection && this.adminSections.some((section) => section.id === storedSection)) {
      this.expandedSectionId = storedSection;
    }
  }

  toggleSection(sectionId: string): void {
    this.expandedSectionId = this.expandedSectionId === sectionId ? '' : sectionId;
    if (this.expandedSectionId) {
      localStorage.setItem(this.expandedSectionStorageKey, this.expandedSectionId);
    } else {
      localStorage.removeItem(this.expandedSectionStorageKey);
    }
  }

  sectionIsExpanded(sectionId: string): boolean {
    return this.expandedSectionId === sectionId;
  }

  // ✅ MÉTODO CREADO
  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar',
      message: '¿Estás seguro de que quieres cerrar la sesión?',
      cssClass: ['confirmation-action-alert', 'logout-confirmation-alert'],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-secondary-action',
        },
        {
          text: 'Cerrar Sesión',
          role: 'destructive',
          cssClass: 'alert-primary-action',
          handler: async () => {
            this._store.dispatch(AuthActions.logout());
            // try {
            //   await firstValueFrom(this._authSerivce.logout());
            //   this.router.navigate(['/login']);
            // } catch (err: any) {
            //   this.presentToast(`No se pudo cerrar sesión ${JSON.stringify(err.error?.message || err)}`, 'danger');
            // }
          },
        },
      ],
    });

    await alert.present();
  }

  // Muestra un mensaje temporal (toast)
  async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: color
    });
    toast.present();
  }
}
