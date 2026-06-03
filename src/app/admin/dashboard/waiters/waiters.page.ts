import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppState } from '@capacitor/app';
import { AlertController, ModalController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { OrderService } from '@services/order.service';
import { OrdersRealtimeService } from '@services/orders-realtime.service';
import { SocketService } from '@services/socket.service';
import { TableService } from '@services/table.service';
import { Order } from '@store/orders/orders.state';
import { Subscription } from 'rxjs';
import { PaymentComponent } from 'src/app/components/payment/payment.component';
import * as OrdersActions from '@store/orders/actions/orders.actions';
import { CancelOrderComponent } from 'src/app/components/cancel-order/cancel-order.component';
import { ToastService } from '@services/toast.service';

@Component({
  selector: 'app-waiters',
  templateUrl: './waiters.page.html',
  styleUrls: ['./waiters.page.scss'],
  standalone: false,
})
export class WaitersPage implements OnInit {
  allOrders: Order[] = [];
  filteredOrders: any[] = [];
  pendingOrders: Order[] = [];
  public groupedOrderItems: any[] = [];
  private ordersSubscription!: Subscription;

  statusFilters = [
    { label: 'Cocinando', value: 'pending', icon: 'hourglass-outline' },
    { label: 'Listas', value: 'ready', icon: 'checkmark-done-outline' },
    { label: 'Servidas', value: 'served', icon: 'restaurant-outline' },
    { label: 'Pagadas', value: 'paid', icon: 'cash-outline' },
    { label: 'Canceladas', value: 'cancelled', icon: 'close-circle-outline' },
  ];
  currentFilter: string = 'pending';
  searchQuery: string = '';

  constructor(
    private router: Router,
    private _ordersRealtimeService: OrdersRealtimeService,
    private _ordersService: OrderService,
    private _tableService: TableService,
    private _toastService: ToastService,
    private alertController: AlertController,
    private modalCtrl: ModalController,
    private store: Store<AppState>,
  ) {}

  ngOnInit() {
    console.log('WaitersPage: ngOnInit');
    this.subscribeToOrders();
  }

  /**
   * ✅ Se ejecuta CADA VEZ que la página está a punto de entrar.
   * Aquí es donde activamos nuestro servicio de tiempo real.
   */
  ionViewWillEnter() {
    console.log(
      'WaitersPage: ionViewWillEnter - Iniciando servicio en tiempo real.',
    );
    this._ordersRealtimeService.init();
  }

  /**
   * ✅ Se ejecuta CADA VEZ que la página está a punto de salir.
   * Aquí es donde apagamos el servicio para limpiar y ahorrar recursos.
   */
  ionViewWillLeave() {
    console.log(
      'WaitersPage: ionViewWillLeave - Apagando servicio en tiempo real.',
    );
    this._ordersRealtimeService.shutdown();
  }

  subscribeToOrders() {
    this.ordersSubscription = this._ordersRealtimeService.orders$.subscribe(
      (orders) => {
        this.pendingOrders = orders;
        this.applyFilters();
      },
    );
  }

  groupItems(order: Order) {
    const grouped = new Map();
    this.pendingOrders.forEach((item) => {
      if (grouped.has(item.id)) {
        grouped.get(item.id).quantity++;
      } else {
        grouped.set(item.id, { ...item, quantity: 1 });
      }
    });
    this.groupedOrderItems = Array.from(grouped.values());
  }

  selectFilter(filterValue: string) {
    this.currentFilter = filterValue;
    this.applyFilters();
  }

  handleSearch(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.applyFilters();
  }

  applyFilters() {
    // 1. Empieza siempre con la lista completa de órdenes pendientes.
    const baseOrders = [...this.pendingOrders];
    let filtered: Order[] = [];

    // 2. Usa un 'switch' para aplicar reglas de filtrado específicas para cada estado.
    switch (this.currentFilter) {
      case 'pending':
        // Regla para "En proceso": estado 'pending' Y no es prepagada.
        filtered = baseOrders.filter(
          (order) => !order.isReadyToServe && order.status != 'cancelled',
        );
        break;

      case 'ready':
        // Regla para "Listas": solo filtra por el estado 'ready'.
        filtered = baseOrders.filter(
          (order) => order.isReadyToServe && !order.isServed,
        );
        break;

      case 'served':
        // Regla para "Servidas":
        // - Debe estar servida (isServed = true)
        // - Si está paga Y no tiene mesa (o mesa libre) → NO debe estar aquí (va a payed)
        // - Si está paga Y tiene mesa Y mesa ocupada → SÍ debe estar aquí
        // - Si NO está paga → SÍ debe estar aquí
        filtered = baseOrders.filter((order) => {
          if (!order.isReadyToServe || !order.isServed) return false;

          // Si NO está paga, permanece en served
          if (!order.paidAt) return true;

          // Si está paga pero no tiene mesa, debe ir a payed (no served)
          if (!order.tableId) return false;

          if (!order.isFreedTable) return true;

          // Si está paga y tiene mesa libre, debe ir a payed (no served)
          return false;
        });
        break;

      case 'paid':
        // Regla para "Pagadas":
        // - Debe estar servida (isServed = true)
        // - Debe estar paga (paidAt existe)
        // - Debe tener fecha de pago
        // - NO puede estar si tiene mesa ocupada
        filtered = baseOrders.filter((order) => {
          if (!order.isReadyToServe || !order.isServed || !order.paidAt)
            return false;

          // Si no tiene mesa, puede estar en payed
          if (!order.tableId) return true;

          // Si tiene mesa pero está libre, puede estar en payed
          if (!order.table?.isBussy) return true;

          // Si tiene mesa ocupada, NO puede estar en payed
          return false;
        });
        break;

      case 'cancelled':
        //   // Regla para "Canceladas": solo filtra por el estado 'cancelled'.
        filtered = baseOrders.filter((order) => order.status === 'cancelled');
        break;

      default:
        // Si el filtro no coincide con ningún caso, la lista queda vacía.
        filtered = [];
        break;
    }

    // 3. APLICA LA BÚSQUEDA: Sobre la lista YA filtrada por estado.
    if (this.searchQuery && filtered.length > 0) {
      filtered = filtered.filter(
        (order) =>
          String(order.orderNumber ?? '').includes(this.searchQuery) ||
          (order.customerName &&
            order.customerName.toLowerCase().includes(this.searchQuery)),
      );
    }

    // 4. Asigna el resultado final a la variable que usa el HTML.
    this.filteredOrders = filtered;
  }

  getStatusInfo(status: string): {
    label: string;
    color: string;
    icon: string;
  } {
    const statusInfo = this.statusFilters.find((f) => f.value === status);
    let color = 'medium';

    switch (status) {
      case 'pending':
        color = 'warning';
        break;
      case 'ready':
        color = 'primary';
        break;
      case 'served':
        color = 'tertiary';
        break;
      case 'paid':
        color = 'success';
        break;
      case 'cancelled':
        color = 'danger';
        break;
    }

    return {
      label: statusInfo ? statusInfo.label : 'Desconocido',
      color: `var(--ion-color-${color})`,
      icon: statusInfo ? statusInfo.icon : 'help-circle-outline',
    };
  }

  // ACCIONES
  markAsReady(order: any) {
    order.status = 'ready';
    this.applyFilters();
  }

  async markAsServed(order: Order) {
    const alert = await this.alertController.create({
      header: 'Confirmar Acción',
      message: `¿Estás seguro de que deseas marcar como servido la órden #${order.orderNumber}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary',
        },
        {
          text: 'Sí, Servir',
          handler: () => {
            console.log(
              `Iniciando liberación de la mesa para la orden #${order.id}`,
            );
            // AQUÍ VA LA LÓGICA PARA LLAMAR A TU SERVICIO
            if (order.id) {
              this._ordersService.markAsServedOrder(order.id).subscribe({
                next: (response) => {
                  this.applyFilters();
                  console.log(`Comanda con ID #${order.id} servida.`);
                },
                error: (err) => {
                  console.error('Error al servir la orden:', err);
                },
                complete: () => {
                  console.log('Petición finalizada.');
                },
              });
            }
          },
        },
      ],
    });

    await alert.present();
  }

  cancelOrder(order: any) {
    // // En una app real, pedirías confirmación
    // order.status = 'cancelled';
    // this.applyFilters();

    // Si la orden tiene fecha de pago, requiere reembolso
    if (order.paidAt) {
      this.promptForRefundCancellation(order);
    } else {
      // Si no, es una cancelación simple
      this.promptForSimpleCancellation(order);
    }
  }

  // ✅ AÑADE ESTE MÉTODO para cancelaciones simples
  private async promptForSimpleCancellation(order: Order) {
    const alert = await this.alertController.create({
      header: 'Cancelar Comanda',
      message: `¿Estás seguro de cancelar la comanda #${order.orderNumber}?`,
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Motivo de la cancelación (opcional)',
        },
      ],
      buttons: [
        { text: 'Atrás', role: 'cancel' },
        {
          text: 'Sí, Cancelar',
          handler: (data) => {
            this._ordersService
              .cancelOrder({ orderId: order.id!, reason: data.reason })
              .subscribe({
                next: () =>
                  this._toastService.presentToast(
                    'Comanda cancelada exitosamente.',
                    'success',
                  ),
                error: (err) =>
                  this._toastService.presentToast(
                    `Error: ${err.error.message}`,
                    'danger',
                  ),
              });
          },
        },
      ],
    });
    await alert.present();
  }

  // ✅ AÑADE ESTE MÉTODO para cancelaciones con reembolso
  private async promptForRefundCancellation(order: Order) {
    const modal = await this.modalCtrl.create({
      component: CancelOrderComponent,
      componentProps: { order: order },
      // Estilos para que el modal no sea pantalla completa en móvil
      cssClass: 'cancel-order-modal',
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      this._ordersService
        .cancelOrder({
          orderId: order.id!,
          reason: data.reason,
          paymentMethodId: data.paymentMethodId,
        })
        .subscribe({
          next: (res) =>
            this._toastService.presentToast(
              `Comanda cancelada. Reembolso de ${res.refundAmount} procesado.`,
              'success',
            ),
          error: (err) =>
            this._toastService.presentToast(
              `Error: ${err.error.message}`,
              'danger',
            ),
        });
    }
  }

  // ✅ NUEVAS ACCIONES PARA LOS BOTONES
  editOrder(order: Order) {
    console.log(`Editando orden #${order.id}`);
    // ✅ 4. Despacha la acción para seleccionar la orden en el estado global
    this.store.dispatch(
      OrdersActions.selectOrderForEdit({ orderId: order.id! }),
    );

    // ✅ 5. Navega a la página de órdenes
    this.router.navigate(['/dashboard/orders']);
    // this.router.navigate(['/ruta-de-edicion', order.id]);
  }

  changeModality(order: any) {
    console.log(`Cambiando modalidad de orden #${order.id}`);
    // Aquí abrirías un modal para cambiar entre 'Mesa' y 'Para Llevar'
  }

  private getOrderPaidAmount(order: any): number {
    if (order.paymentSummary?.paidAmount !== undefined) {
      return Number(order.paymentSummary.paidAmount || 0);
    }

    if (Array.isArray(order.payments)) {
      return order.payments.reduce(
        (sum: number, payment: any) => sum + Number(payment.amount || 0),
        0,
      );
    }

    return 0;
  }

  private getOrderTotalAmount(order: any, itemsForPayment: any[]): number {
    const orderTotal = Number(order.totalAmount || order.total || 0);

    if (orderTotal > 0) {
      return orderTotal;
    }

    return itemsForPayment.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0,
    );
  }

  private applyPaymentSummaryToOrder(
    orderId: number,
    paymentSummary: any,
  ): Order | null {
    const index = this.pendingOrders.findIndex((o) => o.id === orderId);

    if (index === -1) {
      return null;
    }

    this.pendingOrders[index] = {
      ...this.pendingOrders[index],
      paymentSummary,
      paidAt: paymentSummary.isFullyPaid
        ? new Date().toString()
        : this.pendingOrders[index].paidAt,
    };

    return this.pendingOrders[index];
  }

  async payOrder(order: any) {
    const itemsForPayment = order.orderItems.map((item: any) => ({
      id: item.id,
      name: item.product.name,
      quantity: item.quantity,
      price: parseFloat(item.unitPrice),
      category: item.product.category,
    }));

    const totalAmount = this.getOrderTotalAmount(order, itemsForPayment);
    const paidAmount = this.getOrderPaidAmount(order);

    const paymentModal = await this.modalCtrl.create({
      component: PaymentComponent,
      id: 'payment-modal',
      cssClass: 'payment-modal-class',
      showBackdrop: true,
      backdropDismiss: false,
      componentProps: {
        orderToPay: {
          items: itemsForPayment,
          totalAmount,
          paidAmount,
        },
      },
    });

    await paymentModal.present();

    const { data, role } = await paymentModal.onWillDismiss();

    if (role !== 'paid' || !data) {
      this.applyFilters();
      return;
    }

    if (!order.id || !data.paymentMethodId || !data.amount) {
      await this._toastService.presentToast(
        'No se pudo procesar el pago. Faltan datos del pago.',
        'danger',
      );
      return;
    }

    this._ordersService
      .makeOrderPayment({
        orderId: order.id,
        movementType: 'sale',
        paymentMethodId: data.paymentMethodId,
        amount: Number(data.amount).toFixed(2),
        notes: data.notesPayment,
        adjustments: data.adjustments || [],
      })
      .subscribe({
        next: async (response) => {
          const paymentSummary = response.paymentSummary;

          if (paymentSummary) {
            const updatedOrder = this.applyPaymentSummaryToOrder(
              order.id,
              paymentSummary,
            );

            this.applyFilters();

            if (paymentSummary.isFullyPaid) {
              await this._toastService.presentToast(
                'Pago completado exitosamente.',
                'success',
              );

              this.showReceiptDownloadAlert(order.id);
              return;
            }

            await this._toastService.presentToast(
              `Pago recibido. Saldo pendiente: $${paymentSummary.pendingAmount.toLocaleString('es-CO')}`,
              'success',
            );

            if (updatedOrder) {
              await this.payOrder(updatedOrder);
            }

            return;
          }

          this.applyFilters();

          await this._toastService.presentToast(
            'Pago procesado correctamente.',
            'success',
          );
        },
        error: async (err) => {
          console.error('Error al realizar el pago:', err);

          await this._toastService.presentToast(
            err?.error?.message || 'Error al realizar el pago.',
            'danger',
          );
        },
      });
  }

  viewOrderDetails(orderId: number) {
    console.log(`Navegando a los detalles de la orden #${orderId}`);
  }

  addNewOrder() {
    console.log('Navegando para crear una nueva orden');
  }

  openDashboardPage() {
    this.router.navigateByUrl('/dashboard');
  }

  async releaseTable(order: any) {
    const alert = await this.alertController.create({
      header: 'Confirmar Acción',
      message: `¿Estás seguro de que deseas liberar la mesa #${order.tableId} asociada a esta orden?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary',
        },
        {
          text: 'Sí, Liberar',
          handler: () => {
            console.log(
              `Iniciando liberación de la mesa para la orden #${order.id}`,
            );
            // AQUÍ VA LA LÓGICA PARA LLAMAR A TU SERVICIO
            // Ejemplo:
            if (order.id) {
              this._tableService
                .releaseTable(order.tableId, order.id)
                .subscribe({
                  next: (response) => {
                    // ✅ SOLUCIÓN: Crear una copia del objeto en lugar de mutarlo directamente
                    const index = this.pendingOrders.findIndex(
                      (o) => o.id === order.id,
                    );

                    if (index !== -1) {
                      // 🔥 Crea una nueva instancia del objeto con todas las propiedades intactas
                      this.pendingOrders[index] = {
                        ...this.pendingOrders[index], // Conserva todas las propiedades existentes
                        tableId: null, // Solo modifica tableId
                        table: {
                          isBussy: false,
                        }, // También limpia la referencia de table si existe
                      };
                    }

                    this.applyFilters();
                    console.log(`Tabla #${order.tableId} liberada.`);
                  },
                  error: (err) => {
                    console.error('Error al liberar tabla:', err);
                  },
                  complete: () => {
                    console.log('Petición finalizada.');
                  },
                });
            }
          },
        },
      ],
    });

    await alert.present();
  }

  trackByOrder(index: number, item: Order) {
    return item.id; // 👈 usa el id único de la orden
  }
  async showReceiptDownloadAlert(orderId: number) {
    const alert = await this.alertController.create({
      header: 'Pago realizado',
      message: '¿Deseas descargar el recibo?',
      cssClass: 'receipt-download-alert',
      buttons: [
        {
          text: 'NO',
          role: 'cancel',
        },
        {
          text: 'SÍ DESCARGAR',
          handler: () => {
            this._ordersService.downloadReceipt(orderId).subscribe({
              next: () => {
                console.log('Recibo descargado correctamente');
              },
              error: (err) => {
                console.error('Error descargando recibo', err);
              },
            });
          },
        },
      ],
    });

    await alert.present();
  }
}
