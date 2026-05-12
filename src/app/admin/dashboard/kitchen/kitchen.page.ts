import { Component, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { Store } from '@ngrx/store';
import { take } from 'rxjs/operators';
import { SocketService } from '@services/socket.service';
import { selectCurrentCompanyId, selectLocationId } from '@store/auth/selectors/auth.selectors';
import { combineLatest, Subscription } from 'rxjs';
import { OrderService } from '@services/order.service';
import { AuthService } from '@services/auth.service';
import { KitchenRealtimeService } from '@services/kitchen-realtime.service';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';

@Component({
  selector: 'app-kitchen',
  templateUrl: './kitchen.page.html',
  styleUrls: ['./kitchen.page.scss'],
  standalone: false,
})
export class KitchenPage implements OnInit, OnDestroy {
  public activeView: 'byOrder' | 'byProduct' = 'byOrder';
  public pendingOrders: any[] = [];
  public isLoading: boolean = true;
  private ordersSubscription!: Subscription;
  private timerInterval: any;

  @ViewChildren(CdkVirtualScrollViewport) viewports!: QueryList<CdkVirtualScrollViewport>;
  constructor(
    private _kitchenRealtimeService: KitchenRealtimeService,
    private _ordersService: OrderService,
  ) {
  }

  // 1. AJUSTE EN ngOnInit: Más limpio y en el orden correcto.
  ngOnInit() {
    // this.loadInitialOrders();
    this.subscribeToOrders();
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    // ✅ Nos aseguramos de desuscribirnos del observable del servicio
    if (this.ordersSubscription) {
      this.ordersSubscription.unsubscribe();
    }
  }

  /**
   * Carga las órdenes pendientes iniciales desde la API.
   */
  // En: kitchen.page.ts

  // Renombramos el método para mayor claridad
  subscribeToOrders() {
    this.isLoading = true;
    this.ordersSubscription = this._kitchenRealtimeService.kitchenOrders$.subscribe(orders => {

      // --- Lógica de filtrado y mapeo (esta parte está bien) ---
      const validStatuses = ['pending', 'in_preparation'];
      this.pendingOrders = (orders || [])
        .filter(order =>
          order.orderItems.some(item => validStatuses.includes(item.kitchenStatus as string))
        )
        .map(order => ({
          ...order,
          orderItems: (order.orderItems || []).map((item: any) => ({
            ...item,
            isReady: item.kitchenStatus === 'pending'
          }))
        }));

      // --- LÓGICA MOVIDA AQUÍ DENTRO ---

      // ✅ 1. Ocultar el 'loading' solo después de procesar los datos.
      this.isLoading = false;

      // ✅ 2. Comprobar e iniciar el temporizador aquí, cuando SÍ tenemos las órdenes.
      if (!this.timerInterval && this.pendingOrders.length > 0) {
        this.startTimer();
      }

      // ✅ 3. Detener el temporizador si la lista se vacía.
      if (this.pendingOrders.length === 0) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    });
  }

  // 3. AJUSTE EN startTimer: Cálculo de fecha corregido.
  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerInterval = setInterval(() => {
      if (!this.pendingOrders || this.pendingOrders.length === 0) return;

      this.pendingOrders.forEach(order => {
        const orderCreationTime = new Date(order.createdAt).getTime();
        const elapsedMs = Date.now() - orderCreationTime;
        const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

        const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
        const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
        order.timerDisplay = `${minutes}:${seconds}`;
      });
    }, 1000);
  }

  // 4. AJUSTE DE DATOS: getter 'aggregatedProducts' corregido.
  get aggregatedProducts() {
    if (this.activeView !== 'byProduct') return [];

    const productMap = new Map();

    this.pendingOrders.forEach(order => {
      for (const item of order.orderItems) {
        if (!item.isReady) {
          if (productMap.has(item.productId)) {
            const existing = productMap.get(item.productId);
            // Suma la cantidad del producto
            existing.total += item.quantity;

            // Si esta orden aún no ha sido contada para este producto...
            if (!existing.orders.includes(order.orderNumber)) {
              existing.orders.push(order.orderNumber);
              // ...y si la orden tiene notas, incrementa el contador.
              if (order.kitchenNotes) {
                existing.notesCount++;
              }
            }
          } else {
            // Si es un producto nuevo, lo añade al mapa
            productMap.set(item.productId, {
              id: item.productId,
              name: item.product.name,
              total: item.quantity,
              orders: [order.orderNumber],
              category: item.product.category,
              // --> LÍNEA NUEVA: Inicializa el contador de notas.
              notesCount: order.kitchenNotes ? 1 : 0
            });
          }
        }
      }
    });

    return Array.from(productMap.values()).sort((a, b) => b.total - a.total);
  }


  // 5. AJUSTE DE DATOS: getOrderInfoString corregido.
  getOrderInfoString(order: any): string {
    if (order.orderType === 'dine_in' && order.table) {
      return `Mesa ${order.table.tableNumber}`;
    }
    return `Para llevar (${order.customerName})`;
  }

  getTimerClass(order: any): string {
    const elapsedMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);

    if (elapsedMinutes >= 40) return 'critical';     // 40+ minutos - Rojo crítico
    if (elapsedMinutes >= 30) return 'very-urgent';  // 30+ minutos - Rojo intenso
    if (elapsedMinutes >= 15) return 'urgent';       // 15+ minutos - Rojo
    if (elapsedMinutes >= 5) return 'warning';       // 5+ minutos - Amarillo
    return 'normal';                                 // 0-4 minutos - Verde
  }

  // Opcional: Método para obtener la clase del borde de la tarjeta
  getOrderCardClass(order: any): string {
    const elapsedMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);

    if (order.wasModified) return 'modified';
    if (elapsedMinutes >= 40) return 'critical-border';
    if (elapsedMinutes >= 30) return 'very-urgent-border';
    if (elapsedMinutes >= 15) return 'urgent-border';

    return ''; // Clase por defecto
  }

  changeView(view: 'byOrder' | 'byProduct') {
    this.activeView = view;
  }

  toggleItemReady(order: any, itemToToggle: any) {

    this._kitchenRealtimeService.notifyItemStatusChange(
      order.id,
      itemToToggle.id,
      !itemToToggle.isReady // Enviamos el NUEVO estado deseado
    );

    // const item = order.orderItems.find((i: any) => i.id === itemToToggle.id);
    // if (item) item.isReady = !item.isReady;
  }

  isOrderReady(order: any): boolean {
    return order.orderItems.every((item: any) => item.isReady);
  }

  async dispatchOrder(orderId: number) {
    this._ordersService.markAsReadyOrder(orderId).subscribe({
      error: (err) => {
        console.error('Error al despachar la orden:', err);
        // Aquí podrías mostrar una notificación de error al usuario
      },
    });
  }

  markProductAsReady(productName: string) {
    this.pendingOrders.forEach(order => {
      order.orderItems.forEach((item: any) => {
        if (item.product.name === productName && !item.isReady) {
          item.isReady = true;
        }
      });
    });
  }

  markProductAsOutOfStock(productId: number) {
    let productName = '';
    this.pendingOrders.forEach(order => {
      const itemToRemove = order.orderItems.find((i: any) => i.productId === productId && !i.isReady);
      if (itemToRemove) {
        if (!productName) productName = itemToRemove.product.name;
        order.orderItems = order.orderItems.filter((i: any) => i.productId !== productId);
        const note = `AGOTADO: ${itemToRemove.quantity}x ${productName}`;
        order.kitchenNotes = order.kitchenNotes ? `${order.kitchenNotes}; ${note}` : note;
        order.wasModified = true;
      }
    });
    this.pendingOrders = this.pendingOrders.filter(order => order.orderItems.length > 0);
  }


  /**
   * ✅ Se ejecuta CADA VEZ que la página está a punto de entrar y volverse la vista activa.
    * Es el lugar perfecto para INICIAR la lógica de tiempo real.
    */
  ionViewWillEnter() {
    this._kitchenRealtimeService.init();
  }


  /**
   * ✅ Se ejecuta CADA VEZ que la página está a punto de salir y dejar de ser la vista activa.
   * Es el lugar perfecto para DETENER la lógica y limpiar.
   */
  ionViewWillLeave() {
    this._kitchenRealtimeService.shutdown();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null; // Limpiamos el intervalo
    }
  }
}