import { Injectable } from '@angular/core';
import { OrderService } from './order.service';
import { SocketService } from './socket.service';
import { AppState } from '@capacitor/app';
import { Store } from '@ngrx/store';
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, Subscription, take } from 'rxjs';
import { Order } from '@store/orders/orders.state';
import { selectCurrentCompanyId, selectLocationId } from '@store/auth/selectors/auth.selectors';

@Injectable({
  providedIn: 'root'
})
export class OrdersRealtimeService {

  private ordersSubject = new BehaviorSubject<Order[]>([]);
  public orders$ = this.ordersSubject.asObservable();

  // ✅ Propiedad para gestionar la suscripción
  private listenersSubscription: Subscription | undefined;

  constructor(
    private _orderService: OrderService,
    private _socketService: SocketService,
    private store: Store<AppState>
  ) { }

  /**
   * ✅ MÉTODO PÚBLICO: Lo llamará el componente desde ionViewWillEnter
   */
  public init() {
    console.log('▶️ OrdersRealtimeService.init() llamado.');

    // Prevenimos suscripciones duplicadas
    if (this.listenersSubscription) {
      this.listenersSubscription.unsubscribe();
    }

    // Carga las órdenes iniciales
    this._orderService.getActiveWaiterOrders().subscribe(initialOrders => {
      this.ordersSubject.next(initialOrders);
    });

    // Establece todos los listeners
    this.listenersSubscription = combineLatest([
      this.store.select(selectCurrentCompanyId),
      this.store.select(selectLocationId)
    ]).pipe(
      filter(([companyId, locationId]) => !!companyId && !!locationId),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      // ❌ SIN take(1)
    ).subscribe(([companyId, locationId]) => {
      console.log(`[OrdersRealtime] Uniéndose a la sala: company-${companyId}, location-${locationId}`);
      // Asumo que el mesero y la cocina pueden compartir sala, o puedes crear una 'waiter_room'
      this._socketService.emit('join_kitchen_room', { companyId, locationId });

      // ✅ Re-adjuntamos los listeners cada vez que init() es llamado.
      // Socket.IO es inteligente y no duplica los listeners si la referencia a la función es la misma,
      // pero al estar dentro de una nueva suscripción, es más seguro gestionarlo así.
      this.setupSocketListeners();
    });
  }

  /**
   * ✅ MÉTODO PÚBLICO: Lo llamará el componente desde ionViewWillLeave
   */
  public shutdown() {
    console.log('⏹️ OrdersRealtimeService.shutdown() llamado.');
    if (this.listenersSubscription) {
      this.listenersSubscription.unsubscribe();
      this.listenersSubscription = undefined;
    }
    // Opcional: podrías emitir un evento para salir de la sala del socket aquí si es necesario
    // this._socketService.emit('leave_waiter_room', ...);
  }

  // ✅ Método privado para organizar los listeners
  private setupSocketListeners() {
    // Listener para ÓRDENES ACTUALIZADAS (en proceso)
    this._socketService.listen('order_in_proccess').subscribe((updatedOrder: Order) => {
      this.updateOrAddOrder(updatedOrder);
    });

    // Listener para ÓRDENES LISTAS
    this._socketService.listen('order_is_ready').subscribe((updatedOrder: Order) => {
      this.updateOrAddOrder(updatedOrder);
    });

    // Listener para ÓRDENES SERVIDAS
    this._socketService.listen('order_is_served').subscribe((servedOrder: Order) => {
      this.updateOrAddOrder(servedOrder);
    });

    // Listener para ÓRDENES PAGADAS
    this._socketService.listen('order_payment_completed').subscribe((paidOrder: Order) => {
      this.updateOrAddOrder(paidOrder);
    });

    // Listener para MESA LIBERADA
    this._socketService.listen('table_is_free').subscribe((orderWithFreeTable: Order) => {
      this.updateOrAddOrder(orderWithFreeTable);
    });

    this._socketService.listen('order_is_cancelled').subscribe((cancelledOrder: Order) => {
      console.log(`❌ Orden cancelada recibida en realtime de meseros: #${cancelledOrder.orderNumber}`);
      this.updateOrAddOrder(cancelledOrder);
    });
  }

  // ✅ Helper para no repetir código
  private updateOrAddOrder(order: Order) {
    const current = this.ordersSubject.getValue();
    const index = current.findIndex(o => o.id === order.id);

    if (index !== -1) {
      current[index] = { ...current[index], ...order };
      this.ordersSubject.next([...current]);
    } else {
      this.ordersSubject.next([...current, order]);
    }
  }
}
