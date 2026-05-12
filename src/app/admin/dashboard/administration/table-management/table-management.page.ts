import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { CreateTableDto, TableI, TableService, UpdateTableDto } from '@services/table.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-table-management',
  templateUrl: './table-management.page.html',
  styleUrls: ['./table-management.page.scss'],
  standalone: false,
})
export class TableManagementPage implements OnInit {

  allTables: TableI[] = [];
  isLoading = true;

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private _tableService: TableService,
  ) { }

  ngOnInit() {
    this.loadTables();
  }

  /**
   * Carga o recarga la lista de mesas desde el servicio.
   */
  async loadTables() {
    this.isLoading = true;
    try {
      this.allTables = await firstValueFrom(this._tableService.getTables());
      console.log('Mesas cargadas:', this.allTables);
    } catch (error) {
      console.error('Error al cargar las mesas:', error);
      this.presentToast('No se pudieron cargar las mesas.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Muestra una alerta para AÑADIR una nueva mesa y llama al servicio.
   */
  async addTable() {
    const alert = await this.alertCtrl.create({
      header: 'Nueva Mesa',
      message: 'Ingresa los detalles de la nueva mesa.',
      inputs: [
        {
          name: 'tableNumber',
          type: 'text',
          placeholder: 'Ej: Mesa 10'
        },
        {
          name: 'capacity',
          type: 'number',
          placeholder: 'Capacidad (ej: 4)',
          min: 1
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          // El handler ahora es asíncrono para poder usar await
          handler: async (data) => {
            const tableNumber = data.tableNumber?.trim();
            const capacity = parseInt(data.capacity, 10);

            if (!tableNumber || isNaN(capacity) || capacity < 1) {
              this.presentToast('El nombre y una capacidad válida son requeridos.', 'danger');
              return false; // Evita que la alerta se cierre
            }

            // Creamos el DTO con los datos del formulario
            const newTableData: CreateTableDto = {
              tableNumber: tableNumber,
              capacity: capacity
            };

            try {
              // Llamamos al servicio para guardar la mesa en el backend
              await firstValueFrom(this._tableService.addTable(newTableData));

              this.presentToast('Mesa añadida exitosamente.');
              this.loadTables(); // Recargamos la lista para mostrar la nueva mesa
              return true; // Cierra la alerta
            } catch (error) {
              console.error('Error al guardar la mesa:', error);
              this.presentToast('Ocurrió un error al guardar la mesa.', 'danger');
              return false; // Mantiene la alerta abierta en caso de error
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Muestra una alerta para EDITAR una mesa existente
   */
  async editTable(tableToEdit: TableI) {
    const alert = await this.alertCtrl.create({
      header: 'Editar Mesa',
      inputs: [
        {
          name: 'tableNumber',
          type: 'text',
          value: tableToEdit.tableNumber
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Actualizar',
          handler: async (data) => {
            const newTableNumber = data.tableNumber?.trim();
            if (newTableNumber) {
              try {
                await firstValueFrom(this._tableService.updateTable(tableToEdit.id, { tableNumber: newTableNumber }));
                this.presentToast('Mesa actualizada.');
                this.loadTables();
                return true;
              } catch (error) {
                this.presentToast('Error al actualizar la mesa.', 'danger');
                return false;
              }
            } else {
              this.presentToast('El nombre no puede estar vacío.', 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Muestra una alerta de confirmación para ELIMINAR una mesa
   */
  async deleteTable(tableToDelete: TableI) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Seguro que quieres eliminar "${tableToDelete.tableNumber}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await firstValueFrom(this._tableService.deleteTable(tableToDelete.id));
              this.presentToast(`"${tableToDelete.tableNumber}" fue eliminada.`);
              this.loadTables();
            } catch (error) {
              this.presentToast('Error al eliminar la mesa.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Muestra un mensaje temporal (toast)
   */
  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: color,
    });
    toast.present();
  }

  /**
   * Activa o desactiva una mesa mostrando una alerta de confirmación.
   */
  async toggleTableStatus(table: TableI) {
    const newStatus = !table.isActive;
    const actionText = newStatus ? 'reactivar' : 'desactivar';
    const pastParticiple = newStatus ? 'reactivada' : 'desactivada';

    const alert = await this.alertCtrl.create({
      header: `Confirmar Acción`,
      message: `¿Estás seguro de que deseas ${actionText} la mesa '${table.tableNumber}'?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1), // Pone la primera letra en mayúscula
          handler: () => {
            const updatedData: UpdateTableDto = { isActive: newStatus };

            this._tableService.updateTable(table.id, updatedData).subscribe({
              next: (updatedTable) => {
                // Actualiza la lista local para que el cambio se vea al instante
                const index = this.allTables.findIndex(c => c.id === table.id);
                if (index !== -1) {
                  this.allTables[index] = updatedTable;
                }
                this.presentToast(`Mesa ${pastParticiple}da exitosamente.`);
                this._tableService.getTables().subscribe({
                  next: (tables) => {
                    this.allTables = tables;
                  },
                  error: (error) => {
                    console.error('Error loading tables:', error);
                  }
                });
              },
              error: (err) => {
                console.error(`Error al ${pastParticiple} la mesa:`, err);
                this.presentToast(`No se pudo ${pastParticiple} la mesa.`, 'danger');
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }
}

