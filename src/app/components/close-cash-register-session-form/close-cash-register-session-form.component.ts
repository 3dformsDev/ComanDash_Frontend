import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';

// Interfaz para el resumen que recibimos de la API
export interface SessionSummaryI {
  status: 'open' | 'closed';
  openingBalance: number;
  transactions: {
    incomeByPaymentMethod: { name: string; total: number }[];
    totalSales: number;
    totalWithdrawals: number;
  };
  expectedClosingBalance: number;
}

// DTO que el formulario devuelve al guardar
export interface CloseSessionPayload {
  realClosingBalance: number;
  notes: string;
}

@Component({
  selector: 'app-close-cash-register-session-form',
  templateUrl: './close-cash-register-session-form.component.html',
  styleUrls: ['./close-cash-register-session-form.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class CloseCashRegisterSessionFormComponent implements OnInit {

  // --- CAMBIO: Ahora recibimos el objeto de resumen completo ---
  @Input() sessionId!: number;
  @Input() cashRegisterName: string = 'Caja';
  @Input({ required: true }) summary!: SessionSummaryI;

  formData = {
    realClosingBalance: null as number | null,
    notes: ''
  };
  difference: number = 0;

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    console.log(this.sessionId + '' + this.summary);
    
    if (!this.sessionId || !this.summary) {
      this.presentToast('Error: Faltan datos esenciales para cerrar la caja.', 'danger');
      this.dismiss();
      return;
    }
    // Inicializar la diferencia
    this.calculateDifference();
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  save() {
    if (!this.isFormValid()) {
      this.presentToast('Por favor, ingresa el monto real contado en caja.', 'danger');
      return;
    }
    const payload: CloseSessionPayload = {
      realClosingBalance: this.formData.realClosingBalance!,
      notes: this.formData.notes.trim()
    };
    this.modalCtrl.dismiss(payload, 'save');
  }

  isFormValid(): boolean {
    const { realClosingBalance } = this.formData;
    return realClosingBalance !== null && !isNaN(realClosingBalance) && realClosingBalance >= 0;
  }

  formatAndCalculate(event: any) {
    let rawValue = event.target.value.replace(/[^0-9]/g, '');
    if (!rawValue) {
      this.formData.realClosingBalance = null;
    } else {
      this.formData.realClosingBalance = parseInt(rawValue, 10);
      const formattedValue = new Intl.NumberFormat('es-CO').format(this.formData.realClosingBalance);
      setTimeout(() => { event.target.value = formattedValue; }, 0);
    }
    this.calculateDifference();
  }

  /**
   * Calcula la diferencia entre el saldo real y el esperado.
   */
  calculateDifference() {
    const real = this.formData.realClosingBalance ?? 0;
    // ✅ CAMBIO: Usamos el valor que viene dentro del objeto summary
    this.difference = real - this.summary.expectedClosingBalance;
  }

  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastCtrl.create({
      message, duration: 2500, position: 'top', color, icon: 'alert-circle-outline'
    });
    toast.present();
  }
}