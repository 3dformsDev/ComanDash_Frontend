import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import type { InventoryReturn } from '@services/inventory.service';

export function returnsValid(items: InventoryReturn[]) {
  return items.every((i) => Number.isInteger(i.recoveredQuantity) && i.recoveredQuantity >= 0 && i.recoveredQuantity <= i.quantity
    && (i.recoveredQuantity === i.quantity || !!i.reason?.trim()));
}
@Component({ selector: 'app-inventory-return', standalone: true, imports: [CommonModule, FormsModule, IonicModule],
  template: `<section *ngIf="items.length" class="return-card"><h3>Regresan al inventario</h3>
    <p>Indica cuántas unidades recibiste de vuelta y puedes vender otra vez.</p>
    <div class="return-line" *ngFor="let item of items">
      <strong>{{item.name}}</strong><p>Retiradas del pedido: {{item.quantity}}</p>
      <ion-input type="number" inputmode="numeric" label="Unidades que regresan" labelPlacement="stacked"
        [min]="0" [max]="item.quantity" [(ngModel)]="item.recoveredQuantity"></ion-input>
      <ion-textarea *ngIf="item.recoveredQuantity < item.quantity" label="¿Por qué no regresan todas?" labelPlacement="stacked"
        placeholder="Por ejemplo: se consumió o se dañó" maxlength="1000" [(ngModel)]="item.reason"></ion-textarea>
    </div><p>Las unidades que no regresan ya estaban descontadas. No se descontarán otra vez del inventario.</p></section>`,
  styles: [`.return-card{background:#fff;border-radius:14px;padding:16px;margin:4px 0;border:1px solid #e5e7eb;box-shadow:0 4px 12px rgba(15,23,42,.055)}
    h3{font-size:1rem;font-weight:800;color:#252b38;margin:0 0 6px}p{font-size:.82rem;line-height:1.4;color:#6b7280}.return-line{padding:14px 0;border-top:1px solid #e5e7eb}.return-line strong{color:#252b38}.return-line ion-input,.return-line ion-textarea{margin-top:9px;padding:0 11px;border:1px solid #dfe2e7;border-radius:11px}`] })
export class InventoryReturnComponent { @Input() items: InventoryReturn[] = []; }

@Component({ selector: 'app-inventory-return-modal', standalone: true, imports: [IonicModule, InventoryReturnComponent],
  template: `<ion-header class="ion-no-border"><ion-toolbar><ion-title>Productos retirados</ion-title><ion-buttons slot="end"><ion-button fill="clear" (click)="close()" aria-label="Cerrar"><ion-icon name="close-outline" slot="icon-only"></ion-icon></ion-button></ion-buttons></ion-toolbar></ion-header>
    <ion-content class="ion-padding"><app-inventory-return [items]="items"></app-inventory-return></ion-content>
    <ion-footer class="ion-padding ion-no-border"><ion-button expand="block" [disabled]="!valid" (click)="confirm()">Confirmar cantidades</ion-button></ion-footer>` })
export class InventoryReturnModalComponent {
  @Input() items: InventoryReturn[] = [];
  private modalController = inject(ModalController);
  get valid() { return returnsValid(this.items); }
  close() { void this.modalController.dismiss(null, 'cancel'); }
  confirm() { if (this.valid) void this.modalController.dismiss(this.items, 'confirm'); }
}
