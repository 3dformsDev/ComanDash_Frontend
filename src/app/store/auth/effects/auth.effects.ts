// src/app/auth/effects/auth.effects.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of, from, EMPTY } from 'rxjs';
import { catchError, map, exhaustMap, tap, switchMap } from 'rxjs/operators';
import { AuthService } from '@services/auth.service';
import * as AuthActions from '../actions/auth.actions';
import { ToastService } from '@services/toast.service'
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Preferences } from '@capacitor/preferences';
import { SocketService } from '@services/socket.service';
import { NotificationService } from '@services/notification.service';

@Injectable()
export class AuthEffects {

    init$ = createEffect(() =>
        this.actions$.pipe(
            ofType(ROOT_EFFECTS_INIT),
            switchMap(() =>
                from(Preferences.get({ key: 'token' })).pipe(
                    switchMap(tokenResult =>
                        from(Preferences.get({ key: 'user' })).pipe(
                            switchMap(userResult => {
                                const token = tokenResult.value;
                                const user = userResult.value ? JSON.parse(userResult.value) : null;

                                if (token && user) {
                                    // Validar el token con el backend antes de establecer el estado
                                    return this.authService.validateToken(token).pipe(
                                        map(() => {
                                            // Token válido, establecer estado de autenticado
                                            return AuthActions.loginSuccess({ user, token });
                                        }),
                                        catchError(() => {
                                            // Token inválido, limpiar storage y redirigir
                                            this.clearStorageAndRedirect();
                                            return EMPTY;
                                        })
                                    );
                                } else {
                                    // No hay datos de autenticación
                                    return EMPTY;
                                }
                            })
                        )
                    )
                )
            )
        )
    );

    // Efecto que se dispara con la acción [Auth] Login
    login$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.login),
            exhaustMap(action =>
                this.authService.login({
                    username: action.username,
                    password: action.password,
                    business_code: action.business_code
                }).pipe(
                    map((response) => {
                        console.log(JSON.stringify(response));
                        return AuthActions.loginSuccess({
                            user: response.data.user,
                            token: response.data.token
                        })
                    }),
                    catchError((error: HttpErrorResponse) => {
                        let errorMessage = 'Ocurrió un error desconocido.';

                        if (error.error && Array.isArray(error.error.errors) && error.error.errors.length > 0) {
                            errorMessage = error.error.errors.map((err: any) => err.message).join('\n');
                        } else if (error.error && error.error.message) {
                            errorMessage = error.error.message;
                        }

                        return of(AuthActions.loginFailure({ error: errorMessage }));
                    })
                )
            )
        )
    );

    // Efecto que se dispara con [Auth API] Login Success
    loginSuccess$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.loginSuccess),
            exhaustMap(({ user, token }) =>
                this.authService.saveAuthData(token, user).pipe(
                    tap(() => {
                        this.socketService.connect(token);
                        this.notificationService.init();
                        this.toastService.presentToast('¡Bienvenido!', 'success');
                        this.router.navigate(['/dashboard']);
                    }),
                )
            )
        ), { dispatch: false }
    );

    // Efecto que se dispara con [Auth API] Login Failure
    loginFailure$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.loginFailure),
            tap(({ error }) => {
                this.toastService.presentToast(error, 'danger');
            })
        ), { dispatch: false }
    );

    // ✅ REFACTORIZADO: Orquesta todo el proceso de logout.
    logout$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.logout),
            exhaustMap(() =>
                // 1. Obtiene el fcm_token del storage.
                from(Preferences.get({ key: 'fcm_token' })).pipe(
                    switchMap(fcmTokenResult =>
                        // 2. Llama al API de logout con el token.
                        this.authService.logout()
                    ),
                    switchMap(() =>
                        // 3. Limpia los datos locales de autenticación.
                        this.authService.clearLocalAuthData()
                    ),
                    // 4. Ejecuta todas las demás tareas de limpieza y navegación.
                    tap(() => {
                        this.socketService.disconnect();
                        this.notificationService.shutdown();
                        this.router.navigate(['/login']);
                    })
                )
            )
        ), { dispatch: false }
    );

    // ✅ NUEVO EFFECT: Escucha eventos de cierre de caja en tiempo real
    listenForSessionClosure$ = createEffect(() =>
        this.socketService.listen('cash_register_closed').pipe(
            map(sessionData => {
                console.log('Socket event received: cash_register_closed', sessionData);
                // Cuando llega el evento, despachamos nuestra acción de NgRx
                return AuthActions.sessionClosedRemotely({ session: sessionData });
            })
        )
    );

    // Método privado para limpiar storage y redirigir
    private async clearStorageAndRedirect(): Promise<void> {
        try {
            await Preferences.remove({ key: 'token' });
            await Preferences.remove({ key: 'user' });
            this.router.navigate(['/login']);
        } catch (error) {
            console.error('Error clearing storage:', error);
            this.router.navigate(['/login']);
        }
    }

    constructor(
        private actions$: Actions,
        private authService: AuthService,
        private toastService: ToastService,
        private router: Router,
        private socketService: SocketService,
        private notificationService: NotificationService
    ) { }
}