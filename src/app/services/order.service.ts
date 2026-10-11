import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@environments/environment';
import { Order, OrderPayment } from '@store/orders/orders.state';
import { Observable, defer, firstValueFrom } from 'rxjs';
import { InventoryService, InventoryReturn } from './inventory.service';
import { ModalController } from '@ionic/angular';
import { InventoryReturnModalComponent } from '../components/inventory-return/inventory-return.component';
import { tap } from 'rxjs/operators';

export function orderFromUpdateResponse(result: Order | { order: Order }): Order {
  return 'order' in result ? result.order : result;
}

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private apiUrl = `${environment.apiUrl}/v1/orders`;
  private paymentOrderUrl = `${environment.apiUrl}/v1/orderpayments`;

  private inventory = inject(InventoryService);
  private modal = inject(ModalController);
  constructor(private http: HttpClient) {}

  // --> Nuevo método para obtener órdenes pendientes para la cocina
  getPendingKitchenOrders(): Observable<Order[]> {
    return this.http.get<any[]>(`${this.apiUrl}/kitchen/pending`);
  }

  /**
   * Obtiene todas las órdenes del backend.
   * @returns Un Observable con un arreglo de órdenes.
   */
  getAllOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.apiUrl);
  }

  /**
   * Envía una nueva orden al backend para ser creada.
   * @param order El objeto de la orden a crear.
   * @returns Un Observable con la orden creada (usualmente incluye el ID asignado por el backend).
   */
  createOrder(order: Order): Observable<Order> {
    return this.inventory.mutate<Order>('POST', this.apiUrl, order);
  }

  /**
   * Actualiza una orden existente en el backend.
   * @param order El objeto de la orden con los datos actualizados. Debe contener el ID.
   * @returns Un Observable con la orden actualizada.
   */
  updateOrder(order: Order): Observable<Order> {
    if (!order.id) {
      throw new Error('El ID de la orden es requerido para actualizar.');
    }
    const url = `${this.apiUrl}/${order.id}`;
    return defer(async () => {
      const intent = JSON.stringify(order);
      const storageKey = 'comandash.inventory.orderUpdates';
      let prepared: Record<string, any> = {};
      try { prepared = JSON.parse(sessionStorage.getItem(storageKey) || '{}'); } catch {}
      const send = async (body: any): Promise<Order> => {
        const clear = () => { try { const current = JSON.parse(sessionStorage.getItem(storageKey) || '{}'); delete current[intent]; sessionStorage.setItem(storageKey, JSON.stringify(current)); } catch {} };
        try {
          const result = await firstValueFrom(this.inventory.mutate<Order | { order: Order }>('PUT', url, body));
          clear();
          // The update endpoint returns metadata around the refreshed order. NgRx
          // and the page have always consumed the order itself.
          return orderFromUpdateResponse(result);
        }
        catch (error: any) { if (error.status >= 400 && error.status < 500) clear(); throw error; }
      };
      // After a timeout, replay the reviewed request before asking for a new preview.
      if (prepared[intent]) return send(prepared[intent]);
      const version = order.inventoryVersion ?? 0;
      const preview = await firstValueFrom(this.inventory.preview(order.id!, version, 'edit', order.orderItems));
      let inventoryReturns = preview.items;
      if (inventoryReturns.length) {
        const dialog = await this.modal.create({ component: InventoryReturnModalComponent,
          componentProps: { items: inventoryReturns }, cssClass: 'cancel-order-modal' });
        await dialog.present();
        const result = await dialog.onDidDismiss();
        if (result.role !== 'confirm') throw { error: { message: 'No se guardaron los cambios. Tu pedido sigue disponible para revisarlo.' } };
        inventoryReturns = result.data;
      }
      const body = { ...order, expectedOrderVersion: version, inventoryReturns };
      prepared[intent] = body;
      try { sessionStorage.setItem(storageKey, JSON.stringify(prepared)); } catch {}
      return send(body);
    });
  }

  /**
   * Elimina una orden del backend.
   * @param orderId El ID de la orden a eliminar.
   * @returns Un Observable vacío o con un objeto de confirmación.
   */
  deleteOrder(orderId: number): Observable<{}> {
    const url = `${this.apiUrl}/${orderId}`;
    return this.http.delete(url);
  }

  /**
   * Obtiene todas las órdenes ACTIVAS que un mesero necesita ver.
   * (En preparación, Listas, Servidas).
   */
  getActiveWaiterOrders(): Observable<Order[]> {
    // Apunta a la nueva ruta que crearemos en el backend.
    return this.http.get<Order[]>(`${this.apiUrl}/waiter/active`);
  }

  /**
   * Marcar la orden como lista
   * @param orderId
   * @returns
   */
  markAsReadyOrder(orderId: number): Observable<Order> {
    return this.http.put<Order>(
      `${this.apiUrl}/kitchen/markasready/${orderId}`,
      {},
    );
  }

  /**
   * Marcar la orden como servida
   * @param orderId
   * @returns
   */
  markAsServedOrder(orderId: number): Observable<Order> {
    return this.http.put<Order>(
      `${this.apiUrl}/waiter/markasserved/${orderId}`,
      {},
    );
  }

  /**
   * Realiza el pago de la orden (o devolución)
   * @param orderPayment
   * @returns
   */
  makeOrderPayment(orderPayment: OrderPayment): Observable<any> {
    // O un tipo más específico si sabes lo que devuelve
    return this.http.post<any>(`${this.paymentOrderUrl}`, orderPayment);
  }

  getOrderById(orderId: number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${orderId}`);
  }

  /**
   * Cancela una orden.
   * @param payload Objeto que contiene el ID de la orden y, opcionalmente,
   * el motivo y el método de pago para el reembolso.
   * @returns Un Observable con la respuesta del backend.
   */
  cancelOrder(payload: {
    orderId: number;
    reason?: string;
    paymentMethodId?: number;
    expectedOrderVersion: number;
    inventoryReturns: InventoryReturn[];
  }): Observable<any> {
    // 1. Usamos "destructuring" para separar el ID del resto de los datos.
    //    'orderId' se usará para la URL.
    //    '...body' crea un nuevo objeto con el resto de propiedades (reason, paymentMethodId).
    const { orderId, ...body } = payload;

    // 2. Construimos la URL del endpoint de cancelación.
    //    Ajusta esta ruta si es diferente en tu API.
    const url = `${this.apiUrl}/cancel/${orderId}`;

    // 3. Hacemos una petición POST a esa URL.
    //    El objeto 'body' se envía como el payload de la petición.
    //    Si 'reason' o 'paymentMethodId' no venían en el payload, simplemente no se incluirán.
    return this.inventory.mutate<any>('POST', url, body);
  }

  downloadReceipt(orderId: number): Observable<Blob> {
    const url = `${environment.apiUrl}/v1/receipts/${orderId}/pdf`;

    return this.http
      .get(url, {
        responseType: 'blob',
      })
      .pipe(
        tap((blob: Blob) => {
          const pdfUrl = window.URL.createObjectURL(blob);

          const link = document.createElement('a');

          link.href = pdfUrl;

          link.download = `recibo-${orderId}.pdf`;

          link.click();

          window.URL.revokeObjectURL(pdfUrl);
        }),
      );
  }
}
