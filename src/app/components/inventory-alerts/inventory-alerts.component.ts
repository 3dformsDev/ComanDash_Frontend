import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { InventoryService, InventorySnapshot } from '@services/inventory.service';

@Component({ selector: 'app-inventory-alerts', standalone: true, imports: [CommonModule, RouterModule, IonicModule],
  template: `<span class="inventory-shortcut-wrap"><ion-button class="inventory-shortcut" routerLink="/dashboard/administration/inventory"
    [attr.aria-label]="alerts.length ? 'Inventario, ' + alerts.length + ' productos por revisar' : 'Abrir inventario'">
    <ion-icon name="archive-outline" slot="icon-only"></ion-icon>
  </ion-button>
    <span *ngIf="alerts.length" class="inventory-count">{{alerts.length > 99 ? '99+' : alerts.length}}</span>
    <span *ngIf="error" class="inventory-error" aria-hidden="true"></span>
  </span>`,
  styles: [`:host{display:inline-flex;flex:none}.inventory-shortcut-wrap{position:relative;display:inline-flex;width:44px;height:44px;flex:none;overflow:visible;border-radius:12px;background:#fff0f0}.inventory-shortcut{width:44px;height:44px;margin:0;--background:transparent;--background-hover:#ffe1e1;--border-radius:12px;--color:var(--ion-color-primary);--padding-start:0;--padding-end:0}.inventory-shortcut::part(native){border-radius:12px}.inventory-shortcut ion-icon{font-size:22px}.inventory-count{position:absolute;z-index:2;top:-8px;right:-8px;display:grid;place-items:center;min-width:21px;height:21px;padding:0 2px;box-sizing:border-box;border:2px solid #fff;border-radius:999px;background:#dc2626;color:#fff;font-size:.62rem;font-weight:900;line-height:1;pointer-events:none}.inventory-error{position:absolute;z-index:2;right:3px;bottom:3px;width:8px;height:8px;border:2px solid #fff;border-radius:50%;background:#f59e0b;pointer-events:none}`] })
export class InventoryAlertsComponent implements OnInit, OnDestroy {
  snapshot?: InventorySnapshot; error = ''; private subscription?: Subscription;
  public inventory = inject(InventoryService);
  get alerts() { return this.snapshot?.data.filter((p) => ['empty', 'low'].includes(p.status)) || []; }
  ngOnInit() { this.subscription = this.inventory.watch().subscribe((snapshot) => {
    if (snapshot === undefined) { this.snapshot = undefined; this.error = ''; return; }
    if (snapshot === null) { this.snapshot = undefined; this.error = 'No se pudo actualizar el inventario. Puedes continuar y consultarlo después.'; return; }
    this.snapshot = snapshot; this.error = '';
  }); }
  ngOnDestroy() { this.subscription?.unsubscribe(); }
}
