import { Subject, of } from 'rxjs';
import { KitchenPage } from './kitchen.page';

describe('Kitchen page readiness and ampliacion', () => {
  let orders: Subject<any[]>;
  let notify: jasmine.Spy;
  let dispatch: jasmine.Spy;
  let page: KitchenPage;
  const order = (items: any[]) => ({ id: 1858, createdAt: new Date().toISOString(), orderItems: items });
  const item = (id: number, status: string) => ({ id, kitchenStatus: status, product: { name: 'Hamburguesa' } });
  beforeEach(() => {
    orders = new Subject(); notify = jasmine.createSpy('notify'); dispatch = jasmine.createSpy('dispatch').and.returnValue(of({}));
    page = new KitchenPage({ kitchenOrders$: orders, notifyItemStatusChange: notify } as any,
      { markAsReadyOrder: dispatch } as any);
    page.subscribeToOrders();
  });
  afterEach(() => page.ngOnDestroy());
  it('permits checking/unchecking the current batch and keeps all checked items visible until dispatch', () => {
    orders.next([order([item(1, 'in_preparation'), item(2, 'ready')])]);
    expect(page.pendingOrders[0].orderItems[0].isReady).toBeFalse();
    expect(page.isOrderReady(page.pendingOrders[0])).toBeFalse();
    page.toggleItemReady(page.pendingOrders[0], page.pendingOrders[0].orderItems[0]);
    expect(notify).toHaveBeenCalledWith(1858, 1, true);
    orders.next([order([item(1, 'pending'), item(2, 'ready')])]);
    expect(page.pendingOrders.length).toBe(1);
    expect(page.isOrderReady(page.pendingOrders[0])).toBeTrue();
    expect(page.isKitchenItemLocked(page.pendingOrders[0].orderItems[0])).toBeFalse();
    page.toggleItemReady(page.pendingOrders[0], page.pendingOrders[0].orderItems[0]);
    expect(notify).toHaveBeenCalledWith(1858, 1, false);
    orders.next([order([item(1, 'in_preparation'), item(2, 'ready')])]);
    expect(page.isOrderReady(page.pendingOrders[0])).toBeFalse();
    orders.next([order([item(1, 'pending'), item(2, 'ready')])]);
    page.dispatchOrder(1858);
    expect(dispatch).toHaveBeenCalledWith(1858);
  });
  it('locks old served items in an ampliacion and emits checks for new products in both views', () => {
    orders.next([order([item(1, 'served'), item(2, 'in_preparation'), item(3, 'ready')])]);
    const current = page.pendingOrders[0];
    page.toggleItemReady(current, current.orderItems[0]);
    page.toggleItemReady(current, current.orderItems[2]); expect(notify).not.toHaveBeenCalled();
    page.toggleItemReady(current, current.orderItems[1]); expect(notify).toHaveBeenCalledWith(1858, 2, true);
    notify.calls.reset(); page.markProductAsReady('Hamburguesa');
    expect(notify.calls.allArgs()).toEqual([[1858, 2, true]]);
    expect(current.orderItems[0].kitchenStatus).toBe('served');
  });
});
