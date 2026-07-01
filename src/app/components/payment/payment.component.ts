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
  @Input() requireFullPayment: boolean = false;
  @Input() allowLocalSplitPayments: boolean = false;

  public orderItems: any[] = [];
  public total: number = 0; // El monto final a mostrar en la UI (siempre positivo)
  public paymentDifference: number = 0; // El cálculo real (puede ser +/-)
  public isRefund: boolean = false;
  public pageTitle: string = 'Detalle de la Cuenta';
  public allPaymentMethods: PaymentMethodI[] = [];
  public selectedPaymentMethod: number | null = null;
  public paymentAmount: number | null = null;
  public paymentError: string | null = null;

  // Calculadora visual de vueltas. No se guarda ni se envía al backend.
  public cashReceivedAmount: number | null = null;
  public cashReceivedDisplayValue: string = '';

  public isSplitPaymentEnabled: boolean = false;

  // ✅ Propiedades para la propina, ahora se manejan aquí
  public includeTip: boolean = false;
  public tipAmount: number = 0;
  public notesPayment: string = 'Pago de diferencia por modificación';

  public adjustments: any[] = [];

  public localAdvancePayments: {
    paymentMethodId: number;
    amount: number;
    notesPayment: string;
  }[] = [];

  public localPaidAmount: number = 0;

  constructor(
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private _paymentMethodService: PaymentMethodService,
  ) {}

  async ngOnInit() {
    this.orderItems = Object.values(this.orderToPay.items);
    this.adjustments = this.normalizeAdjustments(this.orderToPay?.adjustments);

    this.allPaymentMethods = await firstValueFrom(
      this._paymentMethodService.getPaymentMethods(true),
    );

    // ✅ La lógica ahora está encapsulada en el if/else
    if (this.isEditMode && this.originalOrderItems.length > 0) {
      this.calculateDifference();
    } else {
      this.calculateTotalForNewOrder();
    }

    this.isSplitPaymentEnabled = this.hasRegisteredPayments;
    this.syncDefaultPaymentAmount();
  }

  private normalizeAdjustments(adjustments: any): any[] {
    if (!Array.isArray(adjustments)) {
      return [];
    }

    return adjustments
      .filter((adjustment) => {
        return (
          adjustment &&
          (adjustment.type === 'charge' || adjustment.type === 'discount') &&
          Number(adjustment.amount || 0) > 0
        );
      })
      .map((adjustment) => ({
        id: adjustment.id,
        type: adjustment.type,
        description: adjustment.description,
        amount: Number(adjustment.amount || 0),
      }));
  }

  // ✅ Renombrado para mayor claridad y ahora maneja la propina
  calculateTotalForNewOrder() {
    const calculatedSubtotal = this.orderItems.reduce(
      (acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 0),
      0,
    );

    const explicitSubtotal = Number(
      this.orderToPay?.subtotalAmount || this.orderToPay?.subtotal || 0,
    );

    const explicitTotalAmount = Number(this.orderToPay?.totalAmount || 0);

    const subtotal =
      explicitSubtotal > 0 ? explicitSubtotal : calculatedSubtotal;

    this.tipAmount = subtotal * 0.1;

    const charges = this.adjustments
      .filter((adj) => adj.type === 'charge')
      .reduce((acc, adj) => acc + Number(adj.amount || 0), 0);

    const discounts = this.adjustments
      .filter((adj) => adj.type === 'discount')
      .reduce((acc, adj) => acc + Number(adj.amount || 0), 0);

    const calculatedTotal =
      subtotal + charges - discounts + (this.includeTip ? this.tipAmount : 0);

    /**
     * Si hay ajustes, el total se calcula desde subtotal + ajustes.
     * Si no hay ajustes, se respeta totalAmount del backend.
     * Esto evita doble sumar ajustes cuando totalAmount ya viene ajustado.
     */
    this.total =
      this.adjustments.length > 0 || this.includeTip
        ? calculatedTotal
        : explicitTotalAmount > 0
          ? explicitTotalAmount
          : calculatedTotal;

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
    return Number(this.orderToPay?.paidAmount || 0) + this.localPaidAmount;
  }

  get hasRegisteredPayments(): boolean {
    return this.paidAmount > 0;
  }

  get canEditAdjustments(): boolean {
    return !this.hasRegisteredPayments && !this.isEditMode;
  }

  get shouldShowSplitPaymentToggle(): boolean {
    return !this.isRefund && !this.isEditMode;
  }

  get shouldShowSplitPaymentDetails(): boolean {
    return this.shouldShowSplitPaymentToggle && this.isSplitPaymentEnabled;
  }

  get canToggleSplitPayment(): boolean {
    return this.shouldShowSplitPaymentToggle && !this.hasRegisteredPayments;
  }

  get pendingAmount(): number {
    return Math.max(this.total - this.paidAmount, 0);
  }

  get normalizedPaymentAmount(): number {
    return Number(this.paymentAmount || 0);
  }

  get selectedPaymentMethodData(): PaymentMethodI | null {
    return (
      this.allPaymentMethods.find(
        (method) => method.id === this.selectedPaymentMethod,
      ) || null
    );
  }

  get isCashPaymentSelected(): boolean {
    return this.isCashMethod(this.selectedPaymentMethodData);
  }

  get shouldShowCashChangeCalculator(): boolean {
    return (
      !this.isRefund &&
      this.isCashPaymentSelected &&
      this.normalizedPaymentAmount > 0
    );
  }

  get cashAmountDue(): number {
    return this.normalizedPaymentAmount;
  }

  get normalizedCashReceivedAmount(): number {
    return Number(this.cashReceivedAmount || 0);
  }

  get cashChangeAmount(): number {
    return Math.max(this.normalizedCashReceivedAmount - this.cashAmountDue, 0);
  }

  get cashMissingAmount(): number {
    return Math.max(this.cashAmountDue - this.normalizedCashReceivedAmount, 0);
  }

  get isCashReceivedInsufficient(): boolean {
    return (
      this.shouldShowCashChangeCalculator &&
      this.normalizedCashReceivedAmount < this.cashAmountDue
    );
  }

  private isCashMethod(method: PaymentMethodI | null): boolean {
    if (!method) {
      return false;
    }

    const normalizedType = String(method.type || '').toLowerCase();

    const normalizedName = String(method.name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return (
      normalizedType === 'cash' ||
      normalizedName.includes('efectivo') ||
      normalizedName.includes('cash')
    );
  }

  get paymentProgressPercent(): number {
    if (!this.total) return 0;

    return Math.min((this.paidAmount / this.total) * 100, 100);
  }

  canConfirmPayment(): boolean {
    if (!this.selectedPaymentMethod) return false;

    if (this.isEditMode && this.paymentDifference === 0) return false;

    if (this.normalizedPaymentAmount <= 0) return false;

    if (this.isCashReceivedInsufficient) {
      return false;
    }

    if (!this.isRefund && this.normalizedPaymentAmount > this.pendingAmount) {
      return false;
    }

    if (
      this.requireFullPayment &&
      !this.isRefund &&
      !this.isFullPendingAmountSelected()
    ) {
      return false;
    }

    return true;
  }

  private isFullPendingAmountSelected(): boolean {
    return Math.abs(this.normalizedPaymentAmount - this.pendingAmount) < 0.0001;
  }

  onPaymentAmountChange(value: number | string | null | undefined): void {
    this.paymentAmount =
      value === null || value === undefined || value === ''
        ? null
        : Number(value);

    this.paymentError = null;

    if (this.isCashPaymentSelected && this.cashReceivedAmount === null) {
      this.syncCashReceivedDefault();
    }
  }

  onCashReceivedAmountChange(value: string | number | null | undefined): void {
    const numericAmount = this.parseCurrencyInput(value);

    this.cashReceivedAmount = numericAmount > 0 ? numericAmount : null;
    this.cashReceivedDisplayValue =
      numericAmount > 0 ? this.formatCurrencyInput(numericAmount) : '';

    this.paymentError = null;
  }

  async selectCashReceivedAmount(event: any): Promise<void> {
    const nativeInput = await event?.target?.getInputElement?.();

    setTimeout(() => {
      nativeInput?.select?.();
    }, 0);
  }

  private parseCurrencyInput(
    value: string | number | null | undefined,
  ): number {
    const onlyDigits = String(value ?? '').replace(/\D/g, '');

    return onlyDigits ? Number(onlyDigits) : 0;
  }

  private formatCurrencyInput(value: number | null | undefined): string {
    const amount = Number(value || 0);

    if (amount <= 0) {
      return '';
    }

    return `$${amount.toLocaleString('es-CO', {
      maximumFractionDigits: 0,
    })}`;
  }

  setFullPendingAmount(): void {
    this.paymentAmount = this.pendingAmount;
    this.paymentError = null;
    this.syncCashReceivedDefault();
  }

  onSplitPaymentToggle(event: CustomEvent): void {
    if (!this.canToggleSplitPayment) {
      this.isSplitPaymentEnabled =
        this.hasRegisteredPayments || this.isSplitPaymentEnabled;
      return;
    }

    this.isSplitPaymentEnabled = Boolean(event.detail?.checked);
    this.paymentError = null;

    if (!this.isSplitPaymentEnabled) {
      this.syncDefaultPaymentAmount();
    }
  }

  private syncDefaultPaymentAmount(): void {
    const amount = this.isRefund ? this.total : this.pendingAmount;

    this.paymentAmount = amount > 0 ? amount : null;
    this.syncCashReceivedDefault();
  }

  private syncCashReceivedDefault(): void {
    if (!this.isCashPaymentSelected || this.isRefund) {
      this.cashReceivedAmount = null;
      this.cashReceivedDisplayValue = '';
      return;
    }

    const amount = this.cashAmountDue;

    this.cashReceivedAmount = amount > 0 ? amount : null;
    this.cashReceivedDisplayValue = this.formatCurrencyInput(
      this.cashReceivedAmount,
    );
  }

  selectPaymentMethod(methodId: number) {
    this.selectedPaymentMethod = methodId;
    this.paymentError = null;
    this.syncCashReceivedDefault();
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancelled');
  }

  confirmPayment() {
    this.paymentError = null;

    if (!this.canConfirmPayment()) {
      if (!this.selectedPaymentMethod) {
        this.paymentError = 'Selecciona un método de pago.';
        return;
      }

      if (this.isCashReceivedInsufficient) {
        this.paymentError =
          'El efectivo recibido no alcanza para cubrir el valor a cobrar.';
        return;
      }

      if (
        this.requireFullPayment &&
        !this.isRefund &&
        !this.isFullPendingAmountSelected()
      ) {
        this.paymentError =
          'En cobro anticipado debes recibir el saldo completo antes de crear la orden.';
        return;
      }

      this.paymentError = 'Verifica el monto a recibir.';
      return;
    }

    const pendingBeforePayment = this.pendingAmount;

    const amountToSend =
      this.isEditMode && this.isRefund
        ? -Math.abs(this.normalizedPaymentAmount)
        : this.normalizedPaymentAmount;

    this.notesPayment = this.isRefund
      ? 'Pago por devolución'
      : pendingBeforePayment === this.normalizedPaymentAmount
        ? 'Pago final de la orden'
        : 'Pago parcial de la orden';

    if (
      this.allowLocalSplitPayments &&
      this.isSplitPaymentEnabled &&
      !this.isRefund &&
      this.selectedPaymentMethod
    ) {
      this.localAdvancePayments.push({
        paymentMethodId: this.selectedPaymentMethod,
        amount: amountToSend,
        notesPayment: this.notesPayment,
      });

      this.localPaidAmount += amountToSend;

      const isFullyPaid = this.pendingAmount <= 0.0001;

      if (!isFullyPaid) {
        this.selectedPaymentMethod = null;
        this.syncDefaultPaymentAmount();
        return;
      }

      const finalPaymentDetails = {
        totalPaid: this.localPaidAmount,
        amount: this.localPaidAmount,
        paymentMethodId:
          this.localAdvancePayments[this.localAdvancePayments.length - 1]
            .paymentMethodId,
        notesPayment: 'Pago anticipado completo',
        tipIncluded: this.includeTip,
        pendingAmount: 0,
        adjustments: this.adjustments,
        advancePayments: this.localAdvancePayments,
      };

      this.modalCtrl.dismiss(finalPaymentDetails, 'paid');
      return;
    }

    const paymentDetails = {
      totalPaid: amountToSend,
      amount: amountToSend,
      paymentMethodId: this.selectedPaymentMethod,
      notesPayment: this.notesPayment,
      tipIncluded: this.includeTip,
      pendingAmount: pendingBeforePayment - amountToSend,
      adjustments: this.canEditAdjustments ? this.adjustments : [],
    };

    this.modalCtrl.dismiss(paymentDetails, 'paid');
  }

  async openAdjustmentModal(type: 'charge' | 'discount') {
    if (!this.canEditAdjustments) {
      return;
    }
    const alert = await this.alertController.create({
      header: type === 'charge' ? 'Agregar recargo' : 'Agregar descuento',

      cssClass: 'adjustment-alert',

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
          cssClass: 'alert-secondary-action',
        },
        {
          text: 'Aceptar',
          cssClass: 'alert-primary-action',
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
    if (!this.canEditAdjustments) {
      return;
    }

    this.adjustments.splice(index, 1);

    this.calculateTotalForNewOrder();
  }
}
