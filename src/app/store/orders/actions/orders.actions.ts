// src/app/store/orders/orders.actions.ts
import { createAction, props } from '@ngrx/store';
import { Order } from '../orders.state'; // Importamos nuestro modelo
import { TableI } from '@services/table.service';

// --- Cargar Órdenes (Leer) ---
export const loadOrders = createAction('[Orders Page] Load Orders');

export const loadOrdersSuccess = createAction(
    '[Orders API] Load Orders Success',
    props<{ orders: Order[] }>()
);

export const loadOrdersFailure = createAction(
    '[Orders API] Load Orders Failure',
    props<{ error: string }>()
);

// --- Crear una Orden (Crear) ---
export const createOrder = createAction(
    '[Orders Page] Create Order',
    props<{ order: Order }>()
);

export const createOrderSuccess = createAction(
    '[Orders API] Create Order Success',
    props<{ order: Order }>() // El backend devolverá la orden creada, con ID
);

export const createOrderFailure = createAction(
    '[Orders API] Create Order Failure',
    props<{ error: string }>()
);

// --- Actualizar una Orden (Actualizar) ---
export const updateOrder = createAction(
    '[Orders Page] Update Order',
    props<{ orderId: number, order: Partial<Order> }>()
);

export const updateOrderSuccess = createAction(
    '[Orders API] Update Order Success',
    props<{ order: Order }>()
);

export const updateOrderFailure = createAction(
    '[Orders API] Update Order Failure',
    props<{ error: string }>()
);

// --- Seleccionar una orden para ver detalles ---
export const selectOrder = createAction(
    '[Orders Page] Select Order',
    props<{ orderId: number }>()
);

export const setNameOrder = createAction(
    '[Dashboard Page] Create Draft Order',
    props<{ customerName: string }>()
);

export const setNumberOrder = createAction(
    '[Dashboard Page] Create Draft Order',
    props<{
        numberTable: {
            id: number,
            tableNumber: string
        }
    }>()
);

export const setOrderTableOrTakeAway = createAction(
    '[Dashboard Page] Set Order Table',
    props<{
        table: {
            orderType: 'dine_in' | 'takeaway',
            tableId: number | null
        }
    }>()
);

export const resetCurrentOrder = createAction(
    '[Orders] Reset Current Order'
);

export const selectOrderForEdit = createAction(
    '[Orders Page] Select Order For Edit',
    props<{ orderId: number }>()
);

export const selectOrderForEditSuccess = createAction(
    '[Orders API] Select Order For Edit Success',
    props<{ order: Order }>()
);

export const selectOrderForEditFailure = createAction(
    '[Orders API] Select Order For Edit Failure',
    props<{ error: any }>()
);

export const clearCurrentOrderForEdit = createAction(
    '[Orders Page] Clear Current Order For Edit'
);