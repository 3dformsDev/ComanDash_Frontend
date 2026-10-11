import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { InventoryService, InventorySnapshot, inventoryDemand } from '@services/inventory.service';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import {
  OrderLineModifierSelectionI,
  ProductPersonalizationGroupI,
  ProductPersonalizationsI,
} from '@services/personalizations.service';
import { ProductI } from '@services/products.service';

@Component({
  selector: 'app-product-personalization-modal',
  templateUrl: './product-personalization-modal.component.html',
  styleUrls: ['./product-personalization-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class ProductPersonalizationModalComponent implements OnInit, OnDestroy {
  private inventorySubscription?: Subscription;
  inventorySnapshot: InventorySnapshot | null = null;
  @Input() product!: ProductI;
  @Input() configuration!: ProductPersonalizationsI;
  @Input() initialSelections: OrderLineModifierSelectionI[] = [];

  quantities = new Map<number, number>();
  expandedGroupIds = new Set<number>();

  private inventory = inject(InventoryService);
  constructor(private modalCtrl: ModalController) {}
  ngOnDestroy() { this.inventorySubscription?.unsubscribe(); }
  inventoryLabel(optionId: number) {
    const components = this.inventorySnapshot?.components.filter((c) => c.productId === this.product.id && c.modifierOptionId === optionId) || [];
    return components.map((c) => { const p = this.inventorySnapshot!.data.find((p) => p.productId === c.componentProductId);
      return p?.enabled ? `${c.units} × ${p.name} · disponibles: ${p.quantity}` : ''; }).filter(Boolean).join(' / ');
  }
  private hasStock(extraOption?: number) {
    if (!this.inventorySnapshot) return true;
    const selections = [...this.quantities].map(([modifierOptionId, quantity]) => ({ modifierOptionId, quantity }));
    if (extraOption) selections.push({ modifierOptionId: extraOption, quantity: 1 });
    const demand = inventoryDemand(this.inventorySnapshot, this.product.id, selections);
    return !this.inventorySnapshot.data.some((p) => p.enabled && Number(p.quantity) < (demand.get(p.productId) || 0));
  }

  ngOnInit(): void {
    this.expandedGroupIds = new Set(this.configuration.groups.map((group) => group.modifierGroupId));
    this.inventorySubscription = this.inventory.watch().subscribe((s) => this.inventorySnapshot = s || null);
    this.inventory.refresh();
    this.initialSelections.forEach((selection) => {
      this.quantities.set(selection.modifierOptionId, Number(selection.quantity || 0));
    });
  }

  dismiss(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  quantityFor(optionId: number): number {
    return this.quantities.get(optionId) || 0;
  }

  toggleGroup(groupId: number): void {
    this.expandedGroupIds.has(groupId) ? this.expandedGroupIds.delete(groupId) : this.expandedGroupIds.add(groupId);
  }

  selectedCount(group: ProductPersonalizationGroupI): number {
    return group.options.reduce(
      (total, option) => total + this.quantityFor(option.id),
      0,
    );
  }

  canAdd(group: ProductPersonalizationGroupI, optionId: number): boolean {
    if (!this.hasStock(optionId)) return false;
    if (this.selectedCount(group) >= group.selectionLimit) return false;
    if (!group.allowOptionQuantities && this.quantityFor(optionId) >= 1) return false;
    return true;
  }

  add(group: ProductPersonalizationGroupI, optionId: number): void {
    if (!this.canAdd(group, optionId)) return;
    this.quantities.set(optionId, this.quantityFor(optionId) + 1);
  }

  remove(optionId: number): void {
    const current = this.quantityFor(optionId);
    if (current <= 1) {
      this.quantities.delete(optionId);
      return;
    }
    this.quantities.set(optionId, current - 1);
  }

  groupInstruction(group: ProductPersonalizationGroupI): string {
    if (group.isRequired) {
      return `Elige ${group.selectionLimit}`;
    }
    return `Opcional · hasta ${group.selectionLimit}`;
  }

  groupIsValid(group: ProductPersonalizationGroupI): boolean {
    const count = this.selectedCount(group);
    return group.isRequired
      ? count === group.selectionLimit
      : count <= group.selectionLimit;
  }

  get formIsValid(): boolean {
    return this.hasStock() && this.configuration.groups.every((group) => this.groupIsValid(group));
  }

  get additionalTotal(): number {
    return this.configuration.groups.reduce(
      (groupTotal, group) => groupTotal + group.options.reduce(
        (optionTotal, option) => optionTotal + this.quantityFor(option.id) * Number(option.priceAdjustment || 0),
        0,
      ),
      0,
    );
  }

  confirm(): void {
    if (!this.formIsValid) return;

    const selections: OrderLineModifierSelectionI[] = [];
    this.configuration.groups.forEach((group) => {
      group.options.forEach((option) => {
        const quantity = this.quantityFor(option.id);
        if (quantity < 1) return;
        selections.push({
          modifierGroupId: group.modifierGroupId,
          modifierOptionId: option.id,
          groupName: group.name,
          optionName: option.name,
          quantity,
          priceAdjustment: Number(option.priceAdjustment || 0),
        });
      });
    });

    void this.modalCtrl.dismiss({ selections }, 'confirmed');
  }
}
