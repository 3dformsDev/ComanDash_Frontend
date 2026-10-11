import { BehaviorSubject, Subject } from 'rxjs';
import { KitchenRealtimeService } from './kitchen-realtime.service';
import { selectCurrentCompanyId, selectLocationId } from '@store/auth/selectors/auth.selectors';

describe('Kitchen realtime safety', () => {
  let service: KitchenRealtimeService;
  let connected: BehaviorSubject<boolean>;
  let company: BehaviorSubject<number>;
  let location: BehaviorSubject<number>;
  let events: Map<string, Subject<any>>;
  let requests: Subject<any[]>[];
  let emit: jasmine.Spy;
  let snapshot: any[];
  const order = (overrides: any = {}) => ({ id: 1858, companyId: 14, locationId: 3, status: 'pending',
    isServed: false, isReadyToServe: false, isPrepaid: false, isAdvancePayment: false,
    orderItems: [{ id: 5722, productId: 83, kitchenStatus: 'in_preparation' }], ...overrides });
  const event = (name: string) => {
    if (!events.has(name)) events.set(name, new Subject<any>());
    return events.get(name)!;
  };
  const respond = (orders: any[]) => requests[requests.length - 1].next(orders);

  beforeEach(() => {
    connected = new BehaviorSubject(true); company = new BehaviorSubject(14); location = new BehaviorSubject(3);
    events = new Map(); requests = []; emit = jasmine.createSpy('emit'); snapshot = [];
    service = new KitchenRealtimeService({ getPendingKitchenOrders: () => {
      const request = new Subject<any[]>(); requests.push(request); return request;
    } } as any, { isConnected$: connected, emit, listen: (name: string) => event(name) } as any,
    { select: (selector: any) => selector === selectCurrentCompanyId ? company :
      selector === selectLocationId ? location : new BehaviorSubject(null) } as any);
    service.kitchenOrders$.subscribe(orders => snapshot = orders);
    service.init();
  });
  afterEach(() => service.shutdown());

  it('filters finished/paid regular/cancelled orders while preserving prepaid kitchen orders', () => {
    respond([order(), order({ id: 2, status: 'paid', isServed: true }), order({ id: 3, status: 'cancelled' }),
      order({ id: 4, status: 'paid' }), order({ id: 5, status: 'paid', isPrepaid: true }),
      order({ id: 6, isReadyToServe: true }), order({ id: 7, isServed: true })]);
    expect(snapshot.map(order => order.id)).toEqual([1858, 5]);
  });

  it('keeps checked items visible until dispatch; late item events never regress served items', () => {
    respond([order({ orderItems: [{ id: 5722, kitchenStatus: 'in_preparation' }, { id: 5723, kitchenStatus: 'served' }] })]);
    event('kitchen_item_updated').next({ orderId: 1858, itemId: 5722, newStatus: true });
    expect(snapshot.length).toBe(1);
    expect(snapshot[0].orderItems[0].kitchenStatus).toBe('pending');
    event('kitchen_item_updated').next({ orderId: 1858, itemId: 5722, newStatus: false });
    expect(snapshot[0].orderItems[0].kitchenStatus).toBe('in_preparation');
    event('kitchen_item_updated').next({ orderId: 1858, itemId: 5723, newStatus: false });
    expect(snapshot[0].orderItems[1].kitchenStatus).toBe('served');
    event('order_removed').next(1858);
    expect(snapshot).toEqual([]);
  });

  it('retires completed orders and prevents delayed creation/update events from resurrecting them', () => {
    respond([order()]);
    event('order_payment_completed').next(order({ status: 'paid', isServed: true }));
    event('new_order').next(order()); event('order_updated_for_kitchen').next(order());
    expect(snapshot).toEqual([]);
  });

  it('permits an unpaid ampliacion after serving and preserves the locked old items', () => {
    respond([order()]); event('order_is_served').next(order({ isServed: true }));
    event('order_updated_for_kitchen').next(order({ orderItems: [
      { id: 5722, kitchenStatus: 'served' }, { id: 5723, kitchenStatus: 'in_preparation' },
    ] }));
    service.notifyItemStatusChange(1858, 5722, false);
    expect(emit).not.toHaveBeenCalledWith('item_status_changed', jasmine.anything());
    service.notifyItemStatusChange(1858, 5723, true);
    expect(emit).toHaveBeenCalledWith('item_status_changed', { orderId: 1858, itemId: 5723, newStatus: true });
  });

  it('rejoins and reloads on reconnect without duplicate listeners; shutdown cancels all subscriptions', () => {
    respond([order()]); connected.next(false);
    expect(event('kitchen_item_updated').observers.length).toBe(0);
    connected.next(true); respond([order()]);
    expect(emit.calls.allArgs().filter(args => args[0] === 'join_kitchen_room').length).toBe(2);
    expect(event('kitchen_item_updated').observers.length).toBe(1);
    service.init(); expect(event('kitchen_item_updated').observers.length).toBe(1);
    service.shutdown();
    events.forEach(subject => expect(subject.observers.length).toBe(0));
    requests.forEach(subject => expect(subject.observers.length).toBe(0));
  });

  it('a stale HTTP response cannot resurrect a card removed while the request was pending', () => {
    const stale = requests[0]; event('order_removed').next(1858);
    stale.next([order()]);
    expect(requests.length).toBe(2);
    expect(snapshot).toEqual([]);
    respond([]); expect(snapshot).toEqual([]);
  });

  it('switches tenant context cleanly and refreshes authoritative data after a rejected event', () => {
    respond([order()]); company.next(11); location.next(1);
    expect(snapshot).toEqual([]);
    respond([order(), order({ id: 2, companyId: 11, locationId: 1 })]);
    expect(snapshot.map(order => order.id)).toEqual([2]);
    const before = requests.length;
    event('operation_error').next({ orderId: 2, code: 'KITCHEN_ORDER_CLOSED' });
    expect(requests.length).toBe(before + 1);
    respond([]); expect(snapshot).toEqual([]);
  });
});


describe('Kitchen old dispatched item protection', () => {
  it('ignores stale unchecks on ready items while allowing the current batch to change', () => {
    const events = new Map<string, Subject<any>>();
    const getEvent = (name: string) => {
      if (!events.has(name)) events.set(name, new Subject<any>());
      return events.get(name)!;
    };
    const request = new Subject<any[]>(); const emit = jasmine.createSpy('emit');
    const service = new KitchenRealtimeService({ getPendingKitchenOrders: () => request } as any,
      { isConnected$: new BehaviorSubject(true), listen: getEvent, emit } as any,
      { select: (selector: any) => new BehaviorSubject(selector === selectCurrentCompanyId ? 14 : 3) } as any);
    let snapshot: any[] = []; service.kitchenOrders$.subscribe(orders => snapshot = orders); service.init();
    request.next([{ id: 1, companyId: 14, locationId: 3, status: 'pending', orderItems: [
      { id: 10, kitchenStatus: 'ready' }, { id: 11, kitchenStatus: 'pending' },
    ] }]);
    service.notifyItemStatusChange(1, 10, false);
    expect(emit).not.toHaveBeenCalledWith('item_status_changed', jasmine.anything());
    getEvent('kitchen_item_updated').next({ orderId: 1, itemId: 10, newStatus: false });
    expect(snapshot[0].orderItems[0].kitchenStatus).toBe('ready');
    service.notifyItemStatusChange(1, 11, false);
    expect(emit).toHaveBeenCalledWith('item_status_changed', { orderId: 1, itemId: 11, newStatus: false });
    service.shutdown();
  });
});
