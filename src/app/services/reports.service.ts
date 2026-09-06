import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { ApiResponse } from './table.service';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Order } from '@store/orders/orders.state';

// --- (Tus interfaces SalesReportResponse y PeakTimesResponse están perfectas) ---
export interface SalesReportResponse {
  businessTimeZone: string;
  businessDayCutoffHour: number;
  range: {
    startDate: string;
    endDate: string;
  };
  summary: SalesReportSummary;
  chartData: { label: string, total: number }[];
  tableRows: ProductSalesRow[];
  dailySales: { day: string, orderCount: number, total: number }[];
  paymentMethods: PaymentMethodReport[];
  cuts: CashRegisterCutReport[];
}

export interface ProductOptionSalesBreakdown {
  groupName: string;
  optionName: string;
  quantity: number;
  total: number;
}

export interface ProductOptionSalesGroup {
  groupName: string;
  options: ProductOptionSalesBreakdown[];
  total: number;
}

export interface ProductSalesRow {
  productId: number;
  productName: string;
  category: string;
  quantity: number;
  total: number;
  optionBreakdown: ProductOptionSalesBreakdown[];
}

export interface SalesReportSummary {
  totalOrders: number;
  tableOrders: number;
  takeawayOrders: number;
  productsSubtotal: number;
  charges: number;
  discounts: number;
  totalSales: number;
  paymentsReceived: number;
  refunds: number;
  netPayments: number;
  cancelledOrders: number;
  inProcessOrders: number;
}

export interface PaymentMethodReport {
  id: number;
  name: string;
  received: number;
  refunded: number;
  net: number;
}

export interface CashRegisterCutReport {
  sessionId: number;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string | null;
  cashRegisterName: string;
  orderCount: number;
  totalSales: number;
}

export interface PeakTimesResponse {
  businessTimeZone?: string;
  businessDayCutoffHour?: number;
  peakHours: { hour: number, orderCount: number }[];
  peakDays: { dayIndex: number, dayName: string, orderCount: number }[];
}

export interface DailyOrdersReportResponse extends SalesReportResponse {
  businessDate: string;
  paidOrders: Order[];
  cancelledOrders: Order[];
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
    const datePart = isoString?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

    if (!datePart) {
      throw new Error('La fecha seleccionada no es valida.');
    }

    return datePart;
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

  generateDailyOrdersReport(date: string): Observable<DailyOrdersReportResponse> {
    const dateFormatted = this.formatDate(date);

    return this._http
      .get<ApiResponse<DailyOrdersReportResponse>>(
        `${this.reportsEndpoint}/daily-orders?date=${dateFormatted}`,
      )
      .pipe(map(response => response.data));
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
