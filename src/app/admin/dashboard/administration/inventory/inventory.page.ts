import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { firstValueFrom, Subscription } from 'rxjs';
import { InventoryService, InventoryProduct, InventorySnapshot } from '@services/inventory.service';
import { InventoryFieldsComponent, InventoryDraft, inventoryDraft, inventoryDraftValid } from '../../../../components/inventory-fields/inventory-fields.component';
import { DesktopWheelDragDirective, selectedCalendarDay } from '../../../../directives/desktop-wheel-drag.directive';
import { enteredPesos } from '@services/peso-input';

export function receiptValid(receipt: { lines: any[] }) {
  if (!Array.isArray(receipt.lines) || !receipt.lines.length || receipt.lines.length > 100) return false;
  const productIds = new Set<number>();
  return receipt.lines.every((line) => {
    const productId = Number(line.productId);
    if (!Number.isInteger(productId) || productId <= 0 || productIds.has(productId)) return false;
    productIds.add(productId);
    const quantityValid = line.boxed
      ? Number.isInteger(Number(line.packs)) && Number(line.packs) > 0
        && Number.isInteger(Number(line.unitsPerPack)) && Number(line.unitsPerPack) > 0
        && Number(line.packs) * Number(line.unitsPerPack) <= 1_000_000_000
      : Number.isInteger(Number(line.quantity)) && Number(line.quantity) > 0 && Number(line.quantity) <= 1_000_000_000;
    const costValid = line.unitCost !== null && line.unitCost !== ''
      && Number.isFinite(Number(line.unitCost)) && Number(line.unitCost) >= 0;
    const priceValid = !line.changePrice || line.newPrice !== null && line.newPrice !== ''
      && Number.isFinite(Number(line.newPrice)) && Number(line.newPrice) > 0;
    return quantityValid && costValid && priceValid;
  });
}

export function adjustmentValid(adjustment: { quantity: any; unitCost: any; reason: any }, selected?: InventoryProduct) {
  const quantity = Number(adjustment.quantity);
  return !!selected && Number.isInteger(quantity) && quantity !== 0 && Math.abs(quantity) <= 1_000_000_000
    && typeof adjustment.reason === 'string' && !!adjustment.reason.trim()
    && (quantity < 0 || adjustment.unitCost !== null && adjustment.unitCost !== ''
      && Number.isFinite(Number(adjustment.unitCost)) && Number(adjustment.unitCost) >= 0);
}

@Component({ selector: 'app-inventory', standalone: true, imports: [IonicModule, CommonModule, FormsModule, InventoryFieldsComponent, DesktopWheelDragDirective],
  templateUrl: './inventory.page.html', styleUrls: ['./inventory.page.scss'] })
