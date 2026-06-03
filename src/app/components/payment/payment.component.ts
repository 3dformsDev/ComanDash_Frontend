import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import {
  PaymentMethodI,
  PaymentMethodService,
} from '@services/payment-method.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class PaymentComponent implements OnInit {
  @Input() orderToPay: any;
  @Input() originalOrderItems: any[] = [];
  @Input() isEditMode: boolean = false;

  public orderItems: any[] = [];
  public total: number = 0; // El monto final a mostrar en la UI (siempre positivo)
  public paymentDifference: number = 0; // El cálculo real (puede ser +/-)
  public isRefund: boolean = false;
  public pageTitle: string = 'Detalle de la Cuenta';
  public allPaymentMethods: PaymentMethodI[] = [];
  public selectedPaymentMethod: number | null = null;
  public paymentAmount: number | null = null;
  public paymentError: string | null = null;

  // ✅ Propiedades para la propina, ahora se manejan aquí
  public includeTip: boolean = false;
  public tipAmount: number = 0;
  public notesPayment: string = 'Pago de diferencia por modificación';

  public adjustments: any[] = [];

  constructor(
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private _paymentMethodService: PaymentMethodService,
  ) {}

  async ngOnInit() {
    this.orderItems = Object.values(this.orderToPay.items);
    this.allPaymentMethods = await firstValueFrom(
      this._paymentMethodService.getPaymentMethods(true),
    );

    // ✅ La lógica ahora está encapsulada en el if/else
    if (this.isEditMode && this.originalOrderItems.length > 0) {
      this.calculateDifference();
    } else {
      this.calculateTotalForNewOrder();
    }

    this.syncDefaultPaymentAmount();
  }

  // ✅ Renombrado para mayor claridad y ahora maneja la propina
  calculateTotalForNewOrder() {
    const calculatedSubtotal = this.orderItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );

    const explicitTotalAmount = Number(this.orderToPay?.totalAmount || 0);
    const subtotal =
      explicitTotalAmount > 0 ? explicitTotalAmount : calculatedSubtotal;

    this.tipAmount = subtotal * 0.1;

    const charges = this.adjustments
      .filter((adj) => adj.type === 'charge')
      .reduce((acc, adj) => acc + adj.amount, 0);

    const discounts = this.adjustments
      .filter((adj) => adj.type === 'discount')
      .reduce((acc, adj) => acc + adj.amount, 0);

    this.total =
      subtotal + charges - discounts + (this.includeTip ? this.tipAmount : 0);

    this.syncDefaultPaymentAmount();
  }
  // ✅ Este método se queda como estaba
  calculateDifference() {
    const originalQuantities = new Map<number, number>();
    this.originalOrderItems.forEach((item) => {
      originalQuantities.set(item.productId, item.quantity);
    });

    const newQuantities = new Map<
      number,
      { quantity: number; price: number }
    >();
    this.orderItems.forEach((item) => {
      newQuantities.set(item.id, {
        quantity: item.quantity,
        price: parseFloat(item.price),
      });
    });

    let difference = 0;
    const allProductIds = new Set([
      ...originalQuantities.keys(),
      ...newQuantities.keys(),
    ]);

    allProductIds.forEach((id) => {
      const originalQty = originalQuantities.get(id) || 0;
      const newQtyData = newQuantities.get(id);
      const newQty = newQtyData ? newQtyData.quantity : 0;
      const price = newQtyData
        ? newQtyData.price
        : this.originalOrderItems.find((i) => i.productId === id)?.unitPrice ||
          0;

      const quantityChange = newQty - originalQty;
      difference += quantityChange * price;
    });

    this.paymentDifference = difference;
    this.isRefund = difference < 0;
    this.total = Math.abs(difference);

    if (this.isRefund) {
      this.pageTitle = 'Procesar Devolución';
    } else if (difference > 0) {
      this.pageTitle = 'Cobrar Diferencia';
    } else {
      this.pageTitle = 'Sin cambios en el total';
    }
  }

  // ❌ Los métodos calculateCosts y updateTotal ya no son necesarios
  // calculateCosts() { ... }
  // updateTotal() { ... }

  // ✅ NUEVO: método para actualizar el total si se añade/quita la propina
  onTipChange() {
    // La propina solo se aplica a órdenes nuevas
    if (!this.isEditMode) {
      this.calculateTotalForNewOrder();
    }
  }

  get paidAmount(): number {
    return Number(this.orderToPay?.paidAmount || 0);
  }

  get pendingAmount(): number {
    return Math.max(this.total - this.paidAmount, 0);
  }

  get normalizedPaymentAmount(): number {
    return Number(this.paymentAmount || 0);
  }

  get paymentProgressPercent(): number {
    if (!this.total) return 0;

    return Math.min((this.paidAmount / this.total) * 100, 100);
  }

  canConfirmPayment(): boolean {
    if (!this.selectedPaymentMethod) return false;

    if (this.isEditMode && this.paymentDifference === 0) return false;

    if (this.normalizedPaymentAmount <= 0) return false;

    if (!this.isRefund && this.normalizedPaymentAmount > this.pendingAmount) {
      return false;
    }

    return true;
  }

  setFullPendingAmount(): void {
    this.paymentAmount = this.pendingAmount;
    this.paymentError = null;
  }

  private syncDefaultPaymentAmount(): void {
    const amount = this.isRefund ? this.total : this.pendingAmount;

    this.paymentAmount = amount > 0 ? amount : null;
  }

  selectPaymentMethod(methodId: number) {
    this.selectedPaymentMethod = methodId;
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancelled');
  }

  confirmPayment() {
    this.paymentError = null;

    if (!this.canConfirmPayment()) {
      this.paymentError = this.selectedPaymentMethod
        ? 'Verifica el monto a recibir.'
        : 'Selecciona un método de pago.';

      return;
    }

    const amountToSend =
      this.isEditMode && this.isRefund
        ? -Math.abs(this.normalizedPaymentAmount)
        : this.normalizedPaymentAmount;

    this.notesPayment = this.isRefund
      ? 'Pago por devolución'
      : this.pendingAmount === this.normalizedPaymentAmount
        ? 'Pago final de la orden'
        : 'Pago parcial de la orden';

    const paymentDetails = {
      totalPaid: amountToSend,
      amount: amountToSend,
      paymentMethodId: this.selectedPaymentMethod,
      notesPayment: this.notesPayment,
      tipIncluded: this.includeTip,
      pendingAmount: this.pendingAmount,
      adjustments: this.adjustments,
    };

    this.modalCtrl.dismiss(paymentDetails, 'paid');
  }

  async openAdjustmentModal(type: 'charge' | 'discount') {
    const alert = await this.alertController.create({
      header: type === 'charge' ? 'Agregar recargo' : 'Agregar descuento',

      cssClass: 'receipt-download-alert',

      inputs: [
        {
          name: 'description',
          type: 'text',
          placeholder:
            type === 'charge' ? 'Nombre del recargo' : 'Nombre del descuento',
        },
        {
          name: 'amount',
          type: 'number',
          placeholder:
            type === 'charge' ? 'Valor del recargo' : 'Valor del descuento',
        },
      ],

      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Aceptar',
          handler: (data: any) => {
            const amount = Number(data.amount);

            if (!data.description || !amount || amount <= 0) {
              return false;
            }

            this.adjustments.push({
              type,
              description: data.description,
              amount,
            });

            this.calculateTotalForNewOrder();

            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  removeAdjustment(index: number) {
    this.adjustments.splice(index, 1);

    this.calculateTotalForNewOrder();
  }
}
