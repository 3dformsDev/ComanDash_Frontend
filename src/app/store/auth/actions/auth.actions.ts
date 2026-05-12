import { createAction, props } from '@ngrx/store';
import { User } from '../auth.state';

// Acción para cuando el usuario intenta iniciar sesión
export const login = createAction(
    '[Auth] Login',
    props<{ username: string; password: string, business_code: string }>() // La acción lleva los datos del formulario
);

// Acción para cuando el inicio de sesión es exitoso
export const loginSuccess = createAction(
    '[Auth API] Login Success',
    props<{ user: User, token: string }>() // La acción lleva los datos del usuario
);

// Acción para cuando el inicio de sesión falla
export const loginFailure = createAction(
    '[Auth API] Login Failure',
    props<{ error: string }>() // La acción lleva el mensaje de error
);

export const sessionClosedRemotely = createAction(
    '[Auth] Session Closed Remotely',
    props<{ session: any }>() // El payload será la data de la sesión cerrada
);

// Acción para cerrar sesión
export const logout = createAction('[Auth] Logout');