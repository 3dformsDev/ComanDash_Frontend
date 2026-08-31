import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import {
  ModifierGroupI,
  ModifierOptionI,
  PersonalizationsService,
} from '@services/personalizations.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-personalizations',
  templateUrl: './personalizations.page.html',
  styleUrls: ['./personalizations.page.scss'],
  standalone: false,
})
export class PersonalizationsPage {
  groups: ModifierGroupI[] = [];
  loading = false;
  saving = false;
  expandedGroups = new Set<number>();

  constructor(
    private readonly personalizationsService: PersonalizationsService,
    private readonly alertController: AlertController,
    private readonly toastController: ToastController,
  ) {}

  async ionViewWillEnter() {
    await this.loadGroups();
  }

  async loadGroups() {
    this.loading = true;
    try {
      this.groups = await firstValueFrom(this.personalizationsService.getGroups(false));
      this.groups.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error al cargar personalizaciones:', error);
      await this.presentToast('No fue posible cargar las personalizaciones.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  toggleExpanded(groupId: number) {
    if (this.expandedGroups.has(groupId)) {
      this.expandedGroups.delete(groupId);
    } else {
      this.expandedGroups.add(groupId);
    }
  }

  async addGroup() {
    const alert = await this.alertController.create({
      header: 'Nuevo grupo de opciones',
      message:
        'Crea un grupo para reunir opciones relacionadas. Ejemplos: tipos de carne, salsas, tamaños, acompañamientos, sabores o bebidas.',
      cssClass: ['management-form-alert'],
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nombre del grupo' },
        { name: 'description', type: 'textarea', placeholder: 'Descripción opcional' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-secondary-action' },
        {
          text: 'Guardar',
          cssClass: 'alert-primary-action',
          handler: (data) => {
            const name = data.name?.trim();
            if (!name) {
              void this.presentToast('Escribe un nombre para el grupo.', 'danger');
              return false;
            }
            void this.createGroup(name, data.description?.trim() || null);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async editGroup(group: ModifierGroupI) {
    const alert = await this.alertController.create({
      header: 'Editar grupo de opciones',
      cssClass: ['management-form-alert'],
      inputs: [
        { name: 'name', type: 'text', value: group.name, placeholder: 'Nombre del grupo' },
        {
          name: 'description',
          type: 'textarea',
          value: group.description || '',
          placeholder: 'Descripción opcional',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-secondary-action' },
        {
          text: 'Actualizar',
          cssClass: 'alert-primary-action',
          handler: (data) => {
            const name = data.name?.trim();
            if (!name) {
              void this.presentToast('El nombre no puede estar vacío.', 'danger');
              return false;
            }
            void this.updateGroup(group, name, data.description?.trim() || null);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmGroupStatus(group: ModifierGroupI) {
    const newStatus = !group.isActive;
    const action = newStatus ? 'reactivar' : 'desactivar';
    const alert = await this.alertController.create({
      header: `${newStatus ? 'Reactivar' : 'Desactivar'} grupo`,
      message: `¿Deseas ${action} “${group.name}”? Las comandas anteriores conservarán su información.`,
      cssClass: ['confirmation-action-alert'],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-secondary-action' },
        {
          text: newStatus ? 'Reactivar' : 'Desactivar',
          role: newStatus ? undefined : 'destructive',
          cssClass: 'alert-primary-action',
          handler: () => {
            void this.setGroupStatus(group, newStatus);
          },
        },
      ],
    });
    await alert.present();
  }

  async addOption(groupId: number) {
    const group = this.groups.find((item) => item.id === groupId);
    if (!group) {
      await this.presentToast('Primero selecciona un grupo de opciones.', 'warning');
      return;
    }
    if (!group.isActive) {
      await this.presentToast('Reactiva el grupo antes de agregar opciones.', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: `Nueva opción · ${group.name}`,
      cssClass: ['management-form-alert'],
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Ej.: Pastor, Grande, Sin hielo o Vainilla',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-secondary-action' },
        {
          text: 'Guardar',
          cssClass: 'alert-primary-action',
          handler: (data) => {
            const name = data.name?.trim();
            if (!name) {
              void this.presentToast('Escribe un nombre para la opción.', 'danger');
              return false;
            }
            void this.createOption(group, name);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async editOption(option: ModifierOptionI) {
    const alert = await this.alertController.create({
      header: 'Editar opción',
      cssClass: ['management-form-alert'],
      inputs: [{ name: 'name', type: 'text', value: option.name }],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-secondary-action' },
        {
          text: 'Actualizar',
          cssClass: 'alert-primary-action',
          handler: (data) => {
            const name = data.name?.trim();
            if (!name) {
              void this.presentToast('El nombre no puede estar vacío.', 'danger');
              return false;
            }
            void this.updateOption(option, name);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmOptionStatus(option: ModifierOptionI) {
    const newStatus = !option.isActive;
    const alert = await this.alertController.create({
      header: `${newStatus ? 'Reactivar' : 'Desactivar'} opción`,
      message: `¿Deseas ${newStatus ? 'reactivar' : 'desactivar'} “${option.name}”?`,
      cssClass: ['confirmation-action-alert'],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-secondary-action' },
        {
          text: newStatus ? 'Reactivar' : 'Desactivar',
          role: newStatus ? undefined : 'destructive',
          cssClass: 'alert-primary-action',
          handler: () => void this.setOptionStatus(option, newStatus),
        },
      ],
    });
    await alert.present();
  }

  async moveGroup(group: ModifierGroupI, direction: -1 | 1) {
    const index = this.groups.findIndex((item) => item.id === group.id);
    const target = this.groups[index + direction];
    if (!target) return;

    try {
      this.saving = true;
      await Promise.all([
        firstValueFrom(this.personalizationsService.updateGroup(group.id, { displayOrder: target.displayOrder })),
        firstValueFrom(this.personalizationsService.updateGroup(target.id, { displayOrder: group.displayOrder })),
      ]);
      await this.loadGroups();
    } catch (error) {
      await this.presentToast('No fue posible cambiar el orden.', 'danger');
    } finally {
      this.saving = false;
    }
  }

  sortedOptions(group: ModifierGroupI): ModifierOptionI[] {
    return [...group.options].sort(
      (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
    );
  }

  async moveOption(group: ModifierGroupI, option: ModifierOptionI, direction: -1 | 1) {
    const options = this.sortedOptions(group);
    const index = options.findIndex((item) => item.id === option.id);
    const target = options[index + direction];
    if (!target) return;

    try {
      this.saving = true;
      await Promise.all([
        firstValueFrom(this.personalizationsService.updateOption(option.id, { displayOrder: target.displayOrder })),
        firstValueFrom(this.personalizationsService.updateOption(target.id, { displayOrder: option.displayOrder })),
      ]);
      await this.loadGroups();
    } catch (error) {
      await this.presentToast('No fue posible cambiar el orden.', 'danger');
    } finally {
      this.saving = false;
    }
  }

  trackById(_: number, item: { id: number }) {
    return item.id;
  }

  private async createGroup(name: string, description: string | null) {
    try {
      this.saving = true;
      const nextOrder = this.groups.length
        ? Math.max(...this.groups.map((group) => group.displayOrder)) + 1
        : 0;
      const group = await firstValueFrom(
        this.personalizationsService.createGroup({ name, description, displayOrder: nextOrder }),
      );
      this.expandedGroups.add(group.id);
      await this.loadGroups();
      await this.presentToast('Grupo creado correctamente.');
    } catch (error: any) {
      await this.presentToast(this.errorMessage(error, 'No fue posible crear el grupo.'), 'danger');
    } finally {
      this.saving = false;
    }
  }

  private async updateGroup(group: ModifierGroupI, name: string, description: string | null) {
    try {
      this.saving = true;
      await firstValueFrom(this.personalizationsService.updateGroup(group.id, { name, description }));
      await this.loadGroups();
      await this.presentToast('Grupo actualizado correctamente.');
    } catch (error: any) {
      await this.presentToast(this.errorMessage(error, 'No fue posible actualizar el grupo.'), 'danger');
    } finally {
      this.saving = false;
    }
  }

  private async setGroupStatus(group: ModifierGroupI, isActive: boolean) {
    try {
      this.saving = true;
      await firstValueFrom(this.personalizationsService.updateGroup(group.id, { isActive }));
      await this.loadGroups();
      await this.presentToast(`Grupo ${isActive ? 'reactivado' : 'desactivado'} correctamente.`);
    } catch (error: any) {
      await this.presentToast(this.errorMessage(error, 'No fue posible cambiar el estado.'), 'danger');
    } finally {
      this.saving = false;
    }
  }

  private async createOption(group: ModifierGroupI, name: string) {
    try {
      this.saving = true;
      const nextOrder = group.options.length
        ? Math.max(...group.options.map((option) => option.displayOrder)) + 1
        : 0;
      await firstValueFrom(
        this.personalizationsService.createOption({
          modifierGroupId: group.id,
          name,
          displayOrder: nextOrder,
        }),
      );
      await this.loadGroups();
      await this.presentToast('Opción creada correctamente.');
    } catch (error: any) {
      await this.presentToast(this.errorMessage(error, 'No fue posible crear la opción.'), 'danger');
    } finally {
      this.saving = false;
    }
  }

  private async updateOption(option: ModifierOptionI, name: string) {
    try {
      this.saving = true;
      await firstValueFrom(this.personalizationsService.updateOption(option.id, { name }));
      await this.loadGroups();
      await this.presentToast('Opción actualizada correctamente.');
    } catch (error: any) {
      await this.presentToast(this.errorMessage(error, 'No fue posible actualizar la opción.'), 'danger');
    } finally {
      this.saving = false;
    }
  }

  private async setOptionStatus(option: ModifierOptionI, isActive: boolean) {
    try {
      this.saving = true;
      await firstValueFrom(this.personalizationsService.updateOption(option.id, { isActive }));
      await this.loadGroups();
      await this.presentToast(`Opción ${isActive ? 'reactivada' : 'desactivada'} correctamente.`);
    } catch (error: any) {
      await this.presentToast(this.errorMessage(error, 'No fue posible cambiar el estado.'), 'danger');
    } finally {
      this.saving = false;
    }
  }

  private errorMessage(error: any, fallback: string) {
    return error?.error?.message || error?.error?.errors?.[0]?.message || fallback;
  }

  private async presentToast(
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success',
  ) {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 2400,
      position: 'bottom',
    });
    await toast.present();
  }
}
