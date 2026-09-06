import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
  AfterViewInit,
  NgZone,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { PaymentComponent } from '../payment/payment.component';
import { ProductsService } from '@services/products.service';

@Component({
  selector: 'app-order-summary',
  templateUrl: './order-summary.component.html',
  styleUrls: ['./order-summary.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class OrderSummaryComponent implements OnInit, AfterViewInit {
  @Input() orderItems: any[] = [];
  @Input() modalId!: string;
  @Input() isOrderAlreadyPaid: boolean = false;
  @Input() isEditMode: boolean = false;
  @Input() isAddOnlyEditMode: boolean = false;
  @Input() originalOrderItems: any[] = [];
  @Input() originalKitchenNotes: string = '';
  @Input() protectedItemQuantities: Record<number, number> = {};
  @Input() protectedLineQuantities: Record<string, number> = {};
  @Input() onDraftKitchenNotesChange?: (notes: string) => void;
  @ViewChild('confirmButton', { static: false }) confirmButton!: ElementRef;

  public isPrepaid: boolean = false;
  public groupedOrderItems: any[] = [];
  public kitchenNotes: string = '';
  public protectedImages = new Map<number, string>();

  get subtotal() {
    return this.orderItems.reduce((acc, item) => acc + this.configuredUnitPrice(item), 0);
  }
  get serviceFee() {
    // return this.subtotal * 0.10;
    return 0;
  }
  get total() {
    return this.subtotal + this.serviceFee;
  }

  constructor(
    private modalCtrl: ModalController,
    private elementRef: ElementRef,
    private _productService: ProductsService,
  ) {}

  ngOnInit() {
    this.groupItems();
    this.kitchenNotes = this.originalKitchenNotes;

    if (this.onDraftKitchenNotesChange) {
      this.onDraftKitchenNotesChange(this.kitchenNotes);
    }

    // ✅ 2. Si la orden ya venía con pago anticipado,
    //    marcamos el toggle como activo por defecto.
    if (this.isEditMode) {
      this.isPrepaid = false;
      if (this.isOrderAlreadyPaid) {
        this.isPrepaid = true;
      }
    }
  }

  ngAfterViewInit() {
    // SOLUCIÓN 1A: Remover tabindex o hacer que no sea focusable temporalmente
    setTimeout(() => {
      if (this.confirmButton?.nativeElement) {
        // Opción 1: Remover de la navegación por teclado temporalmente
        this.confirmButton.nativeElement.tabIndex = -1;

        // O Opción 2: Usar inert (más moderno)
        // this.confirmButton.nativeElement.inert = true;
      }
    }, 100);
  }

  groupItems() {
    const grouped = new Map();
    this.orderItems.forEach((item) => {
      const lineKey = item.lineKey || `${item.id}::standard`;
      if (grouped.has(lineKey)) {
        grouped.get(lineKey).quantity++;
      } else {
        grouped.set(lineKey, { ...item, lineKey, quantity: 1 });
      }
    });
    this.groupedOrderItems = Array.from(grouped.values());
    // Cargar imagen protegida para cada producto que tenga imagen
    this.groupedOrderItems.forEach((product) => {
      if (product.imageUrl) {
        this.loadProtectedImage(product.id);
      }
    });
  }

  addItem(item: any) {
    this.orderItems = [...this.orderItems, item];
    this.groupItems();
  }

  removeItem(item: any) {
    if (!this.canRemoveItem(item)) {
      return;
    }

    const index = this.orderItems.findIndex(
      (candidate) =>
        (candidate.lineKey || `${candidate.id}::standard`) === item.lineKey,
    );
    if (index > -1) {
      // ✅ Crea un nuevo array excluyendo el elemento
      this.orderItems = this.orderItems.filter((_, i) => i !== index);
      this.groupItems();
    }
  }

  selectionUnitTotal(selection: any): number {
    return Number(selection.priceAdjustment ?? selection.unitPriceAdjustment ?? 0) *
      Number(selection.quantity || 1);
  }

  baseLineTotal(item: any): number {
    return Number(item.price ?? item.unitPrice ?? 0) * Number(item.quantity || 0);
  }

  selectionLineTotal(selection: any, item: any): number {
    return this.selectionUnitTotal(selection) * Number(item.quantity || 0);
  }

  hasPaidSelections(item: any): boolean {
    return (item.modifierSelections || []).some(
      (selection: any) => this.selectionUnitTotal(selection) > 0,
    );
  }

  configuredLineTotal(item: any): number {
    return this.configuredUnitPrice(item) * Number(item.quantity || 0);
  }

  configuredUnitPrice(item: any): number {
    return Number(item.price ?? item.unitPrice ?? 0) + (item.modifierSelections || []).reduce(
      (total: number, selection: any) => total + this.selectionUnitTotal(selection),
      0,
    );
  }

  getProtectedQuantity(productId: number): number {
    return Number(this.protectedItemQuantities[productId] || 0);
  }

  canRemoveItem(item: any): boolean {
    if (!this.isAddOnlyEditMode) {
      return true;
    }

    return (
      Number(item.quantity || 0) >
      Number(this.protectedLineQuantities[item.lineKey] || 0)
    );
  }

  onKitchenNotesChange(notes: string): void {
    this.kitchenNotes = notes ?? '';

    if (this.onDraftKitchenNotesChange) {
      this.onDraftKitchenNotesChange(this.kitchenNotes);
    }
  }
  dismiss() {
    this.modalCtrl.dismiss(null, 'cancelled');
  }

  async confirmOrder() {
    // Restaurar focusabilidad antes de proceder
    if (this.confirmButton?.nativeElement) {
      this.confirmButton.nativeElement.tabIndex = 0;
    }

    // ✅ 1. Calculamos la diferencia de dinero REAL
    const financialDifference = this.calculateFinancialDifference();
    // ✅ 1. Definimos una única condición para decidir si vamos a la pantalla de pago.
    //    Iremos a pago si:
    //    - La orden es de pago anticipado Y (es una orden NUEVA O es una orden en EDICIÓN que tiene cambios en los items).
    // const shouldGoToPayment = this.isPrepaid && (!this.isEditMode || this.haveItemsChanged());
    const shouldGoToPayment = this.isPrepaid && financialDifference !== 0;
    // const itemsHaveChanged = this.haveItemsChanged(); // Llama a tu nuevo método de detección

    if (shouldGoToPayment) {
      // --- CASO A: IR A LA PANTALLA DE PAGO ---
      const paymentModal = await this.modalCtrl.create({
        component: PaymentComponent,
        id: 'payment-modal',
        cssClass: 'payment-modal-class',
        showBackdrop: true,
        backdropDismiss: false,
        handle: false,
        componentProps: {
          orderToPay: {
            items: this.groupedOrderItems.reduce((obj, item) => {
              obj[item.lineKey || item.id] = item;
              return obj;
            }, {}),
          },
          originalOrderItems: this.originalOrderItems,
          isEditMode: this.isEditMode,
          requireFullPayment: false,
          allowLocalSplitPayments: true,
        },
      });

      await paymentModal.present();
      const { data, role } = await paymentModal.onWillDismiss();

      if (role === 'paid') {
        const finalOrderWithPayment = {
          orderItems: this.groupedOrderItems,
          total: this.total,
          isAdvancePayment: this.isPrepaid,
          kitchenNotes: this.kitchenNotes,
          ...data,
        };

        await this.modalCtrl.dismiss(
          finalOrderWithPayment,
          'confirmed',
          this.modalId,
        );
      }
    } else {
      // --- CASO B: CONFIRMAR DIRECTAMENTE (SIN PAGO) ---
      console.log('Decisión: Confirmar directamente, sin pasar por pago.');
      let paymentData: any = { paymentDetails: null };
      // Si es una orden ya pagada sin cambios en items, enviamos datos de relleno
      if (this.isEditMode && this.isPrepaid) {
        paymentData = {
          paymentMethodId: 1,
          notesPayment: 'Actualización sin cambio financiero (ej. solo notas).',
          kitchenNotes: this.kitchenNotes,
        };
      }

      const finalOrder = {
        orderItems: this.groupedOrderItems,
        total: this.total,
        isAdvancePayment: this.isPrepaid,
        kitchenNotes: this.kitchenNotes,
        ...paymentData,
      };

      this.modalCtrl.dismiss(finalOrder, 'confirmed');
    }

    // CASO 1: Es una orden con pago anticipado Y los items fueron modificados.
    // Solo en este caso se necesita un nuevo cobro o una devolución.
    // if (this.isPrepaid && itemsHaveChanged) {

    //   const paymentModal = await this.modalCtrl.create({
    //     component: PaymentComponent,
    //     id: 'payment-modal',
    //     cssClass: 'payment-modal-class',
    //     showBackdrop: true,
    //     backdropDismiss: false,
    //     componentProps: {
    //       orderToPay: {
    //         items: this.groupedOrderItems.reduce((obj, item) => {
    //           obj[item.id] = item;
    //           return obj;
    //         }, {})
    //       },
    //       originalOrderItems: this.originalOrderItems,
    //       isEditMode: this.isEditMode,
    //     },
    //   });

    //   await paymentModal.present();
    //   const { data, role } = await paymentModal.onWillDismiss();

    //   if (role === 'paid') {
    //     // Prepara el objeto final con los datos del pago.
    //     const finalOrderWithPayment = {
    //       orderItems: this.groupedOrderItems,
    //       total: this.total,
    //       isAdvancePayment: this.isPrepaid,
    //       kitchenNotes: this.kitchenNotes,
    //       ...data, // "Esparcimos" las propiedades de pago (totalPaid, paymentMethodId, etc.)
    //     };

    //     // Cierra este modal y devuelve el objeto final.
    //     await this.modalCtrl.dismiss(finalOrderWithPayment, 'confirmed', this.modalId);
    //   }
    //   // Si el rol no es 'paid' (ej. 'cancelled'), no hacemos nada y el usuario
    //   // permanece en el resumen del pedido.

    // } else {
    //   let paymentData: any = { paymentDetails: null };
    //   // CASO 2: Para TODOS los demás escenarios:
    //   // - Es una orden nueva.
    //   // - Es una orden que se paga al final.
    //   // - Es una orden ya pagada pero solo se modificaron las notas.

    //   // ✅ INICIO DE LA NUEVA LÓGICA
    //   // SI la orden ya estaba pagada pero los items NO cambiaron...
    //   if (this.isPrepaid && !itemsHaveChanged) {
    //     // ...entonces creamos datos de pago "falsos" para pasar la validación del backend.
    //     console.log('Enviando datos de pago de relleno para satisfacer al backend.');
    //     paymentData = {
    //       paymentMethodId: 1, // Puedes usar un ID por defecto (ej. 1 para Efectivo)
    //       notesPayment: 'Actualización sin cambio financiero (ej. solo notas).',
    //       totalPaid: 0 // El monto pagado es cero
    //     };
    //   }

    //   const finalOrder = {
    //     orderItems: this.groupedOrderItems,
    //     total: this.total,
    //     isAdvancePayment: this.isPrepaid,
    //     paymentDetails: null,
    //     kitchenNotes: this.kitchenNotes,
    //     ...paymentData
    //   };
    //   this.modalCtrl.dismiss(finalOrder, 'confirmed');
    // }
  }

  loadProtectedImage(productId: number) {
    this._productService.getProtectedImageBlob(productId).subscribe({
      next: (imageUrl: string) => {
        this.protectedImages.set(productId, imageUrl);
      },
      error: (error) => {
        console.error(
          `Error al cargar la imagen protegida para el producto ${productId}:`,
          error,
        );
      },
    });
  }

  // ✅ 2. NUEVO MÉTODO para detectar si los items cambiaron
  private haveItemsChanged(): boolean {
    if (this.originalOrderItems.length !== this.groupedOrderItems.length) {
      return true; // Si la cantidad de tipos de producto es distinta, cambiaron
    }

    const originalMap = new Map<number, number>();
    this.originalOrderItems.forEach((item) => {
      originalMap.set(
        item.productId,
        (originalMap.get(item.productId) || 0) + Number(item.quantity || 0),
      );
    });

    const currentMap = new Map<number, number>();
    this.groupedOrderItems.forEach((item) => {
      currentMap.set(
        item.id,
        (currentMap.get(item.id) || 0) + Number(item.quantity || 0),
      );
    });
    for (const productId of new Set([...originalMap.keys(), ...currentMap.keys()])) {
      if ((originalMap.get(productId) || 0) !== (currentMap.get(productId) || 0)) return true;
    }
    return false; // Si todo coincide, no cambiaron
  }

  private calculateFinancialDifference(): number {
    // Si no hay items originales (ej. es una orden nueva), no hay diferencia.
    if (!this.originalOrderItems || this.originalOrderItems.length === 0) {
      return this.total; // Para una orden nueva, la "diferencia" es el total
    }

    const originalTotal = this.originalOrderItems.reduce(
      (total, item) => total + Number(
        item.totalPrice ?? this.configuredUnitPrice({
          ...item,
          price: item.unitPrice,
        }) * Number(item.quantity || 0),
      ),
      0,
    );
    const currentTotal = this.groupedOrderItems.reduce(
      (total, item) => total + this.configuredUnitPrice(item) * Number(item.quantity || 0),
      0,
    );

    return currentTotal - originalTotal;
  }
}
