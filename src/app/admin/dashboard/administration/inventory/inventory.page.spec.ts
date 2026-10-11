import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { adjustmentValid, InventoryPage, receiptValid } from './inventory.page';
import { InventoryService, InventorySnapshot } from '@services/inventory.service';
import { ToastController } from '@ionic/angular';
import { InventoryAlertsComponent } from '../../../../components/inventory-alerts/inventory-alerts.component';
import { inventoryDraft, inventoryDraftValid } from '../../../../components/inventory-fields/inventory-fields.component';

describe('Inventory form continuity', () => {
  it('enables merchandise entry only with complete, unique and valid lines', () => {
    const receipt = {lines: [{productId: 1, quantity: 3, unitCost: 0, boxed: false}]};
    expect(receiptValid(receipt)).toBeTrue();
    expect(receiptValid({lines: [...receipt.lines, {...receipt.lines[0]}]})).toBeFalse();
    expect(receiptValid({lines: [{...receipt.lines[0], quantity: 0}]})).toBeFalse();
    expect(receiptValid({lines: [{...receipt.lines[0], unitCost: null}]})).toBeFalse();
    expect(receiptValid({lines: [{...receipt.lines[0], changePrice: true, newPrice: 0}]})).toBeFalse();
    expect(receiptValid({lines: [{productId: 1, boxed: true, packs: 2, unitsPerPack: 6, unitCost: 1000}]})).toBeTrue();
  });
  it('requires a whole nonzero adjustment, a reason and incoming cost', () => {
    const product = {productId: 1} as InventorySnapshot['data'][number];
    expect(adjustmentValid({quantity: -2, unitCost: null, reason: 'Avería'}, product)).toBeTrue();
    expect(adjustmentValid({quantity: 2, unitCost: 0, reason: 'Conteo'}, product)).toBeTrue();
    expect(adjustmentValid({quantity: 2.5, unitCost: 0, reason: 'Conteo'}, product)).toBeFalse();
    expect(adjustmentValid({quantity: 2, unitCost: null, reason: 'Conteo'}, product)).toBeFalse();
    expect(adjustmentValid({quantity: -2, unitCost: null, reason: ' '}, product)).toBeFalse();
  });
  it('requires conscious deactivation and rejects duplicate option components', () => {
    const draft = inventoryDraft({enabled: true, minimumQuantity: 1, version: 2, cost: 1000} as any, []);
    draft.enabled = false;
    expect(inventoryDraftValid(draft)).toBeFalse();
    draft.confirmDependencies = true;
    expect(inventoryDraftValid(draft)).toBeTrue();
    draft.components = [
      {modifierGroupId: 1, modifierOptionId: 2, componentProductId: 3, units: 1},
      {modifierGroupId: 1, modifierOptionId: 2, componentProductId: 3, units: 2},
    ];
    expect(inventoryDraftValid(draft)).toBeFalse();
  });
  it('renders stock and alerts while hiding management and costs from cashiers', async () => {
    const updates = new Subject<InventorySnapshot | null | undefined>();
    await TestBed.configureTestingModule({imports: [InventoryPage], providers: [provideRouter([]),
      {provide: InventoryService, useValue: {watch: () => updates}},
      {provide: ToastController, useValue: {}},
      {provide: ActivatedRoute, useValue: {snapshot: {data: {}, queryParamMap: {get: () => null}}}}]}).compileComponents();
    const fixture = TestBed.createComponent(InventoryPage);
    fixture.componentInstance.ionViewWillEnter();
    updates.next({asOf: '2026-09-10T12:00:00Z', canManage: false, role: 'cashier', components: [], data: [
      {productId: 1, name: 'Gaseosa familiar', category: 'Bebidas', categoryId: 1, enabled: true, quantity: 2,
        minimumQuantity: 5, version: 1, status: 'low', active: true, available: true, price: 3500, averageCost: '1200', value: '2400'}]});
    fixture.detectChanges(); await fixture.whenStable();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Gaseosa familiar'); expect(text).toContain('Por acabarse');
    expect(text).not.toContain('Costo promedio'); expect(text).not.toContain('Configurar'); expect(text).not.toContain('Registrar entrada');
    fixture.destroy();
  });
  it('preserves entered merchandise after a failed refresh, but clears it on account reset', () => {
    const updates = new Subject<InventorySnapshot | null | undefined>();
    TestBed.configureTestingModule({providers: [provideRouter([]),
      {provide: InventoryService, useValue: {watch: () => updates}},
      {provide: ToastController, useValue: {}},
      {provide: ActivatedRoute, useValue: {snapshot: {data: {}, queryParamMap: {get: () => null}}}}]});
    const page = TestBed.runInInjectionContext(() => new InventoryPage());
    page.ionViewWillEnter(); page.openReceipt(); page.receipt.lines[0].quantity = 48;
    updates.next(null); expect(page.editor).toBe('receipt'); expect(page.receipt.lines[0].quantity).toBe(48); expect(page.canSave).toBeFalse();
    updates.next(undefined); expect(page.editor).toBe(''); expect(page.snapshot).toBeUndefined(); page.ngOnDestroy();
  });
  it('does not present the initial loading state as a connection error', () => {
    const updates = new Subject<InventorySnapshot | null | undefined>();
    TestBed.configureTestingModule({imports: [InventoryAlertsComponent], providers: [provideRouter([]),
      {provide: InventoryService, useValue: {watch: () => updates, refresh: () => undefined}}]});
    const fixture = TestBed.createComponent(InventoryAlertsComponent);
    fixture.detectChanges(); updates.next(undefined);
    expect(fixture.componentInstance.error).toBe('');
    updates.next(null);
    expect(fixture.componentInstance.error).toContain('No se pudo actualizar');
    fixture.destroy();
  });
  it('preserves weighted cost precision on opening an adjustment and searches only eligible products', () => {
    TestBed.configureTestingModule({providers: [provideRouter([]),
      {provide: InventoryService, useValue: {}}, {provide: ToastController, useValue: {}},
      {provide: ActivatedRoute, useValue: {snapshot: {data: {}, queryParamMap: {get: () => null}}}}]});
    const page = TestBed.runInInjectionContext(() => new InventoryPage());
    const product = { productId: 1, name: 'Limón', enabled: true, averageCost: '1234.567890' } as any;
    page.openAdjustment(product);
    expect(page.adjustment.unitCost).toBe('1234.567890');
    page.snapshot = { data: [product, { productId: 2, name: 'Limonada', enabled: false }] } as any;
    page.openReceipt(); page.openReceiptPicker(0); page.receiptPickerSearch = 'limon';
    expect(page.receiptPickerProducts.map((p) => p.productId)).toEqual([1]);
    page.selectReceiptProduct(product); expect(page.receipt.lines[0].productId).toBe(1);
    expect(page.receiptPickerIndex).toBeNull();
    page.addReceiptLine(); page.openReceiptPicker(1); expect(page.receiptPickerProducts).toEqual([]);
    expect(page.enteredPesos('2.000')).toBe(2000); expect(page.enteredPesos('')).toBeNull();
  });
});
