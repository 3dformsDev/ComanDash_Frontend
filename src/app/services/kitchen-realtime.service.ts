import { Injectable } from '@angular/core';
import { AppState } from '@capacitor/app';
import { Store } from '@ngrx/store';
import { Order } from '@store/orders/orders.state';
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, Subscription, switchMap, take, tap } from 'rxjs';
import { SocketService } from './socket.service';
import { OrderService } from './order.service';
import { selectCurrentCompanyId, selectIsAuthenticated, selectLocationId } from '@store/auth/selectors/auth.selectors';

@Injectable({
  providedIn: 'root'
})
export class KitchenRealtimeService {
  private kitchenOrdersSubject = new BehaviorSubject<Order[]>([]);
  public kitchenOrders$ = this.kitchenOrdersSubject.asObservable();

  // ✅ Variables para gestionar las suscripciones
  private listenersSubscription: Subscription | undefined;
  // ✅ NUEVO: Suscripción específica para los eventos de órdenes
  private orderEventsSubscription: Subscription | undefined;

  constructor(
    private _orderService: OrderService,
    private _socketService: SocketService,
    private store: Store<AppState>
  ) { }

  /**
     * ✅ MÉTODO PÚBLICO: Inicia los listeners y carga los datos iniciales.
     * El componente (KitchenPage) llamará a este método.
     */
  public init() {
    console.log('▶️ KitchenRealtimeService.init() llamado.');

    if (this.listenersSubscription) {
      this.listenersSubscription.unsubscribe();
    }

    this.refreshOrders();

    this.listenersSubscription = combineLatest([
      this.store.select(selectCurrentCompanyId),
      this.store.select(selectLocationId)
    ]).pipe(
      filter(([companyId, locationId]) => !!companyId && !!locationId),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      // Usamos tap para el efecto secundario de unirnos a la sala
      // sin interferir con el flujo de datos.
      tap(([companyId, locationId]) => {
        this._socketService.emit('join_kitchen_room', { companyId, locationId });
        // ✅ Una vez unidos a la sala, configuramos los listeners
        this.setupOrderEventListeners();
      })
    ).subscribe();
  }

