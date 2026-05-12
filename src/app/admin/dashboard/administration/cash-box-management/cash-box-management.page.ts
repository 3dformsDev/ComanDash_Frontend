import { Component, OnInit } from '@angular/core';
import { AppState } from '@capacitor/app';
import { AlertController, LoadingController, ModalController, ToastController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { CashRegisterSessionService } from '@services/cash-register-session.service';
import { CashRegisterI, CashRegisterService, CreateCashRegisterDto, UpdateCashRegisterDto } from '@services/cash-register.service';
import { selectLocationId } from '@store/auth/selectors/auth.selectors';
import { firstValueFrom } from 'rxjs';
import { CloseCashRegisterSessionFormComponent, CloseSessionPayload } from 'src/app/components/close-cash-register-session-form/close-cash-register-session-form.component';
import { OpenCashRegisterSessionFormComponent, OpenSessionPayload } from 'src/app/components/open-cash-register-session-form/open-cash-register-session-form.component';

@Component({
  selector: 'app-cash-box-management',
  templateUrl: './cash-box-management.page.html',
  styleUrls: ['./cash-box-management.page.scss'],
  standalone: false
})
export class CashBoxManagementPage implements OnInit {

  // Lista de cajas (vendría de un servicio)
  allCashRegisters: CashRegisterI[] = [];
  isSessionOpenInLocation: boolean = false;

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController,
    private _cashRegisterService: CashRegisterService,
    private _cashRegisterSessionService: CashRegisterSessionService,
    private store: Store<AppState>
  ) { }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    try {
      // Cargar categorías activas
      this.allCashRegisters = await firstValueFrom(this._cashRegisterService.getCashRegisters());

      this.isSessionOpenInLocation = this.allCashRegisters.some(
        (box) => box.cashRegisterSession.isOpen === true
      );
    } catch (error) {
      console.error('Error al cargar los datos:', error);
      this.presentToast('Error al cargar los datos', 'danger');
    }
  }

  // Cambia el estado de una caja (abierta/cerrada)
  toggleStatus(box: any, event: any) {
    box.status = event.detail.checked ? 'open' : 'closed';
    this.presentToast(`La ${box.name} ha sido ${box.status === 'open' ? 'abierta' : 'cerrada'}.`);
    // Aquí llamarías a tu servicio para guardar el cambio en la DB
  }

  // --- MÉTODOS DE GESTIÓN DE CAJAS (Configuración) ---

  async addCashRegister() {
    const alert = await this.alertCtrl.create({
      header: 'Nueva Caja',
      inputs: [
        {
          name: 'name', type: 'text', placeholder: 'Nombre de la caja (Ej: Principal)'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            const name = data.name.trim();
            if (!name) {
              this.presentToast('El nombre es obligatorio.', 'danger');
              return false; // Evita que se cierre la alerta
            }
            const locationId = await firstValueFrom(this.store.select(selectLocationId));
            if (locationId) {
              const newRegister: CreateCashRegisterDto = { name, locationId, initialBalance: "0" }; // locationId debe ser dinámico, initialBalance es 0 por defecto
              this._cashRegisterService.addCashRegister(newRegister).subscribe({
                next: () => {
                  this.presentToast('Caja creada exitosamente.');
                  this.loadData();
                },
                error: (err) => {
                  this.presentToast(`Hubo un error al guardar la caja: ${err}`, 'danger');
                }
              });
              return true;
            } else {
              this.presentToast('No se pudo obtener la ubicación.', 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Muestra una alerta para EDITAR una caja existente
  async editCashbox(boxToEdit: any) {
    const alert = await this.alertCtrl.create({
      header: 'Editar Caja',
      inputs: [
        { name: 'boxName', type: 'text', value: boxToEdit.name },
        { name: 'balance', type: 'number', value: boxToEdit.initialBalance, min: 0 }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Actualizar',
          handler: (data) => {
            const name = data.boxName.trim();
            const balance = parseFloat(data.balance);

            if (name && !isNaN(balance) && balance >= 0) {
              boxToEdit.name = name;
              boxToEdit.initialBalance = balance;
              this.presentToast('Caja actualizada.');
              // Aquí llamarías a tu servicio para actualizar en la DB
              return true;
            } else {
              this.presentToast('Datos inválidos.', 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Muestra un mensaje temporal (toast)
  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2500,
      position: 'bottom',
      color: color,
    });
    toast.present();
  }

  async openSession(cashRegister: CashRegisterI) {
    const modal = await this.modalCtrl.create({
      component: OpenCashRegisterSessionFormComponent,
      componentProps: {
        cashRegisterId: cashRegister.id,
        cashRegisterName: cashRegister.name
      },
      // Puedes añadir un cssClass para estilizar el modal si lo necesitas
      // cssClass: 'my-custom-modal-css' 
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss<OpenSessionPayload>();

    if (role === 'save' && data) {
      // ✅ ¡Aquí tienes los datos listos para enviar a la API!
      this._cashRegisterSessionService.openSession({ ...data, openingBalance: data.openingBalance.toString() }).subscribe({
        next: () => {
          this.presentToast(`Sesión de ${cashRegister.name} abierta exitosamente.`, 'success');
          this.loadData(); // Recarga los datos para mostrar el nuevo estado
        },
        error: (err) => {
          this.presentToast(`Error al abrir caja: ${JSON.stringify(err)}`, 'danger');
        }
      });
    }
  }

  async closeSession(cashRegister: CashRegisterI) {
    const sessionInfo = cashRegister.cashRegisterSession;

    // Verificación inicial para asegurar que hay una sesión que cerrar
    if (!sessionInfo?.isOpen || !sessionInfo.idCashRegisterSession) {
      this.presentToast('Esta caja no tiene una sesión activa para cerrar.', 'warning');
      return;
    }

    const sessionId = sessionInfo.idCashRegisterSession;

    // Muestra un indicador de carga mientras se obtiene el resumen
    const loading = await this.loadingCtrl.create({
      message: 'Obteniendo resumen de caja...',
    });
    await loading.present();

    try {
      // 1. Obtener el resumen de la sesión desde el backend
      const summary = await firstValueFrom(this._cashRegisterSessionService.getSessionSummary(sessionId));

      await loading.dismiss(); // Ocultar el primer loading

      // // 2. Abrir el modal del formulario de cierre

      console.log(`Valores antes de enviarse ${sessionId + cashRegister.name + summary.expectedClosingBalance}`);

      const modal = await this.modalCtrl.create({
        component: CloseCashRegisterSessionFormComponent,
        componentProps: {
          sessionId: sessionId,
          cashRegisterName: cashRegister.name,
          summary: summary // <- Le pasamos el saldo esperado
        }
      });

      await modal.present();

      const { data, role } = await modal.onWillDismiss<CloseSessionPayload>();

      // // 3. Si el usuario guardó, proceder a cerrar la sesión
      if (role === 'save' && data) {
        const closingLoading = await this.loadingCtrl.create({
          message: 'Cerrando sesión...',
        });
        await closingLoading.present();

        try {
          await firstValueFrom(this._cashRegisterSessionService.closeSession(sessionId, { ...data, realClosingBalance: data.realClosingBalance.toString() }));

          this.presentToast(`Sesión de ${cashRegister.name} cerrada exitosamente.`, 'success');
          this.loadData(); // Recargar la lista para reflejar el cambio de estado
        } catch (err: any) {
          this.presentToast(`No se pudo cerrar la sesión: ${JSON.stringify(err.error.message)}`, 'danger');
        } finally {
          await closingLoading.dismiss(); // Asegurarse de ocultar el loading final
        }
      }
    } catch (err) {
      await loading.dismiss(); // Ocultar el loading si falla el resumen
      this.presentToast(`Error al obtener resumen de caja: ${JSON.stringify(err)}`, 'danger');
    }
  }

  async editCashRegister(cashRegister: CashRegisterI) {
    const alert = await this.alertCtrl.create({
      header: 'Editar Nombre',
      inputs: [{ name: 'name', type: 'text', value: cashRegister.name }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Actualizar',
          handler: async (data) => {
            const newName = data.name.trim();
            if (!newName || newName === cashRegister.name) return true;

            const updateDto: UpdateCashRegisterDto = { name: newName };
            try {
              await firstValueFrom(this._cashRegisterService.updateCashRegister(cashRegister.id, updateDto));
              this.presentToast('Caja actualizada exitosamente.', 'success');
              this.loadData();
              return true;
            } catch (err: any) {
              this.presentToast(`No se pudo actualizar la caja: ${JSON.stringify(err.error?.message || err)}`, 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ✅ MÉTODO IMPLEMENTADO
  async toggleRegisterStatus(cashRegister: CashRegisterI) {
    const action = cashRegister.isActive ? 'desactivar' : 'reactivar';
    const alert = await this.alertCtrl.create({
      header: `Confirmar`,
      message: `¿Seguro que quieres ${action} la caja "${cashRegister.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: `${action.endsWith('ar') ? action.slice(0, -2) : action}ando...` });
            await loading.present();
            try {
              if (cashRegister.isActive) {
                // Para DESACTIVAR, se llama al endpoint DELETE del servicio
                await firstValueFrom(this._cashRegisterService.deactivateCashRegister(cashRegister.id));
              } else {
                // Para REACTIVAR, se llama al endpoint UPDATE del servicio
                await firstValueFrom(this._cashRegisterService.updateCashRegister(cashRegister.id, { isActive: true }));
              }
              this.presentToast(`Caja ${action}da exitosamente.`, 'success');
              this.loadData();
            } catch (err: any) {
              this.presentToast(`No se pudo ${action} la caja: ${JSON.stringify(err.error?.message || err)}`, 'danger');
            } finally {
              await loading.dismiss();
            }
          }
        }
      ]
    });
    await alert.present();
  }


}
