// src/app/store/orders/orders.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { OrdersState } from '../orders.state';

// 1. Selector de la "feature": obtiene la rama 'orders' del estado global
export const selectOrdersFeature = createFeatureSelector<OrdersState>('orders');

// 2. Selectors para cada propiedad del estado
export const selectAllOrders = createSelector(
    selectOrdersFeature,
    (state) => state.orders
);

export const selectSelectedOrder = createSelector(
    selectOrdersFeature,
    (state) => state.selectedOrder
);

export const selectOrdersLoading = createSelector(
    selectOrdersFeature,
    (state) => state.loading
);

export const selectOrdersError = createSelector(
    selectOrdersFeature,
    (state) => state.error
);

// 3. Ejemplo de un selector más complejo que combina otros
export const selectCompletedOrders = createSelector(
    selectAllOrders,
    (orders) => orders.filter(order => order.status === 'completed')
);