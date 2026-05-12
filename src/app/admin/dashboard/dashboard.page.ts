import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { ModalController } from '@ionic/angular';
import { NameOfClientComponent } from 'src/app/components/name-of-client/name-of-client.component';
import { selectUserCompanyName } from '@store/auth/selectors/auth.selectors';
import { Store } from '@ngrx/store';
import { AppState } from '@capacitor/app';
import { firstValueFrom, Observable, Subscription, take } from 'rxjs';
import { TableI, TableService } from '@services/table.service';
import { AudioPlayerService } from '@services/audio-player.service';
import * as OrdersActions from '@store/orders/actions/orders.actions';
import { OrdersRealtimeService } from '@services/orders-realtime.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit {

  // Aquí deberías tener tu lista de mesas. Puede venir de un servicio.
  allTables: TableI[] = [];
  private ordersSubscription!: Subscription;
  pendingOrders: number = 0;

  companyName: Observable<string | null> = this.store.select(selectUserCompanyName);

  constructor(
    private router: Router,
    private modalCtrl: ModalController,
    private store: Store<AppState>,
    private _tableService: TableService,
    public _audioPlayerService: AudioPlayerService,
    private _ordersRealtimeService: OrdersRealtimeService,
  ) {
  }

  async ngOnInit() {
    this.enableSounds();
    this.subscribeToOrders();
  }

  // NUEVA función para manejar el cierre del modal
  onTableSelect(event: any) {
    // El evento contiene los datos en la propiedad 'detail'
    const data = event.detail.data;
    const role = event.detail.role;

    if (role === 'confirm') {
      this.store.dispatch(OrdersActions.setOrderTableOrTakeAway({ table: data }));
    } else {
      console.log('Modal cerrado sin selección.');
    }
  }

  // Se ejecuta cuando la página está a punto de mostrarse
  async ionViewWillEnter() {
    // ✅ PASO CLAVE: Resetea el estado de la orden actual al entrar al dashboard.
    // Esto asegura que cada nueva orden comience desde un estado limpio.
    this.store.dispatch(OrdersActions.resetCurrentOrder());
    // Mantener desbloqueada por defecto
    // Asegurar que la orientación esté desbloqueada para permitir rotación libre
    await this.unlockOrientation();

    this._ordersRealtimeService.init();
  }

  // Se ejecuta cuando la página está a punto de desaparecer
  async ionViewWillLeave() {
    // Mantener desbloqueada por defecto
    await this.unlockOrientation();
    this._ordersRealtimeService.shutdown();
  }

  subscribeToOrders() {
    this.ordersSubscription = this._ordersRealtimeService.orders$.subscribe(orders => {
      this.pendingOrders = orders.length;
    });
  }

  /**
   * Desbloquea la orientación de la pantalla, permitiendo que rote libremente.
   */
  async unlockOrientation() {
    try {
      await ScreenOrientation.unlock();
      console.log('Orientación de pantalla desbloqueada.');
    } catch (error) {
      console.error('No se pudo desbloquear la orientación:', error);
    }
  }

  /**
   * Bloquea la pantalla en modo horizontal (paisaje) - OPCIONAL
   * Solo usar cuando sea estrictamente necesario para ciertas funcionalidades
   */
  async lockToLandscape() {
    try {
      await ScreenOrientation.lock({ orientation: 'landscape' });
      console.log('Pantalla bloqueada en modo horizontal.');
    } catch (error) {
      console.error('No se pudo bloquear la orientación:', error);
    }
  }

  /**
   * Bloquea la pantalla en modo vertical (portrait) - OPCIONAL
   */
  async lockToPortrait() {
    try {
      await ScreenOrientation.lock({ orientation: 'portrait' });
      console.log('Pantalla bloqueada en modo vertical.');
    } catch (error) {
      console.error('No se pudo bloquear la orientación:', error);
    }
  }

  /**
   * Navega a la vista seleccionada.
   * Asegúrate de que las rutas ('/tabs/waiter', etc.) coincidan
   * con la configuración de tu archivo de enrutamiento (tabs.router.module.ts).
   */
  navigateTo(view: string) {
    // Las rutas deben estar definidas en tu módulo de enrutamiento
    // Por ejemplo: /tabs/waiter, /tabs/kitchen, /tabs/summary
    this.router.navigateByUrl(`/tabs/${view}`);
  }

  changeTab() {
    console.log("Click on tab");
  }

  /**
   * Abre el modal para solicitar el nombre del cliente.
   * @param isRequired Define si el campo de nombre es obligatorio.
   */
  async openClientNameModal(isRequired: boolean) {
    // Creamos el modal usando el ModalController
    const modal = await this.modalCtrl.create({
      component: NameOfClientComponent, // El componente del modal
      componentProps: {
        isRequired: isRequired // Pasamos el parámetro para la validación
      },
      // ¡Esta es la clave! Asignamos el ID para que los estilos del Canvas se apliquen.
      id: 'name-of-client-modal',
    });

    // Presentamos el modal en pantalla
    await modal.present();

    // Esperamos a que el modal se cierre para recibir los datos
    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      this.store.dispatch(OrdersActions.setNameOrder({ customerName: data }));
      this.store.dispatch(OrdersActions.setOrderTableOrTakeAway({ table: { orderType: 'takeaway', tableId: null } }))

    } else {
      console.log('Modal de nombre de cliente cerrado.');
    }
  }

  /**
   * Ir a la vista de meseros
   */
  openWaiterPage() {
    this.router.navigate(['/dashboard/waiters']);
  }

  /**
   * Ir a la vista de cocina
   */
  openKitchehPage() {
    this.router.navigate(['/dashboard/kitchen']);
  }

  /**
   * ir a la vista de resumen
   */
  openSummaryPage() {
    this.router.navigate(['/dashboard/summary']);
  }

  /**
   * Ir a la vista de administración
   */
  openAdministrationPage() {
    this.router.navigate(['/dashboard/administration']);
  }

  async callTables() {
    try {
      this.allTables = await firstValueFrom(this._tableService.getTables(true));
    } catch (error) {
      console.error('Error al cargar las mesas:', error);
      // Opcional: Manejar el error, por ejemplo, mostrando un mensaje al usuario.
    }
  }

  enableSounds() {
    if (!this._audioPlayerService.audioContext) {
      this._audioPlayerService.unlockAudio();
    }
  }

  /**
 * ⚙️ Este método ahora "escucha" el cierre del modal de tablas
 */
  async onModalDismiss(event: any) {
    const table: TableI = event;
    // Aquí va tu lógica para manejar la mesa seleccionada
    this.store.dispatch(OrdersActions.setOrderTableOrTakeAway({ table: { orderType: 'dine_in', tableId: table.id } }));
    await this.modalCtrl.dismiss(table, 'confirm');
  }

}