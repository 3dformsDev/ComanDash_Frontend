// src/app/auth/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '@environments/environment';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Preferences } from '@capacitor/preferences';
import { User } from '@store/auth/auth.state'; // Importa tu interfaz User
import { ApiResponse } from './table.service';

// Define una interfaz para la respuesta de la API
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl: string = environment.apiUrl;

  constructor(private _http: HttpClient) { }

  // Ahora devuelve un Observable con la respuesta completa
  login(credentials: any): Observable<AuthResponse> {
    return this._http.post<AuthResponse>(`${this.apiUrl}/v1/auth/login`, credentials);
  }

  // Guarda los datos en storage y devuelve el usuario
  saveAuthData(token: string, user: User): Observable<User> {
    return from(Preferences.set({ key: 'token', value: token })).pipe(
      switchMap(() => from(Preferences.set({ key: 'user', value: JSON.stringify(user) }))),
      map(() => user) // Devuelve el usuario para la acción de success
    );
  }

  // Limpia el storage al hacer logout
  logout(): Observable<any> {
    return this._http.post(`${this.apiUrl}/v1/auth/logout`, {}).pipe(
      catchError(error => {
        console.warn('La llamada al backend para logout falló. El proceso continuará localmente.', error);
        return of(null); // Devuelve un observable exitoso para no romper la cadena de efectos.
      })
    );
  }

  /**
   * ✅ NUEVO: Responsabilidad única de limpiar el storage local.
   */
  clearLocalAuthData(): Observable<void> {
    return from(Preferences.remove({ key: 'token' })).pipe(
      switchMap(() => from(Preferences.remove({ key: 'user' }))),
      switchMap(() => from(Preferences.remove({ key: 'fcm_token' })))
    );
  }

  validateToken(token: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    // Endpoint que valide el token en tu backend AdonisJS
    // Puede ser /auth/me, /auth/verify, o cualquier endpoint protegido
    return this._http.get(`${this.apiUrl}/v1/auth/me`);
  }
}