  /**
   * ✅ NUEVO MÉTODO: Centraliza la configuración de los listeners de socket.
   */
  private setupOrderEventListeners(): void {
    // Si ya hay una suscripción a eventos, la cancelamos para evitar duplicados
    if (this.orderEventsSubscription) {
      this.orderEventsSubscription.unsubscribe();
    }

    // Creamos una nueva suscripción que engloba todos los eventos de órdenes
    this.orderEventsSubscription = new Subscription();

    // Listener para NUEVAS órdenes (lógica existente)
    const newOrderSub = this._socketService.listen('new_order').subscribe((newOrder: Order) => {
      const currentOrders = this.kitchenOrdersSubject.getValue();
      const orderExists = currentOrders.some(order => order.id === newOrder.id);
      if (!orderExists) {
        this.kitchenOrdersSubject.next([...currentOrders, newOrder]);
      }
    });

    // ✅ Listener para ÓRDENES ACTUALIZADAS (nueva lógica)
    const updatedOrderSub = this._socketService.listen('order_updated_for_kitchen').subscribe((updatedOrder: Order) => {
      const currentOrders = this.kitchenOrdersSubject.getValue();

      // Buscamos si la orden actualizada ya existe en nuestro estado local
      const existingOrderIndex = currentOrders.findIndex(order => order.id === updatedOrder.id);

      if (existingOrderIndex > -1) {
        // Si existe, la reemplazamos de forma inmutable
        const newOrders = [...currentOrders];
        newOrders[existingOrderIndex] = { ...updatedOrder, justUpdated: true };
        this.kitchenOrdersSubject.next(newOrders);
      } else {
        // Edge case: si por alguna razón no la teníamos, la añadimos.
        this.kitchenOrdersSubject.next([...currentOrders, updatedOrder]);
      }
    });

    const cancelledOrderSub = this._socketService.listen('order_is_cancelled').subscribe((cancelledOrder: Order) => {
      // Obtenemos el estado actual
      const currentOrders = this.kitchenOrdersSubject.getValue();

      // Creamos un nuevo array excluyendo la orden que fue cancelada
      const newOrders = currentOrders.filter(order => order.id !== cancelledOrder.id);

      // Emitimos la nueva lista sin la orden cancelada
      this.kitchenOrdersSubject.next(newOrders);
    });

    // ✅ NUEVO LISTENER: Escucha las actualizaciones de estado de un ítem específico.
    // Listener para ACTUALIZACIONES DE ÍTEMS
    const itemStatusSub = this._socketService.listen('kitchen_item_updated')
      .subscribe((data: { orderId: number, itemId: number, newStatus: boolean }) => {

        const currentOrders = this.kitchenOrdersSubject.getValue();

        // ✅ INICIO DE LA LÓGICA DE INMUTABILIDAD
        // Creamos un array de órdenes completamente nuevo usando .map()
        const updatedOrders = currentOrders.map(order => {
          // Si esta no es la orden que cambió, la devolvemos tal cual.
          if (order.id !== data.orderId) {
            return order;
          }

          // Si es la orden correcta, creamos un nuevo objeto para ella
          // y también un nuevo array para sus 'orderItems'.
          return {
            ...order, // Copiamos las propiedades de la orden
            orderItems: order.orderItems.map((item: any) => {
              // Si este no es el ítem que cambió, lo devolvemos tal cual.
              if (item.id !== data.itemId) {
                return item;
              }

              // Si es el ítem correcto, creamos un nuevo objeto para él
              // con la propiedad 'isReady' actualizada.
              return {
                ...item, // Copiamos las propiedades del ítem
                // ✅ ACTUALIZAMOS LA FUENTE DE VERDAD
                kitchenStatus: data.newStatus ? 'pending' : 'in_preparation',

                // Mantenemos la actualización de isReady para consistencia
                isReady: data.newStatus
              };
            })
          };
        });
        // ✅ FIN DE LA LÓGICA DE INMUTABILIDAD

        // Emitimos la lista completamente nueva. Angular ahora SÍ detectará el cambio.
        this.kitchenOrdersSubject.next(updatedOrders);
      });

    // ✅ NUEVO LISTENER: Escucha cuando una orden se despacha y debe quitarse de la vista de cocina.
    const removedOrderSub = this._socketService.listen('order_removed')
      .subscribe((orderId: number) => { // Tu backend emite solo el ID, lo cual es perfecto.

        // Obtenemos la lista actual de órdenes
        const currentOrders = this.kitchenOrdersSubject.getValue();

        // Creamos un nuevo array inmutable, filtrando la orden que se acaba de ir
        const updatedOrders = currentOrders.filter(order => order.id !== orderId);

        // Emitimos la nueva lista. TODOS los componentes suscritos se actualizarán.
        this.kitchenOrdersSubject.next(updatedOrders);
      });

    // Añadimos las suscripciones individuales a la suscripción principal de eventos
    this.orderEventsSubscription.add(newOrderSub);
    this.orderEventsSubscription.add(updatedOrderSub);
    this.orderEventsSubscription.add(cancelledOrderSub);
    this.orderEventsSubscription.add(itemStatusSub);
    this.orderEventsSubscription.add(removedOrderSub);
  }
  /**
   * ✅ MÉTODO PÚBLICO: Limpia las suscripciones y el estado.
   * El componente (KitchenPage) llamará a este método al salir.
   */
  public shutdown() {
    if (this.listenersSubscription) {
      this.listenersSubscription.unsubscribe();
      this.listenersSubscription = undefined; // Limpiamos la referencia
    }
    // ✅ También nos damos de baja de los eventos de órdenes
    if (this.orderEventsSubscription) {
      this.orderEventsSubscription.unsubscribe();
      this.orderEventsSubscription = undefined;
    }
    this.kitchenOrdersSubject.next([]); // Opcional: limpiar las órdenes al salir
  }

  // Método para refrescar manualmente las órdenes (se queda igual)
  public refreshOrders() {
    this._orderService.getPendingKitchenOrders().subscribe(orders => {
      this.kitchenOrdersSubject.next(orders);
    });
  }

  /**
   * ✅ NUEVO MÉTODO: Emite un evento al backend cuando el estado de un ítem cambia.
   */
  public notifyItemStatusChange(orderId: number, itemId: number, newStatus: boolean): void {
    console.log(`🚀 Emitiendo cambio de estado: orderId=${orderId}, itemId=${itemId}, newStatus=${newStatus}`);
    this._socketService.emit('item_status_changed', { orderId, itemId, newStatus });
  }
}