// src/app/auth/auth.selectors.ts

import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthState } from '../auth.state';

// 1. Selector para obtener todo el feature state de 'auth'
export const selectAuthState = createFeatureSelector<AuthState>('auth');

// 2. Selectors para obtener piezas específicas del estado
export const selectIsAuthenticated = createSelector(
    selectAuthState,
    (state) => state.isAuthenticated
);

export const selectUser = createSelector(
    selectAuthState,
    (state) => state.user
);

export const selectAuthError = createSelector(
    selectAuthState,
    (state) => state.error
);

export const selectUserCompanyName = createSelector(
    selectUser,
    (user) => user?.company?.name ?? null
);

export const selectLocationCompany = createSelector(
    selectUser,
    (user) => user?.location ?? null
);

export const selectCurrentCompanyId = createSelector(
    selectUser,
    (user) => user ? user.company?.id : null // Devuelve el companyId si el usuario existe
);

export const selectLocationId = createSelector(
    selectUser,
    (user) => user ? user.location?.id : null // Devuelve el companyId si el usuario existe
);

export const selectAuthWithLocation = createSelector(
    selectIsAuthenticated,
    selectLocationId,
    (isAuthenticated, locationId) => ({
        isAuthenticated,
        locationId
    })
);

export const selectCashSessionAlertContext = createSelector(
    selectIsAuthenticated,
    selectLocationId,
    selectUser,
    (isAuthenticated, locationId, user) => ({
        isAuthenticated,
        locationId,
        user,
    }),
);
