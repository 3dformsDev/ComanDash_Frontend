// src/app/store/orders/orders.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { initialOrdersState, Order } from '../orders.state';
import * as OrdersActions from '../actions/orders.actions';

export const ordersReducer = createReducer(
    initialOrdersState,

    // --- Manejo de Carga de Órdenes ---
    on(OrdersActions.loadOrders, (state) => ({
        ...state,
        loading: true,
        error: null,
    })),

    on(OrdersActions.loadOrdersSuccess, (state, { orders }) => ({
        ...state,
        orders: orders, // Reemplazamos las órdenes con las que vienen de la API
        loading: false,
    })),

    on(OrdersActions.loadOrdersFailure, (state, { error }) => ({
        ...state,
        loading: false,
        error: error,
    })),

    // --- Manejo de Creación de Órdenes ---
    on(OrdersActions.createOrder, (state) => ({
        ...state,
        loading: true,
    })),

    on(OrdersActions.createOrderSuccess, (state, { order }) => ({
        ...state,
        orders: [...state.orders, order], // Añadimos la nueva orden a la lista
        loading: false,
    })),

    // --- Manejo de Actualización de Órdenes ---
    on(OrdersActions.updateOrderSuccess, (state, { order }) => ({
        ...state,
        // Mapeamos las órdenes: si encontramos la actualizada, la reemplazamos
        orders: state.orders.map((o) => (o.id === order.id ? order : o)),
        selectedOrder: state.selectedOrder?.id === order.id ? order : state.selectedOrder,
        loading: false,
    })),

    // --- Manejo de Selección de Orden ---
    on(OrdersActions.selectOrder, (state, { orderId }) => ({
        ...state,
        currentOrder: state.orders.find(o => o.id === orderId) || null
    })),

    // Manejo genérico para fallos de escritura (Crear/Actualizar)
    on(OrdersActions.createOrderFailure, OrdersActions.updateOrderFailure, (state, { error }) => ({
        ...state,
        loading: false,
        error: error,
    })),

    on(OrdersActions.setNameOrder, (state, { customerName }) => {
        // Devolvemos un nuevo estado con la orden seleccionada
        return {
            ...state,
            customerName,
            loading: false, // No hay carga de API aquí
            error: null,
        };
    }),

    on(OrdersActions.setNumberOrder, (state, { numberTable }) => {
        // Devolvemos un nuevo estado con la orden seleccionada
        return {
            ...state,
            numberTable,
            loading: false, // No hay carga de API aquí
            error: null,
        };
    }),

    on(OrdersActions.setOrderTableOrTakeAway, (state, { table }) => {
        // Creamos el objeto con la estructura correcta para selectTabledOrder
        const selectTabledOrder = {
            orderType: table.orderType,
            tableId: table.tableId || 0,
            tableNumber: table.tableId ? `Mesa ${table.tableId}` : 'Para llevar',
        };

        // Devolvemos el nuevo estado
        return {
            ...state,
            selectTabledOrder,
            loading: false,
            error: null,
        };
    }),

    on(OrdersActions.resetCurrentOrder, (state) => ({
        ...state,
        selectedOrder: initialOrdersState.selectedOrder,       // Vuelve a null
        customerName: undefined,                               // Limpia el nombre del cliente
        selectTabledOrder: initialOrdersState.selectTabledOrder, // Resetea el objeto de la mesa
        numberTable: initialOrdersState.numberTable
    })),

    // ✅ Cuando la API devuelve la orden con éxito, la guardamos en el estado
    on(OrdersActions.selectOrderForEditSuccess, (state, { order }) => ({
        ...state,
        loading: false,
        currentOrder: order
    })),

    // ✅ Cuando la API falla, guardamos el error
    on(OrdersActions.selectOrderForEditFailure, (state, { error }) => ({
        ...state,
        loading: false,
        error: error
    })),

    on(OrdersActions.clearCurrentOrderForEdit, (state) => ({
        ...state,
        currentOrder: null // Reseteamos la propiedad a null
    }))
);