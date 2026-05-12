import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Interfaz genérica para la respuesta de la API (puedes moverla a un archivo central)
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success?: boolean;
}

// Interfaz que representa el objeto completo de una Caja Registradora
export interface CashRegisterI {
  id: number;
  companyId: number;
  locationId: number;
  name: string;
  initialBalance: number;
  isActive: boolean;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  cashRegisterSession: {
    isOpen: boolean;
    idCashRegisterSession: number | null;
    cashRegisterInfo?: {
      openingBalance: string;
    }
  }
}

// DTO para crear una nueva Caja Registradora
export interface CreateCashRegisterDto {
  name: string;
  locationId: number;
  initialBalance: string;
}

// DTO para actualizar una Caja Registradora (todas las propiedades son opcionales)
export interface UpdateCashRegisterDto {
  name?: string;
  locationId?: number;
  initialBalance?: number;
  isActive?: boolean;
}

// Interfaz para la respuesta de desactivación
export interface DeactivationResponse {
  success: boolean;
  message: string;
}


@Injectable({
  providedIn: 'root'
})
export class CashRegisterService {
  private apiUrl: string = environment.apiUrl;
  // Endpoint específico para las cajas registradoras
  private cashRegistersEndpoint = `${this.apiUrl}/v1/cashregisters`;

  constructor(
    private _http: HttpClient,
  ) { }

  /**
  * Obtiene la lista de cajas registradoras.
  * @param onlyActive - Si es true, filtra para obtener solo las cajas activas.
  */
  getCashRegisters(onlyActive: boolean = false): Observable<CashRegisterI[]> {
    const params = onlyActive ? 'isActive=1' : '';
    // Usamos perPage grande para traer todas, siguiendo el patrón del servicio de categorías.
    return this._http.get<ApiResponse<CashRegisterI[]>>(`${this.cashRegistersEndpoint}?perPage=999999&${params}`)
      .pipe(
        map(response => response.data) // Extraemos el array de datos
      );
  }

  /**
   * Crea una nueva caja registradora en el backend.
   * @param cashRegisterData - Los datos para la nueva caja.
   */
  addCashRegister(cashRegisterData: CreateCashRegisterDto): Observable<CashRegisterI> {
    return this._http.post<ApiResponse<CashRegisterI>>(this.cashRegistersEndpoint, cashRegisterData)
      .pipe(
        map(response => response.data) // Extraemos la caja creada
      );
  }

  /**
   * Actualiza una caja registradora existente.
   * @param cashRegisterId - El ID de la caja a actualizar.
   * @param cashRegisterData - Los nuevos datos para la caja.
   */
  updateCashRegister(cashRegisterId: number, cashRegisterData: UpdateCashRegisterDto): Observable<CashRegisterI> {
    return this._http.put<ApiResponse<CashRegisterI>>(`${this.cashRegistersEndpoint}/${cashRegisterId}`, cashRegisterData)
      .pipe(
        map(response => response.data) // Extraemos la caja actualizada
      );
  }

  /**
   * Desactiva una caja registradora (soft delete).
   * El backend no la borra, solo la marca como inactiva.
   * @param cashRegisterId - El ID de la caja a desactivar.
   */
  deactivateCashRegister(cashRegisterId: number): Observable<DeactivationResponse> {
    return this._http.delete<DeactivationResponse>(`${this.cashRegistersEndpoint}/${cashRegisterId}`);
  }
}