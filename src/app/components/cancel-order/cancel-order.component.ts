import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { PaymentMethodI, PaymentMethodService } from '@services/payment-method.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-cancel-order',
  templateUrl: './cancel-order.component.html',
  styleUrls: ['./cancel-order.component.scss'],
  imports: [IonicModule, CommonModule, FormsModule]
})
export class CancelOrderComponent implements OnInit {
  @Input() order: any; // Recibimos la orden para mostrar su número

  allPaymentMethods: PaymentMethodI[] = [];
  reason: string = '';
  selectedPaymentMethodId: number | null = null;

  // ✅ 1. Nueva propiedad para el monto a devolver
  public refundAmount: number = 0;

  constructor(
    private modalCtrl: ModalController,
    private paymentMethodService: PaymentMethodService
  ) { }

  async ngOnInit() {
    // Obtenemos solo los métodos de pago activos para el reembolso
    this.allPaymentMethods = await firstValueFrom(this.paymentMethodService.getPaymentMethods(true));
    // ✅ 2. Calculamos el monto a devolver cuando el componente se inicia
    if (this.order && this.order.totalAmount) {
      // Convertimos el totalAmount (que puede ser un string) a un número
      this.refundAmount = parseFloat(this.order.totalAmount);
    }
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    if (!this.reason || !this.selectedPaymentMethodId) {
      return;
    }
    const result = {
      reason: this.reason,
      paymentMethodId: this.selectedPaymentMethodId
    };
    this.modalCtrl.dismiss(result, 'confirm');
  }

  // Método helper para obtener el icono según el tipo de método de pago
  getPaymentMethodIcon(paymentType: string): string {
    const iconMap: { [key: string]: string } = {
      'credit_card': 'card',
      'debit_card': 'card-outline',
      'cash': 'cash',
      'bank_transfer': 'business',
      'digital_wallet': 'wallet',
      'paypal': 'logo-paypal',
      'stripe': 'card',
      'mercadopago': 'wallet-outline',
      'nequi': 'phone-portrait',
      'daviplata': 'phone-portrait-outline',
      'efecty': 'storefront',
      'pse': 'business-outline',
      'default': 'card-outline'
    };

    return iconMap[paymentType] || iconMap['default'];
  }
}
