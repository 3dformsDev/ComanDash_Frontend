import { WaitersPage } from './waiters.page';
import { of } from 'rxjs';

describe('WaitersPage', () => {
  let component: WaitersPage;
  let alertOptions: any;
  let realtimeService: {
    syncOrder: jasmine.Spy;
    refreshOrders: jasmine.Spy;
  };
  let orderService: {
    markAsServedOrder: jasmine.Spy;
  };

  beforeEach(() => {
    realtimeService = {
      syncOrder: jasmine.createSpy('syncOrder'),
      refreshOrders: jasmine.createSpy('refreshOrders'),
    };
    orderService = {
      markAsServedOrder: jasmine.createSpy('markAsServedOrder'),
    };

    component = new WaitersPage(
      null as any,
      realtimeService as any,
      orderService as any,
      null as any,
      { presentToast: jasmine.createSpy('presentToast') } as any,
      {
        create: jasmine.createSpy('create').and.callFake((options: any) => {
          alertOptions = options;
          return Promise.resolve({
            present: jasmine.createSpy('present'),
          });
        }),
      } as any,
      null as any,
      null as any,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('never includes a cancelled order in the paid tab', () => {
    component.currentFilter = 'paid';
    component.pendingOrders = [
      {
        id: 1,
        status: 'paid',
        paidAt: '2026-07-18T20:00:00.000-05:00',
        isReadyToServe: true,
        isServed: true,
      },
      {
        id: 2,
        status: 'cancelled',
        paidAt: '2026-07-18T20:00:00.000-05:00',
        isReadyToServe: true,
        isServed: true,
      },
    ] as any;

    component.applyFilters();

    expect(component.filteredOrders.map((order) => order.id)).toEqual([1]);
  });

  it('shows a paid table order only after the table is released', () => {
    component.currentFilter = 'paid';
    const paidOrder = {
      id: 3,
      status: 'paid',
      paidAt: '2026-07-23T03:48:22.000Z',
      isReadyToServe: true,
      isServed: true,
      tableId: 5,
      table: { isBussy: true },
    } as any;

    component.pendingOrders = [paidOrder];
    component.applyFilters();
    expect(component.filteredOrders).toEqual([]);

    component.pendingOrders = [
      {
        ...paidOrder,
        isFreedTable: true,
        table: { isBussy: false },
      },
    ];
    component.applyFilters();

    expect(component.filteredOrders.map((order) => order.id)).toEqual([3]);
  });

  it('syncs the authoritative response after marking an order as served', async () => {
    const readyOrder = {
      id: 10,
      orderNumber: 4,
      orderType: 'takeaway',
      orderItems: [],
      isAdvancePayment: false,
      isReadyToServe: true,
      isServed: false,
    } as any;
    const servedOrder = {
      ...readyOrder,
      isServed: true,
      orderItems: [{ id: 1, kitchenStatus: 'served' }],
    };
    orderService.markAsServedOrder.and.returnValue(of(servedOrder));

    await component.markAsServed(readyOrder);
    alertOptions.buttons[1].handler();

    expect(realtimeService.syncOrder).toHaveBeenCalledOnceWith(servedOrder);
  });

  it('uses the server order when a payment is completed', () => {
    component.pendingOrders = [
      {
        id: 20,
        orderType: 'takeaway',
        orderItems: [],
        isAdvancePayment: false,
        status: 'pending',
        isReadyToServe: true,
        isServed: true,
      },
    ] as any;
    const serverPaidAt = '2026-07-22T01:15:00.000-05:00';

    const result = (component as any).applyPaymentSummaryToOrder(
      20,
      {
        totalAmount: 15000,
        paidAmount: 15000,
        pendingAmount: 0,
        isFullyPaid: true,
      },
      { id: 20, status: 'paid', paidAt: serverPaidAt },
    );

    expect(result).toEqual(
      jasmine.objectContaining({ status: 'paid', paidAt: serverPaidAt }),
    );
    expect(realtimeService.syncOrder).toHaveBeenCalledWith(result);
  });

  it('does not mark a partially paid order as paid', () => {
    component.pendingOrders = [
      {
        id: 21,
        orderType: 'takeaway',
        orderItems: [],
        isAdvancePayment: false,
        status: 'pending',
        isReadyToServe: true,
        isServed: true,
      },
    ] as any;

    const result = (component as any).applyPaymentSummaryToOrder(21, {
      totalAmount: 15000,
      paidAmount: 5000,
      pendingAmount: 10000,
      isFullyPaid: false,
    });

    expect(result.status).toBe('pending');
    expect(result.paidAt).toBeUndefined();
  });
});
