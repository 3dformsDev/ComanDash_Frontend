import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { selectUser } from '@store/auth/selectors/auth.selectors';
import { User } from '@store/auth/auth.state';
import { InventoryService, InventorySnapshot, inventoryDemand, inventoryMissingForDraft } from './inventory.service';
import { SocketService } from './socket.service';

describe('Inventory request and refresh safety', () => {
  let service: InventoryService; let http: HttpTestingController; let store: MockStore;
  const user = { id: 1, company: {id: 1}, location: {id: 1}, role: {code: 'admin'} } as User;
  const snapshot: InventorySnapshot = { asOf: '2026-09-10T12:00:00Z', canManage: true, role: 'admin', components: [], data: [] };
  beforeEach(() => {
    sessionStorage.removeItem('comandash.inventory.pending');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      provideMockStore({ selectors: [{ selector: selectUser, value: user }] }),
      { provide: SocketService, useValue: { inventoryChanged$: new Subject<void>(), isConnected$: new BehaviorSubject(false) } }] });
    service = TestBed.inject(InventoryService); http = TestBed.inject(HttpTestingController); store = TestBed.inject(MockStore);
  });
  afterEach(() => { http.verify(); sessionStorage.removeItem('comandash.inventory.pending'); });
  it('coalesces simultaneous confirmations but permits a later intentional identical receipt', () => {
    const first: any[] = []; const second: any[] = [];
    service.receipt({lines: []}).subscribe((v) => first.push(v));
    service.receipt({lines: []}).subscribe((v) => second.push(v));
    const request = http.expectOne(`${service.url}/receipts`); const key = request.request.headers.get('Idempotency-Key');
    request.flush({operationId: 1});
    expect(first).toEqual(second); expect(first.length).toBe(1);
    service.receipt({lines: []}).subscribe();
    const next = http.expectOne(`${service.url}/receipts`); expect(next.request.headers.get('Idempotency-Key')).not.toBe(key); next.flush({operationId: 2});
  });
  it('waits for the authenticated account before assigning an idempotency key', () => {
    store.overrideSelector(selectUser, null); store.refreshState();
    service.receipt({lines: []}).subscribe();
    expect(http.match(`${service.url}/receipts`).length).toBe(0);
    store.overrideSelector(selectUser, user); store.refreshState();
    const request = http.expectOne(`${service.url}/receipts`);
    expect(request.request.headers.get('Idempotency-Key')).toBeTruthy();
    request.flush({operationId: 1});
  });
  it('retries an uncertain result using the same key and preserves it for a manual retry', fakeAsync(() => {
    const body = {lines: [{productId: 1, quantity: 3, unitCost: 2}]};
    service.receipt(body).subscribe({error: () => {}});
    const first = http.expectOne(`${service.url}/receipts`); const key = first.request.headers.get('Idempotency-Key');
    body.lines[0].quantity = 100;
    expect(first.request.body.lines[0].quantity).toBe(3);
    first.error(new ProgressEvent('network')); tick(350);
    const retry = http.expectOne(`${service.url}/receipts`); expect(retry.request.headers.get('Idempotency-Key')).toBe(key);
    expect(retry.request.body.lines[0].quantity).toBe(3); retry.flush({}, {status: 500, statusText: 'Unavailable'});
    service.receipt({lines: [{productId: 1, quantity: 3, unitCost: 2}]}).subscribe();
    const manual = http.expectOne(`${service.url}/receipts`); expect(manual.request.headers.get('Idempotency-Key')).toBe(key); manual.flush({operationId: 1});
  }));
  it('requeries when a committed movement arrives during an older balance request', fakeAsync(() => {
    const values: any[] = []; const subscription = service.watch().subscribe((s) => values.push(s)); tick(0);
    const old = http.expectOne(`${service.url}/balances`); service.refresh();
    expect(old.cancelled).toBeTrue(); const fresh = http.expectOne(`${service.url}/balances`); fresh.flush(snapshot);
    expect(values[values.length - 1]).toEqual(snapshot); subscription.unsubscribe();
  }));
  it('clears the previous tenant snapshot immediately when the account changes', fakeAsync(() => {
    const values: any[] = []; const subscription = service.watch().subscribe((s) => values.push(s)); tick(0);
    http.expectOne(`${service.url}/balances`).flush(snapshot);
    store.overrideSelector(selectUser, {...user, id: 2, role: {...user.role!, code: 'waiter'}}); store.refreshState();
    expect(values[values.length - 1]).toBeUndefined(); tick(0);
    http.expectOne(`${service.url}/balances`).flush({...snapshot, canManage: false, role: 'waiter'});
    expect(values[values.length - 1].canManage).toBeFalse(); subscription.unsubscribe();
  }));
  it('adds direct and combo quantities and ignores a disabled control', () => {
    const data = [{productId: 1, enabled: true}, {productId: 2, enabled: false}] as InventorySnapshot['data'];
    const state = {...snapshot, data, components: [
      {productId: 1, modifierGroupId: 1, modifierOptionId: 3, componentProductId: 1, units: 6},
      {productId: 1, modifierGroupId: 1, modifierOptionId: 3, componentProductId: 2, units: 5}]};
    expect([...inventoryDemand(state, 1, [{modifierOptionId: 3, quantity: 1}], 2)]).toEqual([[1, 14]]);
  });
  it('blocks extra summary units when direct units and combos compete for the same stock', () => {
    const state = { ...snapshot, data: [{ productId: 1, enabled: true, quantity: 3 }] as InventorySnapshot['data'],
      components: [{ productId: 2, modifierGroupId: 1, modifierOptionId: 3, componentProductId: 1, units: 2 }] };
    const combo = { id: 2, modifierSelections: [{ modifierOptionId: 3, quantity: 1 }] };
    expect(inventoryMissingForDraft(state, [combo, { id: 1 }])).toBeUndefined();
    expect(inventoryMissingForDraft(state, [combo, { id: 1 }, { id: 1 }])?.productId).toBe(1);
  });
  it('does not discount persisted units twice when editing, but checks any added units', () => {
    const state = { ...snapshot, data: [{ productId: 1, enabled: true, quantity: 0 }] as InventorySnapshot['data'] };
    const item = { id: 1, orderItemId: 20 };
    const originals = [{ id: 20, productId: 1, quantity: 2 }];
    expect(inventoryMissingForDraft(state, [item, item], originals)).toBeUndefined();
    expect(inventoryMissingForDraft(state, [item, item, item], originals)?.productId).toBe(1);
    expect(inventoryMissingForDraft(state, [item, { id: 1 }], originals)?.productId).toBe(1);
  });
});
