import { Injectable } from '@angular/core';
import { AppState } from '@capacitor/app';
import { Store } from '@ngrx/store';
import { Order } from '@store/orders/orders.state';
import { BehaviorSubject, combineLatest, distinctUntilChanged, Subscription } from 'rxjs';
import { SocketService } from './socket.service';
import { OrderService } from './order.service';
import { selectCurrentCompanyId, selectLocationId } from '@store/auth/selectors/auth.selectors';

@Injectable({ providedIn: 'root' })
export class KitchenRealtimeService {
  private kitchenOrdersSubject = new BehaviorSubject<Order[]>([]);
  public kitchenOrders$ = this.kitchenOrdersSubject.asObservable();
  private listenersSubscription?: Subscription;
  private orderEventsSubscription?: Subscription;
  private refreshSubscription?: Subscription;
  private closedOrderIds = new Set<number>();
  private revision = 0;
  private companyId?: number;
  private locationId?: number;

  constructor(private _orderService: OrderService, private _socketService: SocketService,
    private store: Store<AppState>) { }

  private isClosed(order: Order): boolean {
    return order.status === 'cancelled' || order.status === 'served' ||
      Boolean(order.isServed) || Boolean((order as Order & { servedAt?: string }).servedAt) ||
      (order.status === 'paid' && !order.isPrepaid && !order.isAdvancePayment);
  }

  private isVisible(order: Order): boolean {
    return !this.closedOrderIds.has(Number(order.id)) && !this.isClosed(order) && !order.isReadyToServe &&
      (!order.companyId || order.companyId === this.companyId) &&
      (!(order as any).locationId || (order as any).locationId === this.locationId) &&
      (order.orderItems || []).some(item => ['pending', 'in_preparation'].includes(item.kitchenStatus || ''));
  }

  public init(): void {
    this.shutdown();
    this.listenersSubscription = combineLatest([
      this.store.select(selectCurrentCompanyId), this.store.select(selectLocationId), this._socketService.isConnected$,
    ]).pipe(distinctUntilChanged((previous, current) => previous.every((value, index) => value === current[index])))
      .subscribe(([companyId, locationId, connected]) => {
        this.orderEventsSubscription?.unsubscribe();
        this.refreshSubscription?.unsubscribe();
        if (!companyId || !locationId) return;
        if (companyId !== this.companyId || locationId !== this.locationId) {
          this.closedOrderIds.clear();
          this.kitchenOrdersSubject.next([]);
        }
        this.companyId = companyId;
        this.locationId = locationId;
        if (connected) {
          this.setupOrderEventListeners();
          this._socketService.emit('join_kitchen_room', { companyId, locationId });
        }
        this.refreshOrders();
      });
  }

  private upsert(order: Order): void {
    this.revision++;
    const current = this.kitchenOrdersSubject.getValue().filter(existing => existing.id !== order.id);
    if (this.isVisible(order)) current.push(order);
    this.kitchenOrdersSubject.next(current);
  }

  private remove(orderId: number, terminal = false): void {
    this.revision++;
    if (terminal) this.closedOrderIds.add(orderId);
    this.kitchenOrdersSubject.next(this.kitchenOrdersSubject.getValue().filter(order => order.id !== orderId));
  }

  private setupOrderEventListeners(): void {
    this.orderEventsSubscription?.unsubscribe();
    const events = this.orderEventsSubscription = new Subscription();
    events.add(this._socketService.listen('new_order').subscribe((order: Order) => this.upsert(order)));
    events.add(this._socketService.listen('order_updated_for_kitchen').subscribe((order: Order) =>
      this.upsert({ ...order, justUpdated: true })));
    events.add(this._socketService.listen('order_is_cancelled').subscribe((order: Order) =>
      this.remove(Number(order.id), true)));
    events.add(this._socketService.listen('order_removed').subscribe((id: number) => this.remove(Number(id))));
    events.add(this._socketService.listen('order_is_served').subscribe((order: Order) =>
      this.remove(Number(order.id), order.status === 'paid')));
    events.add(this._socketService.listen('order_payment_completed').subscribe((order: Order) => {
      if (this.isClosed(order)) this.remove(Number(order.id), true);
    }));
    events.add(this._socketService.listen('order_updated').subscribe((order: Order) => {
      if (this.isClosed(order)) this.remove(Number(order.id), order.status === 'paid' || order.status === 'cancelled');
    }));
    events.add(this._socketService.listen('operation_error').subscribe((error: { orderId?: number }) => {
      if (error.orderId) this.refreshOrders();
    }));
    events.add(this._socketService.listen('kitchen_item_updated').subscribe((data: {
      orderId: number; itemId: number; newStatus: boolean; kitchenStatus?: string;
    }) => {
      this.revision++;
      this.kitchenOrdersSubject.next(this.kitchenOrdersSubject.getValue().map(order => {
        if (order.id !== data.orderId || this.isClosed(order)) return order;
        return { ...order, orderItems: order.orderItems.map(item => {
          if (item.id !== data.itemId || ['ready', 'served'].includes(item.kitchenStatus || '')) return item;
          return { ...item, kitchenStatus: data.newStatus ? 'pending' : 'in_preparation' };
        }) };
      }));
    }));
  }

  public shutdown(): void {
    this.listenersSubscription?.unsubscribe();
    this.orderEventsSubscription?.unsubscribe();
    this.refreshSubscription?.unsubscribe();
    this.listenersSubscription = undefined;
    this.orderEventsSubscription = undefined;
    this.refreshSubscription = undefined;
    this.closedOrderIds.clear();
    this.companyId = undefined;
    this.locationId = undefined;
    this.revision++;
    this.kitchenOrdersSubject.next([]);
  }

  public refreshOrders(): void {
    this.refreshSubscription?.unsubscribe();
    const revision = this.revision;
    this.refreshSubscription = this._orderService.getPendingKitchenOrders().subscribe({
      next: orders => {
        // A response started before a socket mutation must not resurrect an old card.
        if (revision !== this.revision) { this.refreshOrders(); return; }
        this.kitchenOrdersSubject.next((orders || []).filter(order => this.isVisible(order)));
      },
      error: () => console.warn('No se pudo actualizar la lista de cocina.'),
    });
  }

  public notifyItemStatusChange(orderId: number, itemId: number, newStatus: boolean): void {
    const order = this.kitchenOrdersSubject.getValue().find(order => order.id === orderId);
    const item = order?.orderItems.find(item => item.id === itemId);
    if (!order || !item || this.isClosed(order) || order.isReadyToServe || ['ready', 'served'].includes(item.kitchenStatus || '')) return;
    this._socketService.emit('item_status_changed', { orderId, itemId, newStatus });
  }
}
