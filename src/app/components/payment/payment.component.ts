import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule, ModalController } from '@ionic/angular';import { PaymentMethodI, PaymentMethodService } from '@services/payment-method.service';
import { firstValueFrom } from 'rxjs';

interface PaymentAdjustment {
  type: 'charge' | 'discount';
  description: string;
  amount: number;
}

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
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
  public adjustments: PaymentAdjustment[] = [];

  // ✅ Propiedades para la propina, ahora se manejan aquí
  public includeTip: boolean = false;
  public tipAmount: number = 0;
  public notesPayment: string = 'Pago de diferencia por modificación';

  constructor(
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private _paymentMethodService: PaymentMethodService
  ) { }

  async ngOnInit() {
    this.orderItems = Object.values(this.orderToPay.items);
    this.allPaymentMethods = await firstValueFrom(this._paymentMethodService.getPaymentMethods(true));

    // ✅ La lógica ahora está encapsulada en el if/else
    if (this.isEditMode && this.originalOrderItems.length > 0) {
      this.calculateDifference();
    } else {
      this.calculateTotalForNewOrder();
    }
  }

  // ✅ Renombrado para mayor claridad y ahora maneja la propina
  calculateTotalForNewOrder() {

  const subtotal = this.orderItems.reduce(
    (acc, item) => acc + (item.price * item.quantity),
    0
  );

  this.tipAmount = subtotal * 0.10;

  const charges = this.adjustments
    .filter(adj => adj.type === 'charge')
    .reduce((acc, adj) => acc + adj.amount, 0);

  const discounts = this.adjustments
    .filter(adj => adj.type === 'discount')
    .reduce((acc, adj) => acc + adj.amount, 0);

  this.total =
    subtotal +
    charges -
    discounts +
    (this.includeTip ? this.tipAmount : 0);
}

  // ✅ Este método se queda como estaba
  calculateDifference() {
    const originalQuantities = new Map<number, number>();
    this.originalOrderItems.forEach(item => {
      originalQuantities.set(item.productId, item.quantity);
    });

    const newQuantities = new Map<number, { quantity: number; price: number }>();
    this.orderItems.forEach(item => {
      newQuantities.set(item.id, { quantity: item.quantity, price: parseFloat(item.price) });
    });

    let difference = 0;
    const allProductIds = new Set([...originalQuantities.keys(), ...newQuantities.keys()]);

    allProductIds.forEach(id => {
      const originalQty = originalQuantities.get(id) || 0;
      const newQtyData = newQuantities.get(id);
      const newQty = newQtyData ? newQtyData.quantity : 0;
      const price = newQtyData ? newQtyData.price : (this.originalOrderItems.find(i => i.productId === id)?.unitPrice || 0);

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

  //  Pop up  DE AGREGAR O DESCONTAR UN CARGO O DESCUENTO
  async openAdjustmentModal(type: 'charge' | 'discount') {

  const alert = await this.alertController.create({
    header: type === 'charge'
      ? 'Agregar cargo'
      : 'Agregar descuento',

    inputs: [
      {
        name: 'description',
        type: 'text',
        placeholder: 'Descripción'
      },
      {
        name: 'amount',
        type: 'number',
        placeholder: 'Valor'
      }
    ],

    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel'
      },
      {
        text: 'Agregar',
        handler: (data) => {

          const amount = Number(data.amount);

          if (!data.description || !amount || amount <= 0) {
            return false;
          }

          this.adjustments.push({
            type,
            description: data.description,
            amount
          });

          this.calculateTotalForNewOrder();

          return true;
        }
      }
    ]
  });

  await alert.present();
}

removeAdjustment(index: number) {

  this.adjustments.splice(index, 1);

  this.calculateTotalForNewOrder();
}

// ✅ Método para seleccionar el método de pago
  selectPaymentMethod(methodId: number) {
    this.selectedPaymentMethod = methodId;
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancelled');
  }

  confirmPayment() {
    if (!this.selectedPaymentMethod) return;
    // ✅ La lógica para determinar el monto a pagar ahora es correcta
    const amountToSend = this.isEditMode ? this.paymentDifference : this.total;

    this.notesPayment = this.isRefund ? 'Pago por devolución': 'Recepción de dinero por nuevos productos'
    const paymentDetails = {
      totalPaid: amountToSend,
      paymentMethodId: this.selectedPaymentMethod,
      notesPayment: this.notesPayment,
      tipIncluded: this.includeTip
    };
    this.modalCtrl.dismiss(paymentDetails, 'paid');
  }
}
