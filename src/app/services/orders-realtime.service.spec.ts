import { OrdersRealtimeService } from './orders-realtime.service';
import {
  BehaviorSubject,
  Observable,
  of,
  Subject,
  Subscriber,
  throwError,
} from 'rxjs';
import {
  selectCurrentCompanyId,
  selectLocationId,
} from '@store/auth/selectors/auth.selectors';

describe('OrdersrealtimeService', () => {
  let service: OrdersRealtimeService;
  let latestOrders: any[];
  let orderService: { getActiveWaiterOrders: jasmine.Spy };
  let socketEvents: Record<string, Subject<any>>;
  let connectionStatus: BehaviorSubject<boolean>;
  let socketService: {
    isConnected$: BehaviorSubject<boolean>;
    emit: jasmine.Spy;
    listen: jasmine.Spy;
  };
  let store: { select: jasmine.Spy };

  beforeEach(() => {
    orderService = {
      getActiveWaiterOrders: jasmine
        .createSpy('getActiveWaiterOrders')
        .and.returnValue(of([])),
    };
    socketEvents = {};
    connectionStatus = new BehaviorSubject<boolean>(true);
    socketService = {
      isConnected$: connectionStatus,
      emit: jasmine.createSpy('emit'),
      listen: jasmine.createSpy('listen').and.callFake((eventName: string) => {
        socketEvents[eventName] ||= new Subject<any>();
        return socketEvents[eventName].asObservable();
      }),
    };
    store = {
      select: jasmine.createSpy('select').and.callFake((selector: unknown) => {
        if (selector === selectCurrentCompanyId) {
          return new BehaviorSubject<number>(11);
        }

        if (selector === selectLocationId) {
          return new BehaviorSubject<number>(1);
        }

        throw new Error('Selector no contemplado en la prueba.');
      }),
    };

    service = new OrdersRealtimeService(
      orderService as any,
      socketService as any,
      store as any,
    );
    service.orders$.subscribe((orders) => (latestOrders = orders));
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('merges an authoritative order response without duplicating it', () => {
    service.syncOrder({ id: 1, status: 'pending' } as any);
    service.syncOrder({ id: 1, status: 'paid', paidAt: 'paid-now' } as any);

    expect(latestOrders.length).toBe(1);
    expect(latestOrders[0]).toEqual(
      jasmine.objectContaining({ id: 1, status: 'paid', paidAt: 'paid-now' }),
    );
  });

  it('clears orders when the current cash register session is closed', () => {
    service.syncOrder({ id: 2, status: 'paid' } as any);
    service.init('waiters');

    socketEvents['cash_register_closed'].next({ id: 90, status: 'closed' });

    expect(latestOrders).toEqual([]);
  });

  it('clears stale orders when there is no open cash register session', () => {
    service.syncOrder({ id: 3, status: 'paid' } as any);
    orderService.getActiveWaiterOrders.and.returnValue(
      throwError(() => ({ status: 403 })),
    );

    service.refreshOrders();

    expect(latestOrders).toEqual([]);
  });

  it('retains the last state during an unrelated network failure', () => {
    spyOn(console, 'error');
    service.syncOrder({ id: 4, status: 'paid' } as any);
    orderService.getActiveWaiterOrders.and.returnValue(
      throwError(() => ({ status: 500 })),
    );

    service.refreshOrders();

    expect(latestOrders.map((order) => order.id)).toEqual([4]);
  });

  it('keeps waiter listeners active when dashboard leaves during navigation', () => {
    service.init('dashboard');
    service.init('waiters');
    service.shutdown('dashboard');

    socketEvents['order_is_ready'].next({
      id: 217,
      status: 'pending',
      isReadyToServe: true,
    });

    expect(latestOrders).toEqual([
      jasmine.objectContaining({
        id: 217,
        isReadyToServe: true,
      }),
    ]);
  });

  it('does not cancel the active orders request when ownership moves to waiters', () => {
    let requestSubscriber!: Subscriber<any[]>;
    let requestWasCancelled = false;

    orderService.getActiveWaiterOrders.and.returnValue(
      new Observable<any[]>((subscriber) => {
        requestSubscriber = subscriber;

        return () => {
          requestWasCancelled = true;
        };
      }),
    );

    service.init('dashboard');
    service.init('waiters');
    service.shutdown('dashboard');

    expect(requestWasCancelled).toBeFalse();

    requestSubscriber.next([
      {
        id: 217,
        status: 'pending',
        isReadyToServe: true,
      },
      {
        id: 218,
        status: 'pending',
        isReadyToServe: true,
      },
    ]);

    expect(latestOrders.map((order) => order.id)).toEqual([217, 218]);
  });

  it('stops listeners only after the last active consumer leaves', () => {
    service.init('dashboard');
    service.init('waiters');
    service.shutdown('dashboard');
    service.shutdown('waiters');

    socketEvents['order_is_ready'].next({
      id: 218,
      isReadyToServe: true,
    });

    expect(latestOrders).toEqual([]);
  });

  it('does not cancel the initial load when the socket connects for the first time', () => {
    connectionStatus.next(false);

    service.init('waiters');
    connectionStatus.next(true);

    expect(orderService.getActiveWaiterOrders).toHaveBeenCalledTimes(1);
  });

  it('refreshes active orders after a real socket reconnection', () => {
    service.init('waiters');

    connectionStatus.next(false);
    connectionStatus.next(true);

    expect(orderService.getActiveWaiterOrders).toHaveBeenCalledTimes(2);
  });
});
