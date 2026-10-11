import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { InventoryService } from '@services/inventory.service';
import { OrdersPage } from './orders.page';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => resolve = done);
  return { promise, resolve };
}

describe('Order personalization opening guard', () => {
  let page: OrdersPage;
  let configurations: Subject<any>[];
  let dismissals: ReturnType<typeof deferred<any>>[];
  let getConfiguration: jasmine.Spy;
  let createModal: jasmine.Spy;
  let toast: jasmine.Spy;
  const product = { id: 83, categoryId: 1, name: 'Hamburguesa', price: 100, hasPersonalizations: true } as any;
  const configuration = { hasPersonalizations: true, groups: [{ id: 1, options: [] }] };
  const selection = { modifierGroupId: 1, modifierOptionId: 2, groupName: 'Adiciones', optionName: 'Extra', quantity: 1, priceAdjustment: 10 };

  beforeEach(() => {
    configurations = []; dismissals = []; toast = jasmine.createSpy('toast');
    getConfiguration = jasmine.createSpy('getConfiguration').and.callFake(() => {
      const request = new Subject<any>(); configurations.push(request); return request;
    });
    createModal = jasmine.createSpy('createModal').and.callFake(() => {
      const dismissal = deferred<any>(); dismissals.push(dismissal);
      return Promise.resolve({ present: () => Promise.resolve(),
        onDidDismiss: () => dismissal.promise,
        onWillDismiss: () => Promise.resolve({ role: 'confirmed', data: { selections: [selection] } }) });
    });
    TestBed.configureTestingModule({ providers: [{ provide: InventoryService, useValue: {} }] });
    page = TestBed.runInInjectionContext(() => new OrdersPage({ create: createModal } as any,
      {} as any, {} as any, {} as any, {} as any, { presentToast: toast } as any,
      {} as any, {} as any, {} as any, {} as any, { getProductPersonalizations: getConfiguration } as any));
    spyOn(console, 'log'); spyOn(console, 'error');
  });
  afterEach(() => page.ngOnDestroy());

  it('ignores rapid taps before configuration, creation and closing; then permits a new selection', fakeAsync(() => {
    void page.addItem(product);
    for (let index = 0; index < 30; index++) void page.addItem(product);
    expect(getConfiguration).toHaveBeenCalledTimes(1);
    expect(page.isPersonalizationInProgress).toBeTrue();
    configurations[0].next(configuration); flushMicrotasks();
    expect(createModal).toHaveBeenCalledTimes(1);
    // WillDismiss has already resolved in this mock. The lock must wait for DidDismiss.
    void page.addItem(product); flushMicrotasks();
    expect(createModal).toHaveBeenCalledTimes(1);
    expect(page.currentOrder.length).toBe(0);
    dismissals[0].resolve({ role: 'confirmed', data: { selections: [selection] } }); flushMicrotasks();
    expect(page.currentOrder[0].quantity).toBe(1);
    expect(page.orderTotal).toBe(110);
    expect(page.isPersonalizationInProgress).toBeFalse();
    void page.addItem(product); flushMicrotasks();
    expect(createModal).toHaveBeenCalledTimes(2);
    dismissals[1].resolve({ role: 'confirmed', data: { selections: [selection] } }); flushMicrotasks();
    expect(page.currentOrder[0].quantity).toBe(2);
    expect(page.orderTotal).toBe(220);
  }));

  it('guards different personalized products too and unlocks after cancellation without adding a line', fakeAsync(() => {
    void page.addItem(product);
    void page.addItem({ ...product, id: 84 });
    expect(getConfiguration).toHaveBeenCalledTimes(1);
    configurations[0].next(configuration); flushMicrotasks();
    dismissals[0].resolve({ role: 'cancel' }); flushMicrotasks();
    expect(page.currentOrder).toEqual([]);
    expect(page.isPersonalizationInProgress).toBeFalse();
    void page.addItem({ ...product, id: 84 });
    expect(getConfiguration).toHaveBeenCalledTimes(2);
    configurations[1].next(configuration); flushMicrotasks();
    dismissals[1].resolve({ role: 'cancel' }); flushMicrotasks();
  }));

  it('unlocks after a configuration failure and permits retry', fakeAsync(() => {
    void page.addItem(product); configurations[0].error(new Error('Test configuration failure')); flushMicrotasks();
    expect(page.isPersonalizationInProgress).toBeFalse();
    expect(toast).toHaveBeenCalledTimes(1);
    void page.addItem(product); expect(getConfiguration).toHaveBeenCalledTimes(2);
    configurations[1].next(configuration); flushMicrotasks();
    dismissals[0].resolve({ role: 'cancel' }); flushMicrotasks();
  }));

  it('unlocks after a modal creation failure and permits retry', fakeAsync(() => {
    createModal.and.returnValue(Promise.reject(new Error('Test modal failure')));
    void page.addItem(product); configurations[0].next(configuration); flushMicrotasks();
    expect(page.isPersonalizationInProgress).toBeFalse();
    expect(toast).toHaveBeenCalledTimes(1);
    createModal.and.callFake(() => Promise.resolve({ present: () => Promise.resolve(),
      onDidDismiss: () => Promise.resolve({ role: 'cancel' }) }));
    void page.addItem(product); flushMicrotasks();
    expect(createModal).toHaveBeenCalledTimes(2);
    expect(page.isPersonalizationInProgress).toBeFalse();
  }));

  it('preserves repeated additions of products without personalizations and unlocks an empty configuration', fakeAsync(() => {
    const simple = { ...product, hasPersonalizations: false };
    void page.addItem(simple); void page.addItem(simple);
    expect(page.currentOrder[0].quantity).toBe(2);
    expect(createModal).not.toHaveBeenCalled();
    void page.addItem({ ...product, id: 84 });
    configurations[0].next({ hasPersonalizations: false, groups: [] }); flushMicrotasks();
    expect(page.isPersonalizationInProgress).toBeFalse();
    expect(page.currentOrder.length).toBe(2);
  }));
});
