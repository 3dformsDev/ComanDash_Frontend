import { Component, OnInit } from '@angular/core';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { CreatePaymentMethodDto, PaymentMethodI, PaymentMethodService, UpdatePaymentMethodDto } from '@services/payment-method.service';
import { firstValueFrom } from 'rxjs';
import { PaymentMethodFormComponent } from 'src/app/components/payment-method-form/payment-method-form.component';

@Component({
  selector: 'app-payment-methods-management',
  templateUrl: './payment-methods-management.page.html',
  styleUrls: ['./payment-methods-management.page.scss'],
  standalone: false,
})
export class PaymentMethodsManagementPage implements OnInit {

  // Lista de métodos de pago (vendría de un servicio)
  allPaymentMethods: PaymentMethodI[] = [];
  isLoading = true;

  // Objeto para mapear los tipos a etiquetas amigables
  readonly paymentMethodTypes = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    digital: 'Billetera Digital',
    transfer: 'Transferencia',
    other: 'Otro'
  };

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private _paymentMethodService: PaymentMethodService,
  ) { }

  ngOnInit() {
    this.loadPaymentMethods();
  }

  /**
  * Carga o recarga la lista de metodos de pago desde el servicio.
  */
  async loadPaymentMethods() {
    this.isLoading = true;
    try {
      this.allPaymentMethods = await firstValueFrom(this._paymentMethodService.getPaymentMethods());
      console.log('Metodos de pago:', this.allPaymentMethods);
    } catch (error) {
      console.error('Error al cargar las metodos de pago:', error);
      this.presentToast('No se pudieron cargar las metodos de pago.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // Muestra una alerta con un campo de texto para AÑADIR un nuevo método
  async addMethod() {
    const modal = await this.modalCtrl.create({
      component: PaymentMethodFormComponent,
      componentProps: {
        mode: 'new',
      },
      cssClass: 'cd-payment-method-form-modal',
    });


    await modal.present();

    // Esperamos a que el modal se cierre
    const { data, role } = await modal.onDidDismiss();

    if (role === 'save' && data) {
      try {
        // 'data' contiene el objeto actualizado del formulario
        await firstValueFrom(this._paymentMethodService.addPaymentMethod(data));
        this.presentToast('Método de pago actualizado.', 'success'); // Toast de éxito
        this.loadPaymentMethods();
      } catch (error) {
        this.presentToast('Error al actualizar el método.', 'danger');
      }
    }
  }

  // Muestra una alerta para EDITAR un método existente
  async editMethod(methodToEdit: PaymentMethodI) {
    const modal = await this.modalCtrl.create({
      component: PaymentMethodFormComponent,
      componentProps: {
        mode: 'edit',
        // Creamos una copia del objeto para no modificar el original en tiempo real
        paymentMethod: { ...methodToEdit }
      },
      cssClass: 'cd-payment-method-form-modal',
    });


    await modal.present();

    // Esperamos a que el modal se cierre
    const { data, role } = await modal.onDidDismiss();

    if (role === 'save' && data) {
      try {
        // 'data' contiene el objeto actualizado del formulario
        await firstValueFrom(this._paymentMethodService.updatePaymentMethod(methodToEdit.id, data));
        this.presentToast('Método de pago actualizado.', 'success'); // Toast de éxito
        this.loadPaymentMethods();
      } catch (error) {
        this.presentToast('Error al actualizar el método.', 'danger');
      }
    }
  }

  // Muestra una alerta de confirmación para ELIMINAR un método
  async deleteMethod(methodToDelete: { id: number, name: string }) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Seguro que quieres eliminar "${methodToDelete.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            // Lógica para eliminar el método
            this.allPaymentMethods = this.allPaymentMethods.filter(method => method.id !== methodToDelete.id);
            this.presentToast(`"${methodToDelete.name}" fue eliminado.`);
            // Aquí llamarías a tu servicio para eliminar de la DB
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
      duration: 2000,
      position: 'bottom',
      color: color,
    });
    toast.present();
  }

  /**
   * Activa o desactiva una mesa mostrando una alerta de confirmación.
   */
  async toggleMethodStatus(paymentMethod: PaymentMethodI) {
    const newStatus = !paymentMethod.isActive;
    const actionText = newStatus ? 'reactivar' : 'desactivar';
    const pastParticiple = newStatus ? 'reactivada' : 'desactivada';

    const alert = await this.alertCtrl.create({
      header: `Confirmar Acción`,
      message: `¿Estás seguro de que deseas ${actionText} el método de pago '${paymentMethod.name}'?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1), // Pone la primera letra en mayúscula
          handler: () => {
            const updatedData: UpdatePaymentMethodDto = { isActive: newStatus };

            this._paymentMethodService.updatePaymentMethod(paymentMethod.id, updatedData).subscribe({
              next: (updatedPaymentMethod) => {
                // Actualiza la lista local para que el cambio se vea al instante
                const index = this.allPaymentMethods.findIndex(c => c.id === paymentMethod.id);
                if (index !== -1) {
                  this.allPaymentMethods[index] = updatedPaymentMethod;
                }
                this.presentToast(`Método de pago ${pastParticiple}do exitosamente.`);
                this._paymentMethodService.getPaymentMethods().subscribe({
                  next: (paymentMethod) => {
                    this.allPaymentMethods = paymentMethod;
                  },
                  error: (error) => {
                    console.error('Error loading paymentMethod:', error);
                  }
                });
              },
              error: (err) => {
                console.error(`Error al ${pastParticiple} la método de pago:`, err);
                this.presentToast(`No se pudo ${pastParticiple} la método de pago.`, 'danger');
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  getMethodIcon(type: string): string {
    const icons: Record<string, string> = {
      cash: 'cash-outline',
      card: 'card-outline',
      digital: 'phone-portrait-outline',
      transfer: 'swap-horizontal-outline',
      other: 'wallet-outline',
    };

    return icons[type] || 'wallet-outline';
  }

  getMethodTypeLabel(type: string): string {
    return this.paymentMethodTypes[type as keyof typeof this.paymentMethodTypes] || 'Otro';
  }
}