export class InventoryPage implements OnDestroy {
  readonly selectOptions = { cssClass: 'product-group-select-alert' };
  private readonly bogotaFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  snapshot?: InventorySnapshot;
  error = ''; search = ''; status = ''; category = ''; view: 'stock' | 'history' = 'stock'; busy = false;
  draftSearch = ''; draftStatus = ''; draftCategory = '';
  selected?: InventoryProduct; draft?: InventoryDraft;
  editor: 'control' | 'receipt' | 'adjustment' | '' = '';
  receipt = { supplier: '', reference: '', reason: '', lines: [] as any[] };
  receiptPickerIndex: number | null = null;
  receiptPickerSearch = '';
  readonly enteredPesos = enteredPesos;
  adjustment = { quantity: 0, unitCost: 0 as number | string | null, reason: '' };
  filters = { from: '', to: '', productId: '', type: '', actorId: '', orderNumber: '', companyOrderNumber: '', notRecovered: false };
  operations: any[] = []; nextBeforeId: number | null = null; maxId = 0; historyLoading = false;
  actors: {actor_id: number; actor_name: string}[] = [];
  stockFiltersOpen = false; historyFiltersOpen = false; expandedReceiptLine = 0;
  activeDatePicker: 'from' | 'to' | '' = '';
  expandedProducts = new Set<number>(); expandedOperations = new Set<number>();
  private subscription?: Subscription;
  private focusProductId = 0; private historyLoaded = false;
  readonly types: Record<string, string> = { initial: 'Inicio del control', reactivation: 'Reactivación', configuration: 'Configuración',
    disabled: 'Control desactivado', receipt: 'Entrada de mercancía', adjustment: 'Ajuste', sale: 'Salida por pedido',
    order_edit: 'Modificación de pedido', return: 'Cancelación / devolución', components: 'Contenido de opciones' };
  public inventory = inject(InventoryService);
  private toast = inject(ToastController);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  ionViewWillEnter() {
    this.focusProductId = Number(this.route.snapshot.queryParamMap.get('productId')) || 0;
    this.historyLoaded = false;
    this.subscription?.unsubscribe();
    this.subscription = this.inventory.watch().subscribe((snapshot) => {
      if (snapshot === undefined) { this.snapshot = undefined; this.operations = []; this.editor = ''; this.draft = undefined; this.error = ''; return; }
      if (snapshot === null) { this.snapshot = undefined; this.error = 'No se pudo actualizar. Tus datos del formulario se conservan; presiona Actualizar para continuar.'; return; }
      this.snapshot = snapshot; this.error = '';
      if (!snapshot.canManage) this.view = 'stock';
      else if (this.route.snapshot.data['view'] === 'history' && !this.historyLoaded) {
        this.historyLoaded = true; void this.loadHistory();
      }
      if (Number.isInteger(this.focusProductId) && this.focusProductId > 0) {
        this.search = snapshot.data.find((product) => product.productId === this.focusProductId)?.name || '';
        this.draftSearch = this.search;
        this.focusProductId = 0;
        void this.router.navigate([], { relativeTo: this.route, queryParams: { productId: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
    if (this.route.snapshot.data['view'] === 'history') this.view = 'history';
  }
  ionViewDidLeave() { this.subscription?.unsubscribe(); }
  ngOnDestroy() { this.subscription?.unsubscribe(); }
  get products() { return this.snapshot?.data || []; }
  get filtered() { const term = this.search.toLocaleLowerCase(); return this.products.filter((p) => p.name.toLocaleLowerCase().includes(term)
    && (this.status ? p.status === this.status : p.enabled) && (!this.category || p.category === this.category)); }
  consultStock() {
    this.search = this.draftSearch.trim();
    this.status = this.draftStatus;
    this.category = this.draftCategory;
    this.inventory.refresh();
  }
  get categories() { return [...new Set(this.products.map((p) => p.category).filter(Boolean))]; }
  get alerts() { return this.products.filter((p) => ['empty', 'low'].includes(p.status)).length; }
  label(status: string) { return ({ empty: 'Agotado', low: 'Por acabarse', available: 'Disponible', untracked: 'Sin control' } as any)[status]; }
  productCountLabel() { return `${this.filtered.length} ${this.filtered.length === 1 ? 'producto' : 'productos'}`; }
  editProduct(product: InventoryProduct) { void this.router.navigate(['/dashboard/administration/menu-management'], { queryParams: { productId: product.productId } }); }
  toggleProduct(productId: number) { this.expandedProducts.has(productId) ? this.expandedProducts.delete(productId) : this.expandedProducts.add(productId); }
  toggleOperation(operationId: number) { this.expandedOperations.has(operationId) ? this.expandedOperations.delete(operationId) : this.expandedOperations.add(operationId); }
  optionUsage(productId: number) { return this.snapshot?.components.filter((component) => component.componentProductId === productId) || []; }
  optionUsageLabels(productId: number): string[] { return [...new Set(this.optionUsage(productId).map((component) => {
    const product = this.products.find((item) => item.productId === component.productId)?.name;
    const option = [component.groupName, component.optionName].filter(Boolean).join(' · ');
    return [product, option].filter(Boolean).join(': ');
  }).filter(Boolean))]; }
  productName(productId: number) { return this.products.find((product) => product.productId === Number(productId))?.name || ''; }
  get receiptPickerProducts() {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const term = normalize(this.receiptPickerSearch.trim());
    return this.products.filter((product) => product.enabled && normalize(product.name).includes(term)
      && !this.receipt.lines.some((line, index) => index !== this.receiptPickerIndex && Number(line.productId) === product.productId));
  }
  openReceiptPicker(index: number) { if (!this.busy) { this.receiptPickerSearch = ''; this.receiptPickerIndex = index; } }
  selectReceiptProduct(product: InventoryProduct) {
    const line = this.receiptPickerIndex !== null && this.receipt.lines[this.receiptPickerIndex];
    if (line && !this.busy) line.productId = product.productId;
    this.receiptPickerIndex = null;
  }
  closeEditor() { if (!this.busy) this.editor = ''; }
  clearHistoryDates() { this.filters.from = ''; this.filters.to = ''; }
  onHistoryDateChange(which: 'from' | 'to', event: CustomEvent) {
    const value = selectedCalendarDay(event);
    if (!value) return;
    this.filters[which] = value;
    this.activeDatePicker = '';
  }
  private historyFilters() { return { ...this.filters, from: this.dateOnly(this.filters.from), to: this.dateOnly(this.filters.to) }; }
  private dateOnly(value: unknown) { return value ? String(value).slice(0, 10) : ''; }
  private bogotaParts(value: string | Date): Record<string, string> {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return {};
    const parts: Record<string, string> = {};
    for (const part of this.bogotaFormatter.formatToParts(date)) parts[part.type] = part.value;
    return parts;
  }
  formatBogotaDateTime(value: string): string {
    const part = this.bogotaParts(value);
    return part['year'] ? `${part['day']}/${part['month']}/${part['year']} ${part['hour']}:${part['minute']}:${part['second']}` : '';
  }
  private bogotaFileDate(): string {
    const part = this.bogotaParts(new Date());
    return `${part['year']}-${part['month']}-${part['day']}`;
  }
  async message(text: string, color = 'success') { const toast = await this.toast.create({ message: text, color, duration: 4000 }); await toast.present(); }
  async configure(product: InventoryProduct) {
    this.selected = { ...product };
    this.draft = inventoryDraft(product, this.snapshot?.components.filter((component) => component.productId === product.productId));
    this.editor = 'control';
  }
  openReceipt() { this.receipt = { supplier: '', reference: '', reason: '', lines: [] }; this.addReceiptLine(); this.editor = 'receipt'; }
  addReceiptLine() { this.receipt.lines.push({ productId: 0, quantity: 1, unitCost: null, boxed: false, packs: 1, unitsPerPack: 1 }); this.expandedReceiptLine = this.receipt.lines.length - 1; }
  openAdjustment(p: InventoryProduct) { this.selected = { ...p }; this.adjustment = { quantity: 0, unitCost: p.averageCost || 0, reason: '' }; this.editor = 'adjustment'; }
  get canSave() {
    if (this.busy || this.error) return false;
    if (this.editor === 'control') return !!this.draft && inventoryDraftValid(this.draft);
    if (this.editor === 'receipt') return receiptValid(this.receipt);
    if (this.editor === 'adjustment') return adjustmentValid(this.adjustment, this.selected);
    return false;
  }
  async save() {
    if (!this.canSave) return;
    this.busy = true;
    try {
      if (this.editor === 'control' && this.selected && this.draft) {
        await firstValueFrom(this.inventory.control(this.selected.productId, this.draft));
      } else if (this.editor === 'receipt') {
        const lines = this.receipt.lines.map(({ boxed, packs, unitsPerPack, changePrice, newPrice, ...line }) => ({ ...line,
          ...(boxed ? { packs, unitsPerPack } : {}), ...(changePrice ? { newPrice } : {}) }));
        await firstValueFrom(this.inventory.receipt({ ...this.receipt, lines }));
      } else if (this.editor === 'adjustment' && this.selected) {
        await firstValueFrom(this.inventory.adjust({ ...this.adjustment, productId: this.selected.productId, expectedVersion: this.selected.version }));
      }
      this.editor = ''; await this.message('Operación guardada.'); this.inventory.refresh();
      if (this.view === 'history') await this.loadHistory();
    } catch (e: any) { await this.message(e.error?.message || 'No se pudo confirmar. Vuelve a intentarlo con los mismos datos.', 'danger'); }
    finally { this.busy = false; }
  }
  async loadHistory(more = false) {
    if (this.historyLoading) return;
    this.historyLoading = true;
    try {
      const result = await firstValueFrom(this.inventory.movements({ ...this.historyFilters(),
        ...(more ? { maxId: this.maxId, beforeId: this.nextBeforeId! } : {}) }));
      this.operations = more ? [...this.operations, ...result.data] : result.data;
      this.nextBeforeId = result.nextBeforeId; this.maxId = result.maxId;
      this.actors = result.actors;
    } catch (e: any) { await this.message(e.error?.message || 'No se pudo cargar el historial.', 'danger'); }
    finally { this.historyLoading = false; }
  }
  async exportStock() {
    this.busy = true;
    try {
      this.snapshot = await firstValueFrom(this.inventory.balances()); this.error = '';
      const rows = this.filtered.map((p) => ({ Producto: p.name, Categoría: p.category, Unidades: p.quantity, 'Precio de venta': Number(p.price), 'Avisar en': p.minimumQuantity,
        Estado: this.label(p.status), 'Consultado a las': this.formatBogotaDateTime(this.snapshot!.asOf),
        ...(this.snapshot!.canManage ? { 'Costo promedio': Number(p.averageCost), 'Valor disponible': Number(p.value) } : {}) }));
      await this.download(rows, 'inventario');
    } catch { await this.message('No se pudo descargar el inventario actualizado.', 'danger'); }
    finally { this.busy = false; }
  }
  async exportHistory() {
    this.busy = true;
    try {
      const filters = this.historyFilters(); let result = await firstValueFrom(this.inventory.movements(filters));
      const all = [...result.data]; const maxId = result.maxId; const asOf = result.asOf;
      while (result.nextBeforeId) {
        result = await firstValueFrom(this.inventory.movements({ ...filters, maxId, beforeId: result.nextBeforeId })); all.push(...result.data);
      }
      const rows = all.reduce<any[]>((rows, op) => {
        const common = { Fecha: this.formatBogotaDateTime(op.created_at), Responsable: op.actor_name, Perfil: op.actor_role, Tipo: this.types[op.type] || op.type,
          Comanda: op.order_number || '', Orden: op.company_order_number || '', Motivo: op.reason || '', Proveedor: op.supplier || '', Referencia: op.reference || '', 'Consultado a las': this.formatBogotaDateTime(asOf) };
        return rows.concat([...op.movements.map((m: any) => ({ ...common, Producto: m.product_name, Movimiento: m.quantity, Antes: m.quantity_before, Después: m.quantity_after, Valor: Number(m.value_delta) })),
          ...op.returns.map((r: any) => ({ ...common, Producto: r.product_name, 'Unidades retiradas': r.removed_quantity,
            Recuperadas: r.recovered_quantity, 'No recuperadas': r.not_recovered_quantity, 'Se sumaron al saldo': r.applied_to_stock ? 'Sí' : 'No, control desactivado', Motivo: r.reason || op.reason || '' })),
          ...(!op.movements.length && !op.returns.length ? [{ ...common, Detalle: JSON.stringify(op.details || {}) }] : [])]);
      }, []);
      await this.download(rows, 'movimientos-inventario');
    } catch { await this.message('No se pudo completar la descarga. Intenta nuevamente.', 'danger'); }
    finally { this.busy = false; }
  }
  private async download(rows: any[], name: string) {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.json_to_sheet(rows); const book = XLSX.utils.book_new();
    const moneyHeaders = new Set(['Precio de venta', 'Costo promedio', 'Valor disponible', 'Valor']);
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    for (let column = 0; column <= range.e.c; column++) {
      if (!moneyHeaders.has(sheet[XLSX.utils.encode_cell({ r: 0, c: column })]?.v)) continue;
      for (let row = 1; row <= range.e.r; row++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (cell?.t === 'n') cell.z = '#,##0';
      }
    }
    XLSX.utils.book_append_sheet(book, sheet, 'Inventario'); XLSX.writeFile(book, `${name}-${this.bogotaFileDate()}.xlsx`);
  }
}
