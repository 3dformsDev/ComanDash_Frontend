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

// --- Interfaces específicas para Sesiones de Caja ---

/**
 * Representa el objeto completo de una Sesión de Caja Registradora.
 */
export interface CashRegisterSessionI {
  id: number;
  companyId: number;
  cashRegisterId: number;
  userId: number;
  status: 'open' | 'closed';
  openingBalance: number;
  closingBalance?: number;     // Saldo calculado por el sistema al cerrar
  realClosingBalance?: number; // Saldo real contado por el usuario al cerrar
  differenceAmount?: number;   // Diferencia entre el saldo calculado y el real
  notes?: string;
  createdAt: string;           // ISO string
  updatedAt: string;           // ISO string
  closedAt?: string | null;    // ISO string
}

export interface DailySummaryI {
  totalRevenue: number,
  totalOrders: number,
  tableOrders: number,
  takeawayOrders: number,
  ordersInProcess: number,
  ordersFinished: number,
  ordersCancelled: number,
  topProducts: [
    {
      name: string,
      count: number,
      category?: {
        name: string;
      }
    },
  ]
}

/**
 * DTO (Data Transfer Object) para abrir una nueva sesión de caja.
 */
export interface OpenSessionDto {
  cashRegisterId: number;
  openingBalance: string;
  notes?: string;
}

/**
 * DTO para cerrar una sesión de caja.
 * Solo se envía el balance real contado y notas opcionales.
 */
export interface CloseSessionDto {
  realClosingBalance: string;
  notes?: string;
}

/**
 * Interfaz para el resumen de una sesión, usado antes de cerrar la caja.
 */
export interface SessionSummaryI {
  status: 'open' | 'closed';
  openingBalance: number;
  transactions?: {
    incomeByPaymentMethod: {
      name: string;
      total: number;
    }[];
    totalSales: number;
    totalWithdrawals: number;
  };
  expectedClosingBalance?: number; // El saldo que debería haber en caja
  // Propiedades que solo existen si la sesión ya está cerrada
  closingBalance?: number;
  realClosingBalance?: number;
  differenceAmount?: number;
  closedAt?: string | null;
}


@Injectable({
  providedIn: 'root'
})
export class CashRegisterSessionService {
  private apiUrl: string = environment.apiUrl;
  // Endpoint específico para las sesiones de caja
  private sessionsEndpoint = `${this.apiUrl}/v1/cashregistersessions`;

  constructor(
    private _http: HttpClient,
  ) { }

  /**
   * Abre una nueva sesión de caja.
   * @param sessionData - Los datos para la nueva sesión (ID de la caja y monto de apertura).
   */
  openSession(sessionData: OpenSessionDto): Observable<CashRegisterSessionI> {
    // Esto es funcionalmente un "create" de una nueva sesión.
    return this._http.post<ApiResponse<CashRegisterSessionI>>(this.sessionsEndpoint, sessionData)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Cierra una sesión de caja existente.
   * @param sessionId - El ID de la sesión a cerrar.
   * @param sessionData - Los datos de cierre (monto real contado).
   */
  closeSession(sessionId: number, sessionData: CloseSessionDto): Observable<CashRegisterSessionI> {
    // El backend tiene una ruta específica para esta acción, que es más segura que un PUT genérico.
    return this._http.post<ApiResponse<CashRegisterSessionI>>(`${this.sessionsEndpoint}/${sessionId}/close`, sessionData)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Obtiene el resumen de una sesión de caja.
   * Útil para mostrar en la pantalla de cierre de caja antes de que el usuario ingrese el monto final.
   * @param sessionId - El ID de la sesión de la cual obtener el resumen.
   */
  getSessionSummary(sessionId: number): Observable<SessionSummaryI> {
    return this._http.get<ApiResponse<SessionSummaryI>>(`${this.sessionsEndpoint}/summary/${sessionId}`)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Obtiene el resumen de una sesión de caja.
   * Útil para mostrar en la pantalla de cierre de caja antes de que el usuario ingrese el monto final.
   * @param sessionId - El ID de la sesión de la cual obtener el resumen.
   */
  getDailySessionSummary(): Observable<DailySummaryI> {
    return this._http.get<ApiResponse<DailySummaryI>>(`${this.sessionsEndpoint}/dailysummary`)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Obtiene una sesión de caja específica por su ID.
   * @param sessionId - El ID de la sesión a obtener.
   */
  getSession(sessionId: number): Observable<CashRegisterSessionI> {
    return this._http.get<ApiResponse<CashRegisterSessionI>>(`${this.sessionsEndpoint}/${sessionId}`)
      .pipe(
        map(response => response.data)
      );
  }
}