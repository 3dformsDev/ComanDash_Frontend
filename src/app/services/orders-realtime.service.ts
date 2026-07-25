import { Injectable } from '@angular/core';
import { AppState } from '@capacitor/app';
import { Store } from '@ngrx/store';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  Subscription,
} from 'rxjs';
import { Order } from '@store/orders/orders.state';
import {
  selectCurrentCompanyId,
  selectLocationId,
} from '@store/auth/selectors/auth.selectors';
import { OrderService } from './order.service';
import { SocketService } from './socket.service';

export type OrdersRealtimeConsumer = 'dashboard' | 'waiters';

@Injectable({
  providedIn: 'root',
})
export class OrdersRealtimeService {
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  public orders$ = this.ordersSubject.asObservable();

  private lifecycleSubscription = new Subscription();
  private socketListenersSubscription = new Subscription();
  private loadSubscription?: Subscription;
  private currentContext?: { companyId: number; locationId: number };
  private activeConsumers = new Set<OrdersRealtimeConsumer>();
  private initialized = false;
  private wasConnected = false;
  private hasConnectedOnce = false;

  constructor(
    private _orderService: OrderService,
    private _socketService: SocketService,
    private store: Store<AppState>,
  ) {}

  public init(consumer: OrdersRealtimeConsumer): void {
    if (this.activeConsumers.has(consumer)) {
      return;
    }

    this.activeConsumers.add(consumer);

    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.clearOrders();

    const contextSubscription = combineLatest([
      this.store.select(selectCurrentCompanyId),
      this.store.select(selectLocationId),
      this._socketService.isConnected$,
    ])
      .pipe(
        filter(
          ([companyId, locationId]) =>
            Number(companyId) > 0 && Number(locationId) > 0,
        ),
        distinctUntilChanged(
          (previous, current) =>
            Number(previous[0]) === Number(current[0]) &&
            Number(previous[1]) === Number(current[1]) &&
            previous[2] === current[2],
        ),
      )
      .subscribe(([companyId, locationId, isConnected]) => {
        const nextContext = {
          companyId: Number(companyId),
          locationId: Number(locationId),
        };
        const contextChanged =
          !this.currentContext ||
          this.currentContext.companyId !== nextContext.companyId ||
          this.currentContext.locationId !== nextContext.locationId;
        const reconnected =
          isConnected &&
          this.hasConnectedOnce &&
          !this.wasConnected &&
          !contextChanged;

        this.currentContext = nextContext;

        if (contextChanged) {
          this.hasConnectedOnce = isConnected;
          this.refreshOrders();
        }

        if (isConnected) {
          this.attachSocketListeners();
          this._socketService.emit('join_kitchen_room', nextContext);

          if (reconnected) {
            this.refreshOrders();
          }

          this.hasConnectedOnce = true;
        }

        this.wasConnected = isConnected;
      });

    this.lifecycleSubscription.add(contextSubscription);
  }

  public shutdown(consumer: OrdersRealtimeConsumer): void {
    const consumerWasActive = this.activeConsumers.delete(consumer);

    if (!consumerWasActive || this.activeConsumers.size > 0) {
      return;
    }

    this.lifecycleSubscription.unsubscribe();
    this.lifecycleSubscription = new Subscription();

    this.socketListenersSubscription.unsubscribe();
    this.socketListenersSubscription = new Subscription();

    this.loadSubscription?.unsubscribe();
    this.loadSubscription = undefined;
    this.currentContext = undefined;
    this.initialized = false;
    this.wasConnected = false;
    this.hasConnectedOnce = false;
  }

  public refreshOrders(): void {
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this._orderService.getActiveWaiterOrders().subscribe({
      next: (orders) => this.ordersSubject.next(orders),
      error: (error) => {
        if (error?.status === 403) {
          this.clearOrders();
          return;
        }

        console.error('No se pudieron actualizar las comandas:', error);
      },
    });
  }

  public syncOrder(order: Order): void {
    this.updateOrAddOrder(order);
  }

  public clearOrders(): void {
    this.ordersSubject.next([]);
  }

  private attachSocketListeners(): void {
    this.socketListenersSubscription.unsubscribe();
    this.socketListenersSubscription = new Subscription();

    const events = [
      'order_in_proccess',
      'order_is_ready',
      'order_is_served',
      'order_updated',
      'order_payment_completed',
      'table_is_free',
      'order_is_cancelled',
    ];

    events.forEach((eventName) => {
      this.socketListenersSubscription.add(
        this._socketService
          .listen(eventName)
          .subscribe((order: Order) => this.updateOrAddOrder(order)),
      );
    });

    this.socketListenersSubscription.add(
      this._socketService
        .listen('cash_register_closed')
        .subscribe(() => this.clearOrders()),
    );
  }

  private updateOrAddOrder(order: Order): void {
    if (!order?.id) {
      return;
    }

    const current = this.ordersSubject.getValue();
    const existingOrder = current.find((item) => item.id === order.id);

    if (!existingOrder) {
      this.ordersSubject.next([...current, order]);
      return;
    }

    this.ordersSubject.next(
      current.map((item) =>
        item.id === order.id ? { ...item, ...order } : item,
      ),
    );
  }
}
