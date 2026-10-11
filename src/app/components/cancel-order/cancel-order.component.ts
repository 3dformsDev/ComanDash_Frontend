import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import {
  PaymentMethodI,
  PaymentMethodService,
} from '@services/payment-method.service';
import { firstValueFrom } from 'rxjs';
import { InventoryService, InventoryReturn } from '@services/inventory.service';
import { InventoryReturnComponent, returnsValid } from '../inventory-return/inventory-return.component';

@Component({
  selector: 'app-cancel-order',
  templateUrl: './cancel-order.component.html',
  styleUrls: ['./cancel-order.component.scss'],
  imports: [IonicModule, CommonModule, FormsModule, InventoryReturnComponent],
})
export class CancelOrderComponent implements OnInit {
  private inventory = inject(InventoryService);
  @Input() order: any; // Recibimos la orden para mostrar su número
  @Input() withRefund = true;
  inventoryReturns: InventoryReturn[] = [];
  inventoryLoading = true;
  inventoryError = '';
  get canConfirm() { return !this.inventoryLoading && !this.inventoryError && returnsValid(this.inventoryReturns)
    && (!this.withRefund || (!!this.reason.trim() && !!this.selectedPaymentMethodId)); }

  allPaymentMethods: PaymentMethodI[] = [];
  reason: string = '';
  selectedPaymentMethodId: number | null = null;

  // ✅ 1. Nueva propiedad para el monto a devolver
  public refundAmount: number = 0;

  getOrderAdjustments(): any[] {
    if (Array.isArray(this.order?.adjustments)) {
      return this.order.adjustments;
    }

    if (Array.isArray(this.order?.paymentSummary?.adjustments)) {
      return this.order.paymentSummary.adjustments;
    }

    return [];
  }

  getAdjustmentSign(adjustment: any): string {
    return adjustment?.type === 'discount' ? '-' : '+';
  }

  getAdjustmentClass(adjustment: any): string {
    return adjustment?.type === 'discount'
      ? 'discount-adjustment'
      : 'charge-adjustment';
  }

  private getNetPaidAmount(): number {
    if (Array.isArray(this.order?.payments) && this.order.payments.length > 0) {
      return Math.max(
        0,
        this.order.payments.reduce(
          (total: number, payment: any) =>
            total + Number(payment?.amount || 0),
          0,
        ),
      );
    }

    if (this.order?.paymentSummary?.paidAmount !== undefined) {
      return Math.max(0, Number(this.order.paymentSummary.paidAmount || 0));
    }

    return Math.max(0, Number(this.order?.totalAmount || 0));
  }

  constructor(
    private modalCtrl: ModalController,
    private paymentMethodService: PaymentMethodService,
  ) {}

  async ngOnInit() {
    try {
      const preview = await firstValueFrom(this.inventory.preview(this.order.id, this.order.inventoryVersion ?? 0, 'return'));
      this.inventoryReturns = preview.items;
      if (this.withRefund) {
        this.allPaymentMethods = await firstValueFrom(this.paymentMethodService.getPaymentMethods(true));
        this.refundAmount = this.getNetPaidAmount();
      }
    } catch (error: any) { this.inventoryError = error.error?.message || 'No se pudo revisar el pedido. Cierra esta ventana y vuelve a intentarlo.'; }
    finally { this.inventoryLoading = false; }
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    if (!this.canConfirm) {
      return;
    }
    const result = {
      reason: this.reason,
      paymentMethodId: this.withRefund ? this.selectedPaymentMethodId : undefined,
      expectedOrderVersion: this.order.inventoryVersion ?? 0,
      inventoryReturns: this.inventoryReturns,
    };
    this.modalCtrl.dismiss(result, 'confirm');
  }

  // Método helper para obtener el icono según el tipo de método de pago
  getPaymentMethodIcon(paymentType: string): string {
    const iconMap: { [key: string]: string } = {
      credit_card: 'card',
      debit_card: 'card-outline',
      cash: 'cash',
      bank_transfer: 'business',
      digital_wallet: 'wallet',
      paypal: 'logo-paypal',
      stripe: 'card',
      mercadopago: 'wallet-outline',
      nequi: 'phone-portrait',
      daviplata: 'phone-portrait-outline',
      efecty: 'storefront',
      pse: 'business-outline',
      default: 'card-outline',
    };

    return iconMap[paymentType] || iconMap['default'];
  }
}
