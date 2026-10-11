import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule } from '@ionic/angular';
import type { InventoryComponent, InventoryProduct } from '@services/inventory.service';
import { enteredPesos } from '@services/peso-input';

export interface InventoryDraft {
  enabled: boolean; wasEnabled: boolean; quantity: number | null; minimumQuantity: number;
  unitCost: number | string | null; expectedVersion: number; confirmDependencies: boolean;
  components: InventoryComponent[];
}
export function inventoryDraft(product?: InventoryProduct, components: InventoryComponent[] = []): InventoryDraft {
  return { enabled: product?.enabled ?? false, wasEnabled: product?.enabled ?? false, quantity: null,
    minimumQuantity: product?.minimumQuantity ?? 0, unitCost: product?.cost ?? 0,
    expectedVersion: product?.version ?? 0, confirmDependencies: false, components: structuredClone(components) };
}
export function inventoryDraftValid(d: InventoryDraft) {
  const componentKeys = d.components.map((component) => `${component.modifierOptionId}:${component.componentProductId}`);
  return Number.isInteger(d.minimumQuantity) && d.minimumQuantity >= 0 && (!d.enabled || d.wasEnabled ||
    (d.quantity !== null && Number.isInteger(d.quantity) && d.quantity >= 0 && d.unitCost !== null && d.unitCost !== '' && Number.isFinite(Number(d.unitCost)) && Number(d.unitCost) >= 0))
    && (!d.wasEnabled || d.enabled || d.confirmDependencies)
    && d.components.every((c) => c.componentProductId > 0 && c.modifierOptionId > 0 && Number.isInteger(c.units) && c.units > 0)
    && new Set(componentKeys).size === componentKeys.length;
}
@Component({ selector: 'app-inventory-fields', standalone: true, imports: [IonicModule, CommonModule, FormsModule],
  template: `<section class="inventory-fields">
    <div class="inventory-heading"><div><h3>Control de unidades</h3><p>Actívalo para llevar las existencias de este producto.</p></div>
      <ion-toggle [ngModel]="draft.enabled" (ionChange)="changeEnabled($event.detail.checked)" [ngModelOptions]="{standalone:true}" aria-label="Controlar unidades"></ion-toggle></div>
    <div *ngIf="draft.enabled">
      <ion-item class="field" lines="none"><ion-input label="Avisarme cuando queden *" labelPlacement="stacked" type="number" min="0" inputmode="numeric"
        [(ngModel)]="draft.minimumQuantity" [ngModelOptions]="{standalone:true}"></ion-input></ion-item>
      <ng-container *ngIf="!draft.wasEnabled">
        <ion-item class="field" lines="none"><ion-input label="Unidades disponibles ahora *" labelPlacement="stacked" type="number" min="0" inputmode="numeric"
          [(ngModel)]="draft.quantity" [ngModelOptions]="{standalone:true}"></ion-input></ion-item>
        <p>Cuenta solo las unidades que puedes vender. No incluyas las de pedidos ya confirmados.</p>
        <ion-item class="field" lines="none" *ngIf="!readonlyUnitCost"><ion-input label="Costo de cada unidad *" labelPlacement="stacked" type="text" inputmode="numeric"
          [ngModel]="draft.unitCost | number:'1.0-0':'es-CO'" (ionInput)="draft.unitCost = enteredPesos($event.detail.value)" [ngModelOptions]="{standalone:true}"></ion-input></ion-item>
        <div class="linked-cost" *ngIf="readonlyUnitCost"><small>Costo de unidad</small><strong>{{ draft.unitCost === null || draft.unitCost === '' ? '—' : (draft.unitCost | currency:'COP':'symbol-narrow':'1.0-0') }}</strong><p>Se toma del costo indicado arriba.</p></div>
        <p *ngIf="!readonlyUnitCost">Es lo que pagas por la unidad, no su precio de venta. Puede ser cero.</p>
      </ng-container>
    </div>
    <div *ngIf="draft.wasEnabled && !draft.enabled" class="disable-confirmed"><ion-icon name="checkmark-circle-outline"></ion-icon><span>Confirmaste que deseas dejar de controlar estas unidades.</span></div>
  </section>`, styles: [`.inventory-fields{padding:16px;border:1px solid #e5e7eb;border-left:4px solid var(--ion-color-primary);border-radius:14px;background:#fff;margin:16px 0;box-shadow:0 4px 12px rgba(15,23,42,.06)}.inventory-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.inventory-heading>div{min-width:0}h3{font-size:1rem;font-weight:800;color:#252b38;margin:0}p{font-size:.8rem;color:#6b7280;line-height:1.4;margin:4px 0 10px}.field{--background:#fff;--padding-start:12px;--inner-padding-end:12px;--border-radius:12px;margin:10px 0;border:1px solid #dfe2e7;border-radius:12px;box-shadow:0 3px 10px rgba(15,23,42,.04)}.linked-cost{display:flex;flex-direction:column;gap:3px;padding:12px;margin-top:10px;border:1px solid #dfe2e7;border-radius:12px;background:#f7f8fa}.linked-cost small{color:#6b7280;font-size:.73rem}.linked-cost strong{color:#252b38;font-size:.9rem}.linked-cost p{margin:0}.disable-confirmed{display:flex;align-items:center;gap:8px;padding:10px;margin-top:12px;border-radius:10px;background:#fff4e5;color:#8a5200;font-size:.8rem}.disable-confirmed ion-icon{font-size:20px;flex:0 0 auto}`] })
export class InventoryFieldsComponent {
  readonly enteredPesos = enteredPesos;
  @Input() draft!: InventoryDraft;
  @Input() readonlyUnitCost = false;
  @Input() dependencyLabels: string[] = [];
  private alerts = inject(AlertController);

  async changeEnabled(enabled: boolean) {
    if (enabled || !this.draft.wasEnabled) {
      this.draft.enabled = enabled;
      this.draft.confirmDependencies = false;
      return;
    }
    const dependencyText = this.dependencyLabels.length
      ? `<br><br>También se usa en: <strong>${this.dependencyLabels.join(', ')}</strong>. Esas opciones dejarán de descontarlo.`
      : '';
    const alert = await this.alerts.create({
      header: 'Dejar de controlar unidades',
      message: `Las ventas futuras no descontarán este producto. Para volver a activarlo tendrás que ingresar las unidades disponibles en ese momento.${dependencyText}`,
      cssClass: ['confirmation-action-alert', 'inventory-disable-alert'],
      buttons: [
        { text: 'Seguir controlando', role: 'cancel', cssClass: 'alert-secondary-action' },
        { text: 'Desactivar control', role: 'confirm', cssClass: 'alert-primary-action' },
      ],
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    this.draft.enabled = result.role !== 'confirm';
    this.draft.confirmDependencies = result.role === 'confirm';
  }
}
