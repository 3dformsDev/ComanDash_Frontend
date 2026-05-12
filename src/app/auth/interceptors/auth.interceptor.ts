import { Injectable } from '@angular/core';
import {
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpInterceptor,
    HttpErrorResponse
} from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { switchMap, retry, delay, catchError, map } from 'rxjs/operators';
import { Preferences } from '@capacitor/preferences';
import { Store } from '@ngrx/store';
import { AppState } from '@capacitor/app';
import { logout } from '@store/auth/actions/auth.actions';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    // Define las rutas que no deben ser interceptadas (no se les añadirá el token).
    // Puedes usar fragmentos de URL. Por ejemplo, '/login' excluirá cualquier URL que lo contenga.
    private excludedUrls: string[] = ['/login'];

    constructor(
        private store: Store<AppState>
    ) { }

    /**
     * Intercepta cada solicitud HTTP.
     * Si la URL no está en la lista de exclusión, intenta obtener y adjuntar
     * el token de autenticación.
     */
    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {

        // Comprueba si la URL de la solicitud actual está en la lista de exclusión.
        const isExcluded = this.excludedUrls.some(url => request.url.includes(url));

        if (isExcluded) {
            // Si la URL está excluida, pasa la solicitud original sin ninguna modificación.
            return next.handle(request);
        }

        return from(Preferences.get({ key: 'token' })).pipe(
            switchMap(tokenData => {
                let authReq = request;

                // Si tenemos un token, clonamos la petición y lo añadimos a las cabeceras
                if (tokenData && tokenData.value) {
                    authReq = request.clone({
                        setHeaders: {
                            Authorization: `Bearer ${tokenData.value}`
                        }
                    });
                }

                // 2. Enviamos la petición (con o sin token) y nos preparamos para la respuesta
                return next.handle(authReq).pipe(
                    catchError((error: HttpErrorResponse) => {
                        // ✅ 3. AQUÍ IDENTIFICAMOS EL ERROR
                        // Si el backend responde con un error 401 (Unauthorized)...
                        if (error.status === 401) {

                            // ✅ 4. ...INICIAMOS EL PROCESO DE LOGOUT
                            // Despachamos la acción global para que el Effect se encargue
                            this.store.dispatch(logout());
                        }

                        // Devolvemos el error para no interrumpir otros posibles manejadores de errores
                        return throwError(() => error);
                    })
                );
            })
        );
    }
    // Si la URL no está excluida, continúa con la lógica para obtener y añadir el token.
    // const token$ = from(Preferences.get({ key: 'token' })).pipe(
    //     map(tokenData => {
    //         if (!tokenData.value) {
    //             throw new Error('Token no encontrado, reintentando...');
    //         }
    //         return tokenData.value;
    //     }),
    //     retry({
    //         count: 3,
    //         delay: 300
    //     }),
    //     catchError(() => {
    //         console.warn('AuthInterceptor: No se pudo obtener el token después de varios intentos.');
    //         return of(null);
    //     })
    // );

    // return token$.pipe(
    //     switchMap(authToken => {
    //         if (!authToken) {
    //             return next.handle(request);
    //         }

    //         const authReq = request.clone({
    //             setHeaders: {
    //                 Authorization: `Bearer ${authToken}`
    //             }
    //         });

    //         return next.handle(authReq);
    //     })
    // );
}

