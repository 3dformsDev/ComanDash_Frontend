import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { CreateTableDto, TableI, TableService, UpdateTableDto } from '@services/table.service';
import {
  TableZoneI,
  TableZoneIconType,
  TableZonesService,
} from '@services/table-zones.service';
import { firstValueFrom } from 'rxjs';

type ZoneMode = 'existing' | 'new';

interface TableFormValue {
  tableNumber: string;
  capacity: number | null;
  zoneId: number | null;
}

@Component({
  selector: 'app-table-management',
  templateUrl: './table-management.page.html',
  styleUrls: ['./table-management.page.scss'],
  standalone: false,
})
export class TableManagementPage implements OnInit {
  allTables: TableI[] = [];
  allZones: TableZoneI[] = [];
  isLoading = true;
  isSaving = false;
  isTableFormOpen = false;
  isZoneManagementOpen = false;
  isSavingZone = false;
  removingZoneId: number | null = null;
  tableToEdit: TableI | null = null;
  zoneToEdit: TableZoneI | null = null;
  tableForm: TableFormValue = this.createEmptyForm();
  zoneMode: ZoneMode = 'existing';
  newZoneName = '';
  newZoneIcon: TableZoneIconType = 'table';
  zoneEditName = '';
  zoneEditIcon: TableZoneIconType = 'table';

