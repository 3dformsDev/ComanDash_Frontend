import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { ApiResponse } from './table.service';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

// --- (Tus interfaces SalesReportResponse y PeakTimesResponse están perfectas) ---
export interface SalesReportResponse {
  chartData: { label: string, total: number }[];
  tableRows: { productName: string, category: string, quantity: number, total: number }[];
  dailySales: { day: string, total: number }[];
}

export interface PeakTimesResponse {
  peakHours: { hour: number, orderCount: number }[];
  peakDays: { dayIndex: number, dayName: string, orderCount: number }[];
}


@Injectable({
  providedIn: 'root'
})
export class ReportsService {

  private apiUrl: string = environment.apiUrl;
  private reportsEndpoint = `${this.apiUrl}/v1/reports`;

  constructor(
    private _http: HttpClient,
  ) { }

  /**
   * 1. NUEVA FUNCIÓN PRIVADA
   * Toma una fecha ISO completa (ej: "2025-10-01T05:00:00.000Z")
   * y devuelve solo la parte de la fecha (ej: "2025-10-01").
   */
  private formatDate(isoString: string): string {
    // new Date(isoString) lo convierte a la zona local
    // .toISOString() lo revierte a UTC
    // .split('T')[0] corta y devuelve solo la parte 'YYYY-MM-DD'
    return new Date(isoString).toISOString().split('T')[0];
  }

  /**
   * Obtiene el reporte de ventas (categorías, productos, desglose diario)
   */
  generateReportSalesWithDateRange(startDate: string, endDate: string): Observable<SalesReportResponse> {

    // 2. FORMATEAR LAS FECHAS ANTES DE USARLAS
    const startDateFormatted = this.formatDate(startDate);
    const endDateFormatted = this.formatDate(endDate);

    return this._http.get<ApiResponse<SalesReportResponse>>(
      // 3. USAR LAS FECHAS FORMATEADAS EN LA URL
      `${this.reportsEndpoint}/sales?startDate=${startDateFormatted}&endDate=${endDateFormatted}`
    )
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Obtiene el reporte de horas y días pico (tráfico)
   */
  generateReportPeakTimesWithDateRange(startDate: string, endDate: string): Observable<PeakTimesResponse> {

    // 2. FORMATEAR LAS FECHAS ANTES DE USARLAS
    const startDateFormatted = this.formatDate(startDate);
    const endDateFormatted = this.formatDate(endDate);

    return this._http.get<ApiResponse<PeakTimesResponse>>(
      // 3. USAR LAS FECHAS FORMATEADAS EN LA URL
      `${this.reportsEndpoint}/peak-times?startDate=${startDateFormatted}&endDate=${endDateFormatted}`
    )
      .pipe(
        map(response => response.data)
      );
  }
}