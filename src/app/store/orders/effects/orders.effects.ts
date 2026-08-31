// src/app/store/orders/orders.effects.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import {
  catchError,
  map,
  mergeMap,
  switchMap,
  withLatestFrom,
} from 'rxjs/operators';
import { OrderService } from '@services/order.service';
('@services/order.service'); // Tu servicio de API
import * as OrdersActions from '../actions/orders.actions';
import { AppState } from '@capacitor/app';
import { Store } from '@ngrx/store';
import { selectOrdersFeature } from '../selectors/orders.selector';
import { Order, OrderItem } from '../orders.state';

@Injectable()
export class OrdersEffects {
  constructor(
    private actions$: Actions,
    private ordersService: OrderService,
    private store: Store<AppState>,
  ) {}

  // Efecto para cargar las órdenes
  loadOrders$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OrdersActions.loadOrders),
      switchMap(() =>
        // switchMap es ideal para peticiones de lectura
        this.ordersService.getAllOrders().pipe(
          map((orders) => OrdersActions.loadOrdersSuccess({ orders })),
          catchError((error) =>
            of(OrdersActions.loadOrdersFailure({ error: error.message })),
          ),
        ),
      ),
    ),
  );

  // Efecto para crear una orden
  createOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OrdersActions.createOrder),
      withLatestFrom(this.store.select(selectOrdersFeature)),
      mergeMap(([action, ordersFeature]) => {
        const { order } = action;

        // 1. FILTRAMOS primero para asegurar que todos los items tienen un ID.
        // 2. MAPEAMOS después, ahora TypeScript sabe que 'item.id' es un 'number'.
        const orderItemsToSend: OrderItem[] = order.orderItems
          .filter((item) => typeof item.id === 'number') // Filtra cualquier item sin ID
          .map((item) => ({
            productId: item.id!, // El '!' le dice a TS "confía en mí, esto no es nulo"
            quantity: item.quantity,
            modifierSelections: (item.modifierSelections || []).map((selection) => ({
              modifierGroupId: selection.modifierGroupId,
              modifierOptionId: selection.modifierOptionId,
              quantity: selection.quantity,
            })),
          }));

        console.log(order.paymentDetails);

        // Creamos el objeto final asegurando que cumple con la interfaz 'Order'
        const orderToSend: Order = {
          customerName: ordersFeature.customerName,
          // ✅ Aseguramos un valor por defecto si no hay tipo de orden
          orderType: ordersFeature.selectTabledOrder?.orderType ?? 'takeaway',
          // ✅ Usamos el operador de encadenamiento opcional para más seguridad
          ...(ordersFeature.selectTabledOrder?.orderType === 'dine_in' && {
            tableId: ordersFeature.selectTabledOrder?.tableId,
            tableNumber: ordersFeature.selectTabledOrder?.tableNumber,
          }),

          orderItems: orderItemsToSend, // Usamos el array limpio y tipado

          kitchenNotes: order.kitchenNotes,
          isAdvancePayment: order.isAdvancePayment,

          // ✅ Corregimos el tipo de 'paymentMethodId'
          // Suponiendo que 'paymentDetails.paymentMethod' es el ID numérico
          ...(order.isAdvancePayment &&
            order.paymentDetails && {
              paymentMethodId: order.paymentDetails.paymentMethodId,
              notesPayment:
                order.paymentDetails.notesPayment ??
                order.notesPayment ??
                'Todo correcto',
              adjustments:
                order.paymentDetails.adjustments || order.adjustments || [],
              advancePayments: order.paymentDetails.advancePayments || [],
            }),
        };

        console.log('Orden a enviar:', orderToSend);

        return this.ordersService.createOrder(orderToSend).pipe(
          map((newOrder) => {
            return OrdersActions.createOrderSuccess({
              order: newOrder,
            });
          }),

          catchError((error) =>
            of(OrdersActions.createOrderFailure({ error: error })),
          ),
        );
      }),
    ),
  );

  // updateOrder$ = createEffect(() =>
  //     this.actions$.pipe(
  //         ofType(OrdersActions.updateOrder),
  //         mergeMap(({ orderId, order }) => {

  //             // 1. Transformamos la lista de productos completos a OrderItem[]
  //             //    que es lo que la API espera.
  //             const orderItemsMap = (order.orderItems as any[]).reduce((acc, product) => {
  //                 // Si el producto ya está en nuestro mapa, incrementamos la cantidad
  //                 if (acc[product.id]) {
  //                     acc[product.id].quantity++;
  //                 } else {
  //                     // Si es la primera vez que lo vemos, lo añadimos al mapa
  //                     acc[product.id] = {
  //                         productId: product.id,
  //                         quantity: 1,
  //                         // Si necesitas enviar el precio, también lo puedes capturar aquí
  //                         // unitPrice: product.price
  //                     };
  //                 }
  //                 return acc;
  //             }, {} as { [key: number]: { productId: number; quantity: number } });

  //             // 2. Convertimos el mapa de vuelta a un array de objetos
  //             const orderItemsToSend: OrderItem[] = Object.values(orderItemsMap);

  //             // 3. Construimos el objeto final para enviar a la API.
  //             //    Tomamos todos los datos del objeto 'order' que viene de la acción,
  //             //    pero reemplazamos 'orderItems' con nuestra lista limpia y procesada.
  //             const orderToUpdate: Order = {
  //                 ...order,
  //                 id: orderId,
  //                 orderItems: orderItemsToSend,
  //             } as Order;

  //             console.log("Datos limpios para actualizar:", orderToUpdate);

  //             // 4. Llamamos al servicio con el objeto completo.
  //             return this.ordersService.updateOrder(orderToUpdate).pipe(
  //                 map((updatedOrder) => OrdersActions.updateOrderSuccess({ order: updatedOrder })),
  //                 catchError((error) => of(OrdersActions.updateOrderFailure({ error: error.message })))
  //             );
  //         })
  //     )
  // );

  updateOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OrdersActions.updateOrder),
      mergeMap(({ orderId, order }) => {
        // 1. La lógica compleja de 'reduce' que agrupaba ya no es necesaria.
        //    Ahora que los datos vienen pre-agrupados, la reemplazamos
        //    con un simple .map() para la transformación final.
        const orderItemsToSend = (order.orderItems as any[]).map((item) => ({
          productId: item.id, // Tomamos el 'id' del producto
          quantity: item.quantity, // Tomamos la 'quantity' que ya viene calculada
          ...(item.orderItemId && { orderItemId: item.orderItemId }),
          modifierSelections: (item.modifierSelections || []).map((selection: any) => ({
            modifierGroupId: selection.modifierGroupId,
            modifierOptionId: selection.modifierOptionId,
            quantity: selection.quantity,
          })),
        }));

        // 2. Construimos el objeto final para la API
        const orderToUpdate: Order = {
          ...order, // Mantiene datos como kitchenNotes, customerName, etc.
          id: orderId,
          orderType: order.orderType ?? 'takeaway', // Asegurar que orderType no sea undefined
          orderItems: orderItemsToSend, // PERO sobrescribe 'orderItems' con nuestra lista limpia.
        } as Order;

        console.log('Datos limpios para actualizar:', orderToUpdate);

        // 3. Llamamos al servicio con el objeto completo
        return this.ordersService.updateOrder(orderToUpdate).pipe(
          map((updatedOrder) =>
            OrdersActions.updateOrderSuccess({ order: updatedOrder }),
          ),
          catchError((error) =>
            of(OrdersActions.updateOrderFailure({ error })),
          ),
        );
      }),
    ),
  );

  selectOrderForEdit$ = createEffect(() =>
    this.actions$.pipe(
      // 1. Escucha la acción que despachas desde el componente
      ofType(OrdersActions.selectOrderForEdit),
      // 2. Usa switchMap para cancelar peticiones anteriores y llamar a tu servicio
      switchMap(({ orderId }) =>
        this.ordersService.getOrderById(orderId).pipe(
          // <-- Asumo que tienes un método así en tu servicio
          // 3. Si la petición es exitosa, despacha la acción de éxito con la orden recibida
          map((order) => OrdersActions.selectOrderForEditSuccess({ order })),
          // 4. Si la petición falla, despacha la acción de fallo con el error
          catchError((error) =>
            of(OrdersActions.selectOrderForEditFailure({ error })),
          ),
        ),
      ),
    ),
  );
}
