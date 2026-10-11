import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { Observable, Subject, defer, fromEvent, merge, of, throwError, timer } from 'rxjs';
import { catchError, distinctUntilChanged, filter, finalize, map, retry, shareReplay, startWith, switchMap, take, tap } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { selectUser } from '@store/auth/selectors/auth.selectors';
import type { User } from '@store/auth/auth.state';
import { SocketService } from './socket.service';

export interface InventoryProduct {
  productId: number; name: string; category: string; categoryId: number; enabled: boolean;
  quantity: number | null; minimumQuantity: number; version: number; status: string;
  active: boolean; available: boolean; cost?: number; price?: number; averageCost?: string; value?: string;
}
export interface InventoryComponent {
  productId?: number; modifierGroupId: number; modifierOptionId: number; componentProductId: number; units: number;
  groupName?: string; optionName?: string;
}
export interface InventorySnapshot { asOf: string; canManage: boolean; role: string; data: InventoryProduct[]; components: InventoryComponent[] }
export interface InventoryReturn { consumptionId: number; productId: number; name: string; quantity: number; recoveredQuantity: number; reason: string }
export interface InventoryPreview { orderVersion: number; items: InventoryReturn[] }
export function inventoryDemand(snapshot: InventorySnapshot, productId: number, selections: {modifierOptionId: number; quantity: number}[], count = 1) {
  const demand = new Map<number, number>();
  if (snapshot.data.some((p) => p.productId === productId && p.enabled)) demand.set(productId, count);
  for (const selection of selections) for (const c of snapshot.components) {
    if (c.productId === productId && c.modifierOptionId === selection.modifierOptionId
      && snapshot.data.some((p) => p.productId === c.componentProductId && p.enabled)) {
      demand.set(c.componentProductId, (demand.get(c.componentProductId) || 0) + c.units * selection.quantity * count);
    }
  }
  return demand;
}

// Summary items are individual units. Persisted units were already discounted on confirmation.
export function inventoryMissingForDraft(snapshot: InventorySnapshot, items: any[], originals: any[] = []) {
  const remaining = new Map(originals.map((item) => [Number(item.id), Number(item.quantity || 0)]));
  const required = new Map<number, number>();
  for (const item of items) {
    const owned = remaining.get(Number(item.orderItemId)) || 0;
    if (owned > 0) { remaining.set(Number(item.orderItemId), owned - 1); continue; }
    for (const [id, units] of inventoryDemand(snapshot, Number(item.id), item.modifierSelections || [])) {
      required.set(id, (required.get(id) || 0) + units);
    }
  }
  return snapshot.data.find((product) => product.enabled && (required.get(product.productId) || 0) > Number(product.quantity));
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  readonly url = `${environment.apiUrl}/v1/inventory`;
  private changed = new Subject<void>();
  private inFlight = new Map<string, Observable<any>>();
  private live?: Observable<InventorySnapshot | null | undefined>;
  private http = inject(HttpClient);
  private sockets = inject(SocketService);
  private store = inject(Store);
  refresh() { this.changed.next(); }
  balances() { return this.http.get<InventorySnapshot>(`${this.url}/balances`); }
  watch(): Observable<InventorySnapshot | null | undefined> {
    if (!this.live) this.live = this.store.select(selectUser).pipe(
      map((u) => u ? `${u.id}:${u.company?.id}:${u.location?.id}:${u.role?.code}` : ''), distinctUntilChanged(),
      switchMap((scope) => !scope ? of(undefined) : merge(timer(0, 30000), this.changed, this.sockets.inventoryChanged$,
      this.sockets.isConnected$.pipe(filter(Boolean)), fromEvent(window, 'online'),
      fromEvent(document, 'visibilitychange').pipe(filter(() => !document.hidden)))
      .pipe(filter(() => !document.hidden), switchMap(() => this.balances().pipe(catchError(() => of(null)))), startWith(undefined))),
      shareReplay({ bufferSize: 1, refCount: true }));
    return this.live;
  }
  preview(orderId: number, version: number, mode: 'edit' | 'return', orderItems?: any[]) {
    return this.http.post<InventoryPreview>(`${this.url}/orders/${orderId}/preview`, { mode, expectedOrderVersion: version, orderItems });
  }
  mutate<T = any>(method: 'POST' | 'PUT', url: string, body: any): Observable<T> {
    // Preserve the same intent after an uncertain network outcome, including page reloads.
    const payload = JSON.parse(JSON.stringify(body));
    return this.store.select(selectUser).pipe(filter((user): user is User => !!user), take(1), switchMap((user) => defer(() => {
      const identity = JSON.stringify([user.id, user.company?.id, user.location?.id, method, url, payload]);
      const active = this.inFlight.get(identity); if (active) return active;
      const storageKey = 'comandash.inventory.pending';
      let pending: Record<string, string> = {};
      try { pending = JSON.parse(sessionStorage.getItem(storageKey) || '{}'); } catch {}
      const key = pending[identity] || (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(20))).map((n) => n.toString(16).padStart(2, '0')).join(''));
      pending[identity] = key;
      try { sessionStorage.setItem(storageKey, JSON.stringify(pending)); } catch {}
      const clear = () => {
        try { const current = JSON.parse(sessionStorage.getItem(storageKey) || '{}'); delete current[identity]; sessionStorage.setItem(storageKey, JSON.stringify(current)); } catch {}
      };
      const request = this.http.request<T>(method, url, { body: payload, headers: { 'Idempotency-Key': key } }).pipe(
        retry({ count: 1, delay: (error) => error.status === 0 || error.status >= 500 ? timer(350) : throwError(() => error) }),
        tap(() => { clear(); this.refresh(); }),
        catchError((error) => { if (error.status >= 400 && error.status < 500) clear(); return throwError(() => error); }),
        finalize(() => this.inFlight.delete(identity)), shareReplay({ bufferSize: 1, refCount: false }));
      this.inFlight.set(identity, request);
      return request;
    })));
  }
  control(id: number, body: any) { return this.mutate('PUT', `${this.url}/products/${id}/control`, body); }
  receipt(body: any) { return this.mutate('POST', `${this.url}/receipts`, body); }
  adjust(body: any) { return this.mutate('POST', `${this.url}/adjustments`, body); }
  movements(filters: Record<string, string | number | boolean>) {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => { if (value !== '' && value !== undefined && value !== null) params[key] = String(value); });
    return this.http.get<any>(`${this.url}/movements`, { params });
  }
}
