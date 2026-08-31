import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { NameOfClientComponent } from '../name-of-client/name-of-client.component';
import * as OrdersActions from '@store/orders/actions/orders.actions';
import { TableI } from '@services/table.service';
import { Router } from '@angular/router';
import { AppState } from '@capacitor/app';
import { Store } from '@ngrx/store';
import { TableZoneIconType } from '@services/table-zones.service';

interface TableZoneGroup {
  key: string;
  name: string;
  iconType: TableZoneIconType;
  displayOrder: number;
  tables: TableI[];
}

@Component({
  selector: 'app-table-selection',
  templateUrl: './table-selection.component.html',
  styleUrls: ['./table-selection.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule] // Simplificamos los imports
})
export class TableSelectionComponent {

  @Input() tables: TableI[] = [];
  selectedZoneKey: string | null = null;

  // Usamos @Output para enviar eventos al componente padre
  @Output() onTableSelect = new EventEmitter<any>();
  @Output() onCancel = new EventEmitter<void>();

  // El constructor ya no necesita ModalController
  constructor(
    private modalCtrl: ModalController,
    private router: Router,
    private store: Store<AppState>,
  ) { }

  get zoneGroups(): TableZoneGroup[] {
    const groupedTables = new Map<string, TableZoneGroup>();

    for (const table of this.tables) {
      const zoneName = table.tableZone?.name || this.normalizeZone(table.zone);
      const key = table.tableZone?.id
        ? `zone:${table.tableZone.id}`
        : `legacy:${zoneName.toLocaleLowerCase('es')}`;
      const currentGroup = groupedTables.get(key);

      if (currentGroup) {
        currentGroup.tables.push(table);
      } else {
        groupedTables.set(key, {
          key,
          name: zoneName,
          iconType: table.tableZone?.iconType || this.inferLegacyIcon(zoneName),
          displayOrder: table.tableZone?.displayOrder || 0,
          tables: [table],
        });
      }
    }

    return Array.from(groupedTables.values())
      .sort((zoneA, zoneB) =>
        zoneA.displayOrder - zoneB.displayOrder
        || zoneA.name.localeCompare(zoneB.name, 'es', { sensitivity: 'base' }),
      );
  }

  get activeZoneGroup(): TableZoneGroup | null {
    const groups = this.zoneGroups;
    return groups.find(group => group.key === this.selectedZoneKey) || groups[0] || null;
  }

  get availableTablesCount(): number {
    return this.activeZoneGroup?.tables.filter(table => !table.isBussy).length || 0;
  }

  get occupiedTablesCount(): number {
    return this.activeZoneGroup?.tables.filter(table => table.isBussy).length || 0;
  }

  selectZone(group: TableZoneGroup) {
    this.selectedZoneKey = group.key;
  }

  isZoneSelected(group: TableZoneGroup): boolean {
    return this.activeZoneGroup?.key === group.key;
  }

  getZoneIcon(iconType: TableZoneIconType): string {
    const icons: Record<TableZoneIconType, string> = {
      table: 'restaurant-outline',
      bar: 'wine-outline',
      terrace: 'umbrella-outline',
      special: 'star-outline',
    };

    return icons[iconType] || 'restaurant-outline';
  }

  private normalizeZone(zone: string | null | undefined): string {
    return zone?.trim() || 'Salón principal';
  }

  private inferLegacyIcon(zone: string): TableZoneIconType {
    const normalizedZone = zone.toLocaleLowerCase('es');

    if (normalizedZone.includes('barra') || normalizedZone.includes('bar')) {
      return 'bar';
    }

    if (
      normalizedZone.includes('terraza') ||
      normalizedZone.includes('exterior') ||
      normalizedZone.includes('patio')
    ) {
      return 'terrace';
    }

    return 'table';
  }

  // Ahora, en lugar de cerrar el modal, emitimos un evento con los datos
  async selectT(table: any, isRequired: boolean) {
    this.onTableSelect.emit(table);
    // Creamos el modal usando el ModalController
    const modal = await this.modalCtrl.create({
      component: NameOfClientComponent, // El componente del modal
      componentProps: {
        isRequired: isRequired // Pasamos el parámetro para la validación
      },
      // ¡Esta es la clave! Asignamos el ID para que los estilos del Canvas se apliquen.
      id: 'name-of-client-modal'
    });

    // Presentamos el modal en pantalla
    await modal.present();


    // Esperamos a que el modal se cierre para recibir los datos
    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      console.log('Nombre del cliente:', data);
      this.store.dispatch(OrdersActions.setNameOrder({ customerName: data }));
      this.store.dispatch(OrdersActions.setNumberOrder({ numberTable: table }));
      // Aquí puedes continuar tu lógica, por ejemplo, crear un pedido
      // para llevar con el nombre del cliente que recibiste en 'data'.
    } else {
      console.log('Modal de nombre de cliente cerrado.');
    }
  }

  // Emitimos un evento para cancelar
  closeModal() {
    this.onCancel.emit();
  }

  redirectToAddTables(){
    this.router.navigate(['/dashboard/administration/table-management']);
    this.onCancel.emit();
  }
}
