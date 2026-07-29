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

  // Array que define las opciones del menú de administración
  public adminOptions = [
    {
      title: 'Gestión de Menú',
      icon: 'book-outline',
      url: '/dashboard/administration/menu-management', // Ruta a la página de gestión de menú
      roleVerify: ['super_admin', 'admin']
    },
    {
      title: 'Gestión de Categorías',
      icon: 'pricetags-outline',
      url: '/dashboard/administration/category-management', // Ruta a la página de categorías
      roleVerify: ['super_admin', 'admin']
    },
    {
      title: 'Gestión de Mesas',
      icon: 'restaurant-outline',
      url: '/dashboard/administration/table-management', // Ruta a la página de mesas
      roleVerify: ['super_admin', 'admin']
    },
    {
      title: 'Métodos de Pago',
      icon: 'card-outline',
      url: '/dashboard/administration/payment-methods-management', // Ruta a la página de métodos de pago
      roleVerify: ['super_admin', 'admin']
    },
    {
      title: 'Gestión de Cajas',
      icon: 'cash-outline',
      url: '/dashboard/administration/cash-box-management', // Ruta a la página de cajas
      roleVerify: ['super_admin', 'admin', 'cashier']
    },
    {
      title: 'Generar reportes',
      icon: 'stats-chart-outline',
      url: '/dashboard/administration/reports', // Ruta a la página de cajas
      roleVerify: ['super_admin', 'admin', 'cashier']
    },
    {
      title: 'Personalizacion del recibo',
      icon: 'receipt-outline',
      url: '/dashboard/administration/receipt-branding',
      roleVerify: ['super_admin', 'admin', 'manager']
    }
  ];

  constructor(
    private alertCtrl: AlertController,
    private _authSerivce: AuthService,
    private toastCtrl: ToastController,
    private router: Router,
    private _store: Store<AppState>
  ) { }

  ngOnInit() {
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
