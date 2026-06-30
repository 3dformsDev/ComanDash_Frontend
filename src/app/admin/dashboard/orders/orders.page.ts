import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppState } from '@capacitor/app';
import {
  AlertController,
  LoadingController,
  ModalController,
} from '@ionic/angular';
import { Store } from '@ngrx/store';
import { CategoriesService, CategoryI } from '@services/categories.service';
import { ProductI, ProductsService } from '@services/products.service';
import {
  filter,
  firstValueFrom,
  map,
  Observable,
  Subject,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { OrderSummaryComponent } from 'src/app/components/order-summary/order-summary.component';
import * as OrdersActions from '@store/orders/actions/orders.actions';
import { Actions, ofType } from '@ngrx/effects';
import { ToastService } from '@services/toast.service';
import { Order, OrderItem, OrdersState } from '@store/orders/orders.state';
import { selectOrdersFeature } from '@store/orders/selectors/orders.selector';
import { OrderService } from '@services/order.service';

interface GroupedProduct extends ProductI {
  id: number;
  quantity: number;
}

@Component({
  selector: 'app-orders',
  templateUrl: './orders.page.html',
  styleUrls: ['./orders.page.scss'],
  standalone: false,
})
export class OrdersPage implements OnInit, OnDestroy {
  selectedOrders$!: Observable<OrdersState>;
  allCategories: CategoryI[] = [];
  allProducts: ProductI[] = [];
  public isEditMode = false; // ✅ Añade esta propiedad
  public currentOrderId: number | null = null;
  private destroy$ = new Subject<void>();
  private loadingIndicator: HTMLIonLoadingElement | null = null;

  private static receiptAlertsInProgress = new Set<number>();

  public currentFilter: number = 1; // Filtro activo por defecto
  public searchTerm = '';

  // Array que almacena los productos que se van añadiendo a la orden
  public currentOrder: GroupedProduct[] = [];

  // Conserva temporalmente la nota general mientras el mesero cierra y reabre
  // el modal "Resumen del Pedido" antes de confirmar la comanda.
  private draftKitchenNotes: string | null = null;

  public protectedImages = new Map<number, string>();

  // --- GETTERS (PROPIEDADES CALCULADAS) ---

  // Filtra productos por categoría o por búsqueda global.
  get menuItems(): ProductI[] {
    const term = this.normalizedSearchTerm;

    if (!term) {
      return this.allProducts.filter(
        (item) => item.categoryId === this.currentFilter,
      );
    }

    return this.allProducts.filter((item) =>
      this.normalizeSearchText(item.name).includes(term),
    );
  }

  get normalizedSearchTerm(): string {
    return this.normalizeSearchText(this.searchTerm);
  }

  get isSearchingProducts(): boolean {
    return this.normalizedSearchTerm.length > 0;
  }

  // Calcula el número total de items en la orden
  get orderCount(): number {
    return this.currentOrder.reduce((total, item) => total + item.quantity, 0);
  }

  // Calcula el costo total de la orden
  get orderTotal(): number {
    return this.currentOrder.reduce(
      (total, item) =>
        total + parseFloat(item.price.toString()) * item.quantity,
      0,
    );
  }

  // --- CICLO DE VIDA Y MÉTODOS ---

  constructor(
    private modalCtrl: ModalController,
    private store: Store<AppState>,
    private _productService: ProductsService,
    private _categoryService: CategoriesService,
    private actions$: Actions,
    private toastService: ToastService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private _ordersService: OrderService,
    private alertController: AlertController,
  ) {}

  ngOnInit() {
    this.selectedOrders$ = this.store.select(selectOrdersFeature);
    this.setupOrderActionListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async ionViewWillEnter() {
    try {
      this.allCategories = await firstValueFrom(
        this._categoryService.getCategory(true),
      );
      this.allProducts = await firstValueFrom(
        this._productService.getProducts(true),
      );
      this.allProducts.forEach((product) => {
        if (product.imageUrl) {
          this.loadProtectedImage(product.id);
        }
      });

      if (this.allCategories.length > 0) {
        this.currentFilter = this.allCategories[0].id; // Asumiendo que CategoryI tiene una propiedad 'id'
      }

      this.populateOrderForEditing();
    } catch (error) {
      console.error('Error al cargar las productos:', error);
    }
  }

  ionViewWillLeave() {
    // 1. Limpiamos el estado GLOBAL (NgRx Store)
    this.store.dispatch(OrdersActions.clearCurrentOrderForEdit());

    // 2. Limpiamos el estado LOCAL del componente
    this.resetComponentState();
  }

  // ✅ NUEVO MÉTODO PRIVADO PARA REINICIAR EL ESTADO
  private resetComponentState(): void {
    this.isEditMode = false;
    this.currentOrderId = null;
    this.currentOrder = [];
    this.draftKitchenNotes = null;
    this.currentFilter = 1; // O el ID de tu categoría por defecto
    this.searchTerm = '';
    // this.protectedImages.clear(); // Opcional: si quieres limpiar las imágenes cacheadas
  }

  /**
   * Cambia el filtro de categoría activo.
   * @param filter El valor de la categoría seleccionada (ej. 'entradas')
   */
  public selectFilter(filter: number): void {
    this.currentFilter = filter;
  }

  public onSearchTermChange(event: Event): void {
    const value =
      (event as CustomEvent<{ value?: string | null }>).detail?.value ?? '';

    this.searchTerm = value;
  }

  public clearProductSearch(): void {
    this.searchTerm = '';
  }

  private normalizeSearchText(
    value: string | number | null | undefined,
  ): string {
    return (value ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Añade un producto a la orden actual.
   * @param item El objeto del producto a añadir.
   */
  // orders.page.ts

  public addItem(item: ProductI): void {
    const existingItemIndex = this.currentOrder.findIndex(
      (p) => p.id === item.id,
    );

    if (existingItemIndex > -1) {
      // Si el producto ya existe...
      this.currentOrder = this.currentOrder.map((product, index) => {
        if (index === existingItemIndex) {
          // --- INICIO DE DEPURACIÓN ---
          console.log(`Intentando actualizar ID: ${product.id}`);
          console.log(`Valor actual de product.quantity:`, product.quantity);
          // --- FIN DE DEPURACIÓN ---

          // ✅ CÓDIGO A PRUEBA DE ERRORES:
          // Si 'product.quantity' es un número, lo incrementa.
          // Si es 'undefined' o 'null', lo inicializa en 1.
          const newQuantity = (product.quantity || 0) + 1;

          console.log(`Nueva cantidad será: ${newQuantity}`);
          return { ...product, quantity: newQuantity };
        }
        return product;
      });
    } else {
      // Si es un producto nuevo, lo añadimos con cantidad 1 (esto ya estaba bien)
      this.currentOrder = [...this.currentOrder, { ...item, quantity: 1 }];
    }
    console.log('Orden final (agrupada):', this.currentOrder);
  }

  /**
   * Quita una unidad de un producto de la orden actual.
   * @param item El objeto del producto a quitar.
   */
  /**
   * Quita una unidad de un producto, manejando la cantidad.
   */
  public removeItem(item: GroupedProduct): void {
    const existingItem = this.currentOrder.find((p) => p.id === item.id);

    if (!existingItem) return; // No hacer nada si no existe

    if (existingItem.quantity > 1) {
      // Si hay más de uno, solo reducimos la cantidad
      this.currentOrder = this.currentOrder.map((p) =>
        p.id === item.id ? { ...p, quantity: p.quantity - 1 } : p,
      );
    } else {
      // Si solo queda uno, lo eliminamos del array
      this.currentOrder = this.currentOrder.filter((p) => p.id !== item.id);
    }
    console.log('Orden actual (agrupada):', this.currentOrder);
  }

  /**
   * Quita una unidad de un producto por ID (para uso en templates)
   */
  public removeItemById(itemId: number): void {
    const existingItem = this.currentOrder.find((p) => p.id === itemId);
    if (existingItem) {
      this.removeItem(existingItem);
    }
  }

  /**
   * Devuelve la cantidad de un producto específico en la orden.
   * @param item El producto cuya cantidad se quiere saber.
   * @returns La cantidad de ese producto en la orden.
   */
  public getItemQuantity(item: ProductI): number {
    const orderItem = this.currentOrder.find((p) => p.id === item.id);
    return orderItem ? orderItem.quantity : 0;
  }

  /**
   * Método actualizado para abrir el modal
   */
  public async viewOrder(): Promise<void> {
    // Obtenemos el estado de la orden ANTES de crear el modal.
    const orderState = await firstValueFrom(
      this.store.select(selectOrdersFeature),
    );

    let isAlreadyPaid = false;
    let originalItems: OrderItem[] = [];
    let originalKitchenNotes = this.draftKitchenNotes ?? '';

    // Si estamos en modo edición, usamos las notas existentes de la orden
    // solo cuando todavía no hay una nota temporal escrita en esta sesión.
    if (this.isEditMode && orderState.currentOrder) {
      isAlreadyPaid = orderState.currentOrder.isAdvancePayment;
      originalItems = orderState.currentOrder.orderItems;
      originalKitchenNotes =
        this.draftKitchenNotes ?? orderState.currentOrder.kitchenNotes ?? '';
    }

    const flatOrderItems = this.currentOrder.reduce((acc, item) => {
      for (let i = 0; i < item.quantity; i++) {
        // Omitimos la propiedad 'quantity' al enviarla al modal
        const { quantity, ...productData } = item;
        acc.push(productData);
      }
      return acc;
    }, [] as ProductI[]);

    const modal = await this.modalCtrl.create({
      component: OrderSummaryComponent,
      componentProps: {
        orderItems: flatOrderItems,
        modalId: 'orderSummaryModal',
        isOrderAlreadyPaid: isAlreadyPaid,
        isEditMode: this.isEditMode,
        originalOrderItems: originalItems,
        originalKitchenNotes: originalKitchenNotes,

        // Mantiene viva la nota aunque el modal se cierre y se vuelva a abrir.
        onDraftKitchenNotesChange: (notes: string) => {
          this.draftKitchenNotes = notes ?? '';
        },
      },
      id: 'orderSummaryModal',
      cssClass: 'order-summary-modal',
      backdropDismiss: true,
      showBackdrop: true,
      handle: false,
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    console.log(`Valor de role ${role}`);

    if (role === 'confirmed') {
      // Obtener el estado actual de la orden desde el store
      this.store
        .select(selectOrdersFeature)
        .pipe(take(1))
        .subscribe(async (orderState) => {
          if (this.isEditMode) {
            await this.showLoading('Actualizando comanda...');

            // Fusionar la orden original con los nuevos datos del modal
            const originalOrder = orderState.currentOrder!;
            const updatedOrderData: Partial<Order> = {
              ...originalOrder,
              ...data,
            };

            console.log('¡Pedido actualizado!', updatedOrderData);
            this.store.dispatch(
              OrdersActions.updateOrder({
                orderId: this.currentOrderId!,
                order: updatedOrderData,
              }),
            );
          } else {
            console.log(data);

            this.store.dispatch(
              OrdersActions.createOrder({
                order: {
                  ...data,
                  adjustments: data.adjustments || [],

                  paymentDetails: {
                    ...data,
                  },
                },
              }),
            );
          }
        });

      this.currentOrder = [];
      this.draftKitchenNotes = null;
    }
  }

  async refreshData() {
    try {
      this.allCategories = await firstValueFrom(
        this._categoryService.getCategory(true),
      );
      this.allProducts = await firstValueFrom(
        this._productService.getProducts(true),
      );

      this.allProducts.forEach((product) => {
        if (product.imageUrl) {
          this.loadProtectedImage(product.id);
        }
      });
    } catch (error) {
      console.error('Error al cargar las productos:', error);
    }
  }

  // ✅ NUEVO: Configurar listeners para las acciones
  private setupOrderActionListeners(): void {
    // Escuchar éxito
    this.actions$
      .pipe(
        ofType(OrdersActions.createOrderSuccess),
        tap(async ({ order }) => {
          await this.hideLoading();

          this.toastService.presentToast(
            `¡Pedido #${order.id || 'N/A'} creado exitosamente!`,
            'success',
          );

          this.currentOrder = [];

          if (order.isAdvancePayment) {
            await this.showAdvancePaymentReceiptAlertOnce(order.id);
          }

          // Redirigir después de un breve delay
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 100);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // ✅ PASO 3: Añadir listener para el éxito de la ACTUALIZACIÓN
    this.actions$
      .pipe(
        ofType(OrdersActions.updateOrderSuccess),
        tap(async ({ order }) => {
          await this.hideLoading();

          const orderDisplayNumber =
            order.orderNumber || order.id || this.currentOrderId || 'N/A';

          this.toastService.presentToast(
            `¡Pedido #${orderDisplayNumber} actualizado!`,
            'success',
          );

          this.router.navigate(['/dashboard/waiters']); // O a donde quieras redirigir
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Escuchar errores
    this.actions$
      .pipe(
        ofType(OrdersActions.createOrderFailure),
        tap(({ error }: any) => {
          this.toastService.presentToast(
            `Error al crear el pedido: ${error.error.message}`,
            'danger',
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
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

  private async showAdvancePaymentReceiptAlertOnce(
    orderId: number | null | undefined,
  ): Promise<void> {
    if (!orderId) {
      return;
    }

    if (OrdersPage.receiptAlertsInProgress.has(orderId)) {
      return;
    }

    OrdersPage.receiptAlertsInProgress.add(orderId);

    try {
      const alert = await this.alertController.create({
        header: 'Pago realizado',
        message: '¿Deseas descargar el recibo?',
        cssClass: 'receipt-download-alert',
        buttons: [
          {
            text: 'NO',
            role: 'cancel',
            cssClass: 'alert-secondary-action',
          },
          {
            text: 'SÍ DESCARGAR',
            cssClass: 'alert-primary-action',
            handler: () => {
              this._ordersService.downloadReceipt(orderId).subscribe({
                next: () => {
                  console.log('Recibo descargado');
                },
                error: (err: any) => {
                  console.error('Error descargando recibo', err);
                },
              });
            },
          },
        ],
      });

      await alert.present();
      await alert.onDidDismiss();
    } finally {
      OrdersPage.receiptAlertsInProgress.delete(orderId);
    }
  }

  private async showLoading(message: string): Promise<void> {
    // Si ya hay un loading, no hagas nada
    if (this.loadingIndicator) {
      return;
    }
    this.loadingIndicator = await this.loadingCtrl.create({
      message,
      spinner: 'crescent',
    });
    await this.loadingIndicator.present();
  }

  private async hideLoading(): Promise<void> {
    if (this.loadingIndicator) {
      await this.loadingIndicator.dismiss();
      this.loadingIndicator = null;
    }
  }

  // ✅ 7. Añade este nuevo método
  private populateOrderForEditing(): void {
    this.store
      .select(selectOrdersFeature)
      .pipe(
        take(1),
        filter((orderState) => !!orderState.currentOrder),
      )
      .subscribe((orderState) => {
        const orderToEdit = orderState.currentOrder!;
        console.log('Cargando orden para editar:', orderToEdit);

        if (orderToEdit.id) {
          this.isEditMode = true;
          this.currentOrderId = orderToEdit.id;
        }

        // Mapeamos directamente a la estructura agrupada
        const groupedItems = orderToEdit.orderItems
          .map((item) => {
            const product = this.allProducts.find(
              (p) => p.id === item.productId,
            );
            // Creamos el objeto con su cantidad correcta
            return { ...product!, quantity: item.quantity };
          })
          .filter((item) => item.id); // Filtramos por si algún producto no fue encontrado

        this.currentOrder = groupedItems;
      });
  }
}
