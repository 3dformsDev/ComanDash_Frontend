import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { PaymentMethodI } from '@services/payment-method.service'; // Asegúrate que la ruta sea correcta

@Component({
  selector: 'app-payment-method-form',
  templateUrl: './payment-method-form.component.html',
  styleUrls: ['./payment-method-form.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class PaymentMethodFormComponent implements OnInit {

  @Input() mode: 'new' | 'edit' = 'new';
  // Usamos Partial para que al crear uno nuevo no exija todos los campos
  @Input() paymentMethod: Partial<PaymentMethodI> = {
    name: '',
    type: 'cash', // El tipo inicial es nulo
    isActive: true
  };

  // Objeto para mapear los tipos a etiquetas amigables para el usuario
  readonly paymentMethodTypes = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    digital: 'Billetera Digital',
    transfer: 'Transferencia',
    other: 'Otro'
  };

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    // Si estamos en modo edición, nos aseguramos que el objeto venga completo
    if (this.mode === 'edit' && !this.paymentMethod) {
      this.presentToast('Error: No se proporcionó un método de pago para editar.', 'danger');
      this.dismiss();
    }
  }

  // Función auxiliar para poder iterar sobre las llaves de un objeto en el template
  getObjectKeys(obj: object): (keyof typeof this.paymentMethodTypes)[] {
    return Object.keys(obj) as (keyof typeof this.paymentMethodTypes)[];
  }

  // Función auxiliar para obtener el label de un tipo
  getTypeLabel(key: string): string {
    return this.paymentMethodTypes[key as keyof typeof this.paymentMethodTypes];
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save() {
    if (!this.isFormValid()) {
      this.presentToast('Por favor, completa todos los campos obligatorios (*).', 'danger');
      return;
    }
    // Cerramos el modal y enviamos los datos del formulario.
    this.modalCtrl.dismiss(this.paymentMethod, 'save');
  }

  isFormValid(): boolean {
    const { name, type } = this.paymentMethod;
    const isNameValid = Boolean(name && name.trim().length > 0);
    const isTypeValid = Boolean(type);

    return isNameValid && isTypeValid;
  }

  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2500,
      position: 'top',
      color: color,
      icon: 'alert-circle-outline'
    });
    toast.present();
  }
}