  readonly zoneIconOptions: Array<{
    value: TableZoneIconType;
    label: string;
    icon: string;
  }> = [
    { value: 'table', label: 'Mesa estándar', icon: 'restaurant-outline' },
    { value: 'bar', label: 'Barra', icon: 'wine-outline' },
    { value: 'terrace', label: 'Terraza o exterior', icon: 'umbrella-outline' },
    { value: 'special', label: 'Zona especial', icon: 'star-outline' },
  ];

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private tableService: TableService,
    private tableZonesService: TableZonesService,
  ) { }

  ngOnInit() {
    this.loadConfiguration();
  }

  get isFormValid(): boolean {
    const capacity = Number(this.tableForm.capacity);
    const hasValidTableData = Boolean(this.tableForm.tableNumber.trim())
      && capacity >= 1
      && capacity <= 100;
    const hasValidZone = this.zoneMode === 'existing'
      ? Boolean(this.tableForm.zoneId)
      : Boolean(this.newZoneName.trim());

    return hasValidTableData && hasValidZone;
  }

  get selectedNewZoneIcon(): string {
    return this.getZoneIcon(this.newZoneIcon);
  }

  get selectedZoneEditIcon(): string {
    return this.getZoneIcon(this.zoneEditIcon);
  }

  get isZoneEditValid(): boolean {
    const normalizedName = this.zoneEditName.trim();
    if (!this.zoneToEdit || !normalizedName) {
      return false;
    }

    return !this.allZones.some(zone =>
      zone.id !== this.zoneToEdit?.id
      && zone.name.toLocaleLowerCase('es') === normalizedName.toLocaleLowerCase('es'),
    );
  }

  async loadConfiguration() {
    this.isLoading = true;
    try {
      const [tables, zones] = await Promise.all([
        firstValueFrom(this.tableService.getTables()),
        firstValueFrom(this.tableZonesService.getZones()),
      ]);
      this.allTables = tables;
      this.allZones = zones;
    } catch (error) {
      console.error('Error al cargar las mesas y sus zonas:', error);
      this.presentToast('No se pudieron cargar las mesas y sus zonas.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  addTable() {
    this.tableToEdit = null;
    this.tableForm = this.createEmptyForm();
    this.zoneMode = this.allZones.length > 0 ? 'existing' : 'new';
    this.newZoneName = '';
    this.newZoneIcon = 'table';
    this.isTableFormOpen = true;
  }

  openZoneManagement() {
    this.cancelZoneEdit();
    this.isZoneManagementOpen = true;
  }

  closeZoneManagement() {
    if (this.isSavingZone || this.removingZoneId !== null) {
      return;
    }

    this.isZoneManagementOpen = false;
    this.cancelZoneEdit();
  }

  editZone(zone: TableZoneI) {
    this.zoneToEdit = zone;
    this.zoneEditName = zone.name;
    this.zoneEditIcon = zone.iconType;
  }

  cancelZoneEdit() {
    this.zoneToEdit = null;
    this.zoneEditName = '';
    this.zoneEditIcon = 'table';
  }

  async saveZoneChanges() {
    if (!this.zoneToEdit || !this.isZoneEditValid || this.isSavingZone) {
      return;
    }

    this.isSavingZone = true;
    try {
      await firstValueFrom(this.tableZonesService.updateZone(this.zoneToEdit.id, {
        name: this.zoneEditName.trim(),
        iconType: this.zoneEditIcon,
      }));
      this.presentToast('Zona actualizada correctamente.');
      this.cancelZoneEdit();
      await this.loadConfiguration();
    } catch (error) {
      console.error('Error al actualizar la zona:', error);
      this.presentToast('No se pudo actualizar la zona. Revisa que el nombre no esté repetido.', 'danger');
    } finally {
      this.isSavingZone = false;
    }
  }

  async removeZone(zone: TableZoneI) {
    const assignedTables = this.getZoneTablesCount(zone);
    if (assignedTables > 0) {
      const tableWord = assignedTables === 1 ? 'mesa asociada' : 'mesas asociadas';
      this.presentToast(
        `La zona tiene ${assignedTables} ${tableWord}. Muévelas a otra zona antes de quitarla.`,
        'danger',
      );
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Quitar zona',
      message: `¿Deseas quitar la zona "${zone.name}"? Dejará de aparecer al organizar las mesas.`,
      cssClass: 'confirmation-action-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-secondary-action' },
        {
          text: 'Quitar',
          role: 'destructive',
          cssClass: 'alert-primary-action',
          handler: () => this.confirmRemoveZone(zone),
        },
      ],
    });

    await alert.present();
  }

  getZoneTablesCount(zone: TableZoneI): number {
    return this.allTables.filter(table =>
      table.zoneId === zone.id || table.tableZone?.id === zone.id,
    ).length;
  }

  editTable(table: TableI) {
    const matchingZone = this.allZones.find(zone =>
      zone.id === table.zoneId
      || zone.name.toLocaleLowerCase('es') === (table.zone || '').toLocaleLowerCase('es'),
    );

    this.tableToEdit = table;
    this.tableForm = {
      tableNumber: table.tableNumber,
      capacity: table.capacity || 1,
      zoneId: matchingZone?.id ?? null,
    };
    this.zoneMode = matchingZone ? 'existing' : 'new';
    this.newZoneName = matchingZone ? '' : (table.zone || 'Salón principal');
    this.newZoneIcon = table.tableZone?.iconType || 'table';
    this.isTableFormOpen = true;
  }

  setZoneMode(mode: ZoneMode) {
    this.zoneMode = mode;

    if (mode === 'existing' && !this.tableForm.zoneId && this.allZones.length > 0) {
      this.tableForm.zoneId = this.allZones[0].id;
    }
  }

  closeTableForm() {
    if (this.isSaving) {
      return;
    }

    this.isTableFormOpen = false;
    this.resetForm();
  }

  async saveTable() {
    if (!this.isFormValid || this.isSaving) {
      this.presentToast('Completa el nombre, la capacidad y la zona de la mesa.', 'danger');
      return;
    }

    this.isSaving = true;
    try {
      const selectedZone = await this.resolveSelectedZone();
      const payload: CreateTableDto = {
        tableNumber: this.tableForm.tableNumber.trim(),
        capacity: Number(this.tableForm.capacity),
        zoneId: selectedZone.id,
        zone: selectedZone.name,
      };

      if (this.tableToEdit) {
        await firstValueFrom(this.tableService.updateTable(this.tableToEdit.id, payload));
        this.presentToast('Mesa actualizada correctamente.');
      } else {
        await firstValueFrom(this.tableService.addTable(payload));
        this.presentToast('Mesa creada correctamente.');
      }

      this.isTableFormOpen = false;
      this.resetForm();
      await this.loadConfiguration();
    } catch (error) {
      console.error('Error al guardar la mesa o su zona:', error);
      this.presentToast('No se pudo guardar. Revisa que el nombre de la zona o la mesa no esté repetido.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2200,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  async toggleTableStatus(table: TableI) {
    const newStatus = !table.isActive;
    const actionText = newStatus ? 'reactivar' : 'desactivar';
    const resultText = newStatus ? 'reactivada' : 'desactivada';

    const alert = await this.alertCtrl.create({
      header: 'Confirmar acción',
      message: `¿Deseas ${actionText} la mesa "${table.tableNumber}"?`,
      cssClass: 'confirmation-action-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-secondary-action' },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
          cssClass: 'alert-primary-action',
          handler: async () => {
            const updatedData: UpdateTableDto = { isActive: newStatus };
            try {
              await firstValueFrom(this.tableService.updateTable(table.id, updatedData));
              this.presentToast(`Mesa ${resultText} correctamente.`);
              await this.loadConfiguration();
            } catch (error) {
              console.error(`Error al ${actionText} la mesa:`, error);
              this.presentToast(`No se pudo ${actionText} la mesa.`, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  getZoneIcon(iconType: TableZoneIconType | null | undefined): string {
    return this.zoneIconOptions.find(option => option.value === iconType)?.icon
      || 'restaurant-outline';
  }

  getTableIcon(table: TableI): string {
    return this.getZoneIcon(table.tableZone?.iconType);
  }

  getZoneLabel(table: TableI): string {
    return table.tableZone?.name || table.zone?.trim() || 'Salón principal';
  }

  private async resolveSelectedZone(): Promise<TableZoneI> {
    if (this.zoneMode === 'existing') {
      const selectedZone = this.allZones.find(zone => zone.id === Number(this.tableForm.zoneId));
      if (!selectedZone) {
        throw new Error('Zona existente no encontrada');
      }
      return selectedZone;
    }

    const normalizedName = this.newZoneName.trim();
    const duplicatedZone = this.allZones.find(zone =>
      zone.name.toLocaleLowerCase('es') === normalizedName.toLocaleLowerCase('es'),
    );

    if (duplicatedZone) {
      return duplicatedZone;
    }

    const createdZone = await firstValueFrom(this.tableZonesService.addZone({
      name: normalizedName,
      iconType: this.newZoneIcon,
      displayOrder: this.allZones.length,
    }));
    this.allZones = [...this.allZones, createdZone];
    return createdZone;
  }

  private resetForm() {
    this.tableToEdit = null;
    this.tableForm = this.createEmptyForm();
    this.zoneMode = this.allZones.length > 0 ? 'existing' : 'new';
    this.newZoneName = '';
    this.newZoneIcon = 'table';
  }

  private createEmptyForm(): TableFormValue {
    return {
      tableNumber: '',
      capacity: 4,
      zoneId: this.allZones?.[0]?.id ?? null,
    };
  }

  private async confirmRemoveZone(zone: TableZoneI) {
    this.removingZoneId = zone.id;
    try {
      await firstValueFrom(this.tableZonesService.removeZone(zone.id));
      this.allZones = this.allZones.filter(currentZone => currentZone.id !== zone.id);
      if (this.zoneToEdit?.id === zone.id) {
        this.cancelZoneEdit();
      }
      this.presentToast('Zona eliminada de la lista.');
    } catch (error: any) {
      console.error('Error al quitar la zona:', error);
      this.presentToast(
        error?.error?.message || 'No se pudo quitar la zona.',
        'danger',
      );
    } finally {
      this.removingZoneId = null;
    }
  }
}
