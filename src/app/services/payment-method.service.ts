import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Asumimos que esta interfaz es compartida y está en un archivo central.
// Si no, puedes definirla aquí: export interface ApiResponse<T> { data: T; }
import { ApiResponse } from './table.service';

/**
 * Interfaz para la estructura de un Método de Pago.
 * Nota: Se ha añadido `isActive` para mantener la consistencia con la UI que estás creando.
 * Asegúrate de que tu backend también soporte este campo.
 */
export interface PaymentMethodI {
  id: number;
  name: string;
  type: 'cash' | 'card' | 'digital' | 'transfer' | 'other';
  isActive: boolean; // Campo añadido para la funcionalidad de activar/desactivar
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO (Data Transfer Object) para crear un nuevo método de pago.
 */
export interface CreatePaymentMethodDto {
  id?: number;
  name: string;
  type: string;
  isActive: boolean;
  companyId?: number; // Opcional, se puede añadir desde el store o un servicio de sesión
}

/**
 * DTO para actualizar un método de pago.
 * Usa Partial<> para hacer todos los campos opcionales.
 */
export type UpdatePaymentMethodDto = Partial<CreatePaymentMethodDto>;

@Injectable({
  providedIn: 'root'
})
export class PaymentMethodService {
  private apiUrl: string = environment.apiUrl;
  // Se asume que el endpoint para los métodos de pago sigue la misma estructura
  private methodsEndpoint = `${this.apiUrl}/v1/paymentmethods`;

  constructor(
    private _http: HttpClient
  ) { }

  /**
  * Obtiene la lista completa de métodos de pago desde la API.
  */
  getPaymentMethods(applyParams: boolean = false): Observable<PaymentMethodI[]> {
    // Usamos perPage=999999 para traer todos los registros, igual que en el ejemplo
    const params = applyParams ? 'paymentMethodIsActive=1' : '';
    return this._http.get<ApiResponse<PaymentMethodI[]>>(`${this.methodsEndpoint}?perPage=999999&${params}`)
      .pipe(
        map(response => response.data) // Extraemos el arreglo de la propiedad 'data'
      );
  }

  /**
   * Crea un nuevo método de pago.
   * @param methodData - Los datos del nuevo método a crear.
   */
  addPaymentMethod(methodData: CreatePaymentMethodDto): Observable<PaymentMethodI> {
    return this._http.post<ApiResponse<PaymentMethodI>>(this.methodsEndpoint, methodData)
      .pipe(map(response => response.data));
  }

  /**
   * Actualiza un método de pago existente.
   * @param methodId - El ID del método de pago a actualizar.
   * @param methodData - Los nuevos datos para el método de pago.
   */
  updatePaymentMethod(methodId: number, methodData: UpdatePaymentMethodDto): Observable<PaymentMethodI> {
    return this._http.put<ApiResponse<PaymentMethodI>>(`${this.methodsEndpoint}/${methodId}`, methodData)
      .pipe(map(response => response.data));
  }

  /**
   * Elimina (o desactiva) un método de pago.
   * Nota: Si tu lógica es de "soft delete" (cambiar isActive a false),
   * deberías usar el método `updatePaymentMethod` en su lugar.
   * @param methodId - El ID del método de pago a eliminar.
   */
  deletePaymentMethod(methodId: number): Observable<void> {
    return this._http.delete<void>(`${this.methodsEndpoint}/${methodId}`);
  }
}