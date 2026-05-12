
import { createReducer, on } from '@ngrx/store';
import { login, loginSuccess, loginFailure, logout, sessionClosedRemotely } from '../actions/auth.actions';
import { initialState } from '../auth.state';

export const authReducer = createReducer(
    initialState,

    // Cuando el login es exitoso
    on(loginSuccess, (state, { user }) => ({
        ...state,
        isAuthenticated: true,
        user: user,
        error: null,
    })),

    // Cuando el login falla
    on(loginFailure, (state, { error }) => ({
        ...state,
        isAuthenticated: false,
        user: null,
        error: error,
    })),
    on(sessionClosedRemotely, (state, { session }) => ({
        ...state,
        // Actualizamos el estado para reflejar que la caja ya no está abierta
        cashRegisterSessionIsOpen: false
    })),

    // Cuando se cierra sesión, volvemos al estado inicial
    on(logout, (state) => initialState)
);