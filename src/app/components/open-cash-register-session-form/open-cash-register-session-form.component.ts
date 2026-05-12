import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';

export interface OpenSessionPayload {
  cashRegisterId: number;
  openingBalance: number;
  notes: string;
  status: 'open';
}

@Component({
  selector: 'app-open-cash-register-session-form',
  templateUrl: './open-cash-register-session-form.component.html',
  styleUrls: ['./open-cash-register-session-form.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class OpenCashRegisterSessionFormComponent implements OnInit {

  @Input() cashRegisterId!: number;
  @Input() cashRegisterName: string = 'Caja';

  formData = {
    openingBalance: null as number | null,
    notes: ''
  };

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    if (!this.cashRegisterId) {
      this.presentToast('Error: No se especificó una caja para abrir.', 'danger');
      this.dismiss();
    }
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save() {
    if (!this.isFormValid()) {
      this.presentToast('Por favor, ingresa un monto de apertura válido.', 'danger');
      return;
    }

    const payload: OpenSessionPayload = {
      cashRegisterId: this.cashRegisterId,
      openingBalance: this.formData.openingBalance!,
      notes: this.formData.notes.trim(),
      status: 'open'
    };

    this.modalCtrl.dismiss(payload, 'save');
  }

  isFormValid(): boolean {
    const { openingBalance } = this.formData;
    return openingBalance !== null && !isNaN(openingBalance) && openingBalance >= 0;
  }

  // --- MÉTODO AÑADIDO ---
  /**
   * Formatea el valor del input en tiempo real para mostrarlo como moneda,
   * pero mantiene el valor numérico real en el modelo de datos.
   */
  formatOpeningBalance(event: any) {
    // 1. Limpia el valor de entrada, dejando solo los números.
    let rawValue = event.target.value.replace(/[^0-9]/g, '');

    // 2. Si no hay valor, establece el modelo a null.
    if (!rawValue) {
      this.formData.openingBalance = null;
      return;
    }

    // 3. Convierte el valor limpio a un número y lo guarda en el modelo.
    // Este es el valor real que se usará para la validación y al guardar.
    this.formData.openingBalance = parseInt(rawValue, 10);

    // 4. Crea una versión formateada para mostrar en la pantalla (Ej: "150.000").
    const formattedValue = new Intl.NumberFormat('es-CO').format(this.formData.openingBalance);

    // 5. Actualiza el valor visible en el input. Usamos setTimeout para evitar
    // conflictos con el ciclo de detección de cambios de Angular.
    setTimeout(() => {
      event.target.value = formattedValue;
    }, 0);
  }

  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
      color,
      icon: 'alert-circle-outline'
    });
    toast.present();
  }
}