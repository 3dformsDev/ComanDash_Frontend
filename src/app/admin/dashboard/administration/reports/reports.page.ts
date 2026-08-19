import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { IonModal } from '@ionic/angular/common';
import { CashRegisterSessionService } from '@services/cash-register-session.service';
import {
  DailyOrdersReportResponse,
  PeakTimesResponse,
  ReportsService,
  SalesReportResponse,
} from '@services/reports.service';
import { OrderService } from '@services/order.service';
import { Order } from '@store/orders/orders.state';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { firstValueFrom } from 'rxjs'; // 1. IMPORTAR
import { Chart } from 'chart.js/auto'; // 2. IMPORTAR

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: false
})
export class ReportsPage implements OnInit {

  @ViewChild('modalStart', { static: false }) modalStart!: IonModal;
  @ViewChild('modalEnd', { static: false }) modalEnd!: IonModal;
  @ViewChild('modalDaily', { static: false }) modalDaily!: IonModal;

  // Rango de fechas
  startDate = '';
  endDate = '';
  maxDate = '';
  dailyDate = '';

  isLoading: boolean = false;
  isDailyLoading = false;
  activeTab: 'summary' | 'daily' = 'summary';

  // 3. USA LA INTERFAZ CORRECTA
  reportData: SalesReportResponse | null = null;
  reportPeaks: PeakTimesResponse | null = null;
  grandTotalSales: number = 0;
  productsExpanded = false;
  paymentReconciliationExpanded = false;
  dailyReportData: DailyOrdersReportResponse | null = null;
  dailyPaidExpanded = true;
  dailyCancelledExpanded = false;

  // 4. INSTANCIAS PARA AMBOS GRÁFICOS
  private categoryChartInstance: any = null;
  private dailyChartInstance: any = null;
  private hoursChartInstance: any = null;
  private daysChartInstance: any = null;
  private readonly orderService = inject(OrderService);

  constructor(
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private _reportsService: ReportsService,
    private cashRegisterSessionService: CashRegisterSessionService,
    private route: ActivatedRoute,
  ) {
    const today = this.getBogotaDate();
    this.setDefaultDateRange(today);
  }

  ngOnInit(): void {
    const requestedBusinessDate = this.route.snapshot.queryParamMap.get('businessDate');
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');

    this.cashRegisterSessionService.getBusinessDaySettings().subscribe({
      next: ({ cutoffHour }) => {
        this.setDefaultDateRange(this.getBogotaBusinessDate(cutoffHour));
        this.applyRequestedDailyReport(requestedBusinessDate, requestedTab);
      },
      error: (error) => {
        console.error('No se pudo cargar la configuracion del dia operativo:', error);
        this.applyRequestedDailyReport(requestedBusinessDate, requestedTab);
      },
    });
  }

  private applyRequestedDailyReport(
    businessDate: string | null,
    tab: string | null,
  ): void {
    if (tab !== 'daily' || !businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      return;
    }

    this.activeTab = 'daily';
    this.dailyDate = businessDate;
    void this.generateDailyReport();
  }

  /**
   * Obtiene los datos del reporte desde el servicio y actualiza la vista.
   */
  async generateReport() {
    this.isLoading = true;
    this.reportData = null;
    this.reportPeaks = null;
    this.productsExpanded = false;
    this.paymentReconciliationExpanded = false;

    // 5. DESTRUYE AMBOS GRÁFICOS
    if (this.categoryChartInstance) this.categoryChartInstance.destroy();
    if (this.dailyChartInstance) this.dailyChartInstance.destroy();
    if (this.hoursChartInstance) this.hoursChartInstance.destroy(); // <-- NUEVA
    if (this.daysChartInstance) this.daysChartInstance.destroy();

    const loading = await this.loadingCtrl.create({
      message: 'Generando reporte...',
    });
    await loading.present();

    try {
      // 6. ¡CONECTADO! Llama al servicio y guarda la respuesta
      const [data, dataPeaks] = await Promise.all([
        firstValueFrom(
          this._reportsService.generateReportSalesWithDateRange(
            this.startDate,
            this.endDate,
          ),
        ),
        firstValueFrom(
          this._reportsService.generateReportPeakTimesWithDateRange(
            this.startDate,
            this.endDate,
          ),
        ),
      ]);

      if (!data || !dataPeaks) {
        // Lanzamos un error para que lo capture el 'catch' de abajo
        throw new Error('La respuesta del API no contenía la estructura de datos esperada (data is null/undefined).');
      }

      this.reportData = data; // Asigna los datos REALES
      this.reportPeaks = dataPeaks;

      this.grandTotalSales = Number(this.reportData.summary.totalSales || 0);

      if (!data.chartData.length && !data.tableRows.length) {
        this.presentToast('No se encontraron datos en este rango.', 'warning');
      }

      // 7. Espera un ciclo de renderizado para que el canvas exista
      // RENDERIZA LOS 4 GRÁFICOS
      setTimeout(() => {
        if (this.reportData?.chartData.length) {
          this.renderCategoryChart(this.reportData.chartData);
        }
        if (this.reportData?.dailySales.length) {
          this.renderDailyChart(this.reportData.dailySales);
        }
        // --- LLAMADAS A LOS NUEVOS GRÁFICOS ---
        if (this.reportPeaks?.peakHours.length) {
          this.renderPeakHoursChart(this.reportPeaks.peakHours); // <-- NUEVA
        }
        if (this.reportPeaks?.peakDays.length) {
          this.renderPeakDaysChart(this.reportPeaks.peakDays);   // <-- NUEVA
        }
      }, 0);

    } catch (error) {
      console.error('Error al generar el reporte:', error);
      this.presentToast('No se pudo generar el reporte.', 'danger');
    } finally {
      this.isLoading = false;
      loading.dismiss();
    }
  }

  async generateDailyReport(): Promise<void> {
    this.isDailyLoading = true;
    this.dailyReportData = null;

    const loading = await this.loadingCtrl.create({
      message: 'Consultando comandas...',
    });
    await loading.present();

    try {
      this.dailyReportData = await firstValueFrom(
        this._reportsService.generateDailyOrdersReport(this.dailyDate),
      );
      this.dailyPaidExpanded = true;
      this.dailyCancelledExpanded = false;

      if (
        !this.dailyReportData.paidOrders.length &&
        !this.dailyReportData.cancelledOrders.length
      ) {
        this.presentToast(
          'No se encontraron comandas en este dia operativo.',
          'warning',
        );
      }
    } catch (error) {
      console.error('Error al generar el reporte diario:', error);
      this.presentToast('No se pudo generar el reporte diario.', 'danger');
    } finally {
      this.isDailyLoading = false;
      await loading.dismiss();
    }
  }

  selectTab(tab: 'summary' | 'daily'): void {
    this.activeTab = tab;
  }

  toggleDailyPaid(): void {
    this.dailyPaidExpanded = !this.dailyPaidExpanded;
  }

  toggleDailyCancelled(): void {
    this.dailyCancelledExpanded = !this.dailyCancelledExpanded;
  }

  downloadReceipt(orderId: number): void {
    this.orderService.downloadReceipt(orderId).subscribe({
      error: () =>
        this.presentToast('No se pudo descargar el recibo.', 'danger'),
    });
  }

  trackByOrder(_: number, order: Order): number | undefined {
    return order.id;
  }

  exportDailyOrdersExcel(): void {
    if (!this.dailyReportData) {
      this.presentToast('Consulta primero un dia operativo.', 'warning');
      return;
    }

    const orders = [
      ...this.dailyReportData.paidOrders,
      ...this.dailyReportData.cancelledOrders,
    ];

    if (!orders.length) {
      this.presentToast('No hay comandas para exportar.', 'warning');
      return;
    }

    const rows = orders.map((order) => {
      const isCancelled = order.status === 'cancelled';
      const dateValue = isCancelled ? order.cancelledAt : order.paidAt;

      return {
        Estado: isCancelled ? 'Cancelada' : 'Pagada',
        Comanda: order.orderNumber || order.id || '',
        Mesero: order.waiter?.fullName || 'Sin asignar',
        Tipo: order.table ? 'Mesa' : 'Para llevar',
        Mesa: order.table
          ? order.table.tableNumber || order.table.name || order.tableId || ''
          : '',
        Orden: this.getVisualOrderNumber(order),
        'Fecha y hora': this.formatBogotaDateTime(dateValue),
        Total: Number(order.totalAmount || 0),
        'Metodo de pago': this.getPaymentMethodsLabel(order),
        Recargos: this.getAdjustmentTotal(order, 'charge'),
        Descuentos: this.getAdjustmentTotal(order, 'discount'),
        Devoluciones: this.getRefundTotal(order),
        Items: (order.orderItems || [])
          .map(
            (item) =>
              `${item.quantity}x ${item.product?.name || item.name || 'Producto'}`,
          )
          .join(' + '),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 22 },
      { wch: 14 },
      { wch: 30 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 50 },
    ];
    worksheet['!autofilter'] = {
      ref: worksheet['!ref'] || 'A1:M1',
    };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comandas');
    XLSX.writeFile(
      workbook,
      `comandas_${this.dailyReportData.businessDate}.xlsx`,
    );
  }

  /**
   * 8. RENDERIZAR GRÁFICO DE CATEGORÍAS (BARRAS)
   */
  renderCategoryChart(data: any[]) {
    const canvas = document.getElementById('categoryChart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const labels = data.map(d => d.label);
    const totals = data.map(d => d.total);

    this.categoryChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ventas por Categoría',
          data: totals,
          backgroundColor: ['#3880ff', '#3dc2ff', '#5260ff', '#2dd36f', '#ffc409'],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  /**
    * 9. RENDERIZAR GRÁFICO DIARIO (LÍNEA) - VERSIÓN MEJORADA
    */
  renderDailyChart(data: any[]) {
    const canvas = document.getElementById('dailyChart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // Salir si el contexto no está disponible

    // --- 1. MEJORA: Crear un gradiente para el fondo ---
    const gradient = ctx.createLinearGradient(0, 0, 0, 300); // Gradiente vertical
    gradient.addColorStop(0, 'rgba(56, 128, 255, 0.4)'); // Azul más fuerte arriba
    gradient.addColorStop(1, 'rgba(56, 128, 255, 0.05)'); // Casi transparente abajo

    // --- (Tu código de labels corregido está perfecto) ---
    const labels = data.map(d => {
      // CORRECCIÓN: 'd.day' ya es una fecha ISO completa.
      const [year, month, day] = String(d.day)
        .slice(0, 10)
        .split('-')
        .map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    });
    const totals = data.map(d => d.total);

    this.dailyChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ventas Diarias',
          data: totals,

          // --- 2. MEJORA: Estilo de línea y puntos ---
          borderColor: 'rgba(56, 128, 255, 1)',
          backgroundColor: gradient, // <-- Usar el gradiente
          fill: true,
          tension: 0.4, // <-- Línea más suave (curva)
          pointBackgroundColor: 'rgba(56, 128, 255, 1)', // <-- Puntos más visibles
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },

          // --- 3. MEJORA: Formatear el Tooltip (al tocar) ---
          tooltip: {
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  // Formato de moneda para el tooltip
                  label += new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    maximumFractionDigits: 0
                  }).format(context.parsed.y);
                }
                return label;
              }
            }
          }
        },

        // --- 4. MEJORA: Formatear el Eje Y ---
        scales: {
          y: {
            ticks: {
              callback: function (value, index, ticks) {
                // Formato de moneda compacto (ej. $680K)
                return new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  maximumFractionDigits: 0 // Mantenemos esto para quitar centavos
                } as any).format(Number(value));
              }
            }
          }
        }
      }
    });
  }

  /**
   * Lógica para exportar los datos de la tabla a un archivo PDF.
   */
  exportPDF() {
    if (!this.reportData || !this.reportData.tableRows.length) {
      this.presentToast('No hay datos para exportar.', 'warning');
      return;
    }
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(18);
    doc.text('Reporte de Ventas', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    const startStr = this.formatReportDate(this.startDate);
    const endStr = this.formatReportDate(this.endDate);
    doc.text(`Rango de fechas: ${startStr} al ${endStr}`, 14, 29);

    const catChartCanvas = document.getElementById('categoryChart') as HTMLCanvasElement;
    const dailyChartCanvas = document.getElementById('dailyChart') as HTMLCanvasElement;

    if (catChartCanvas) {
      const catChartImg = catChartCanvas.toDataURL('image/png');
      doc.setFontSize(12);
      doc.text('Ventas por Categoría', 14, 45);
      doc.addImage(catChartImg, 'PNG', 14, 50, 180, 80);
    }

    if (dailyChartCanvas) {
      const dailyChartImg = dailyChartCanvas.toDataURL('image/png');
      doc.text('Ventas por Día', 14, 140);
      doc.addImage(dailyChartImg, 'PNG', 14, 145, 180, 80);
    }

    doc.addPage();
    doc.text('Detalle de Productos Vendidos', 14, 22);
    const head = [['Producto', 'Categoría', 'Cantidad', 'Total']];
    const body = this.reportData.tableRows.map((row: any) => [
      row.productName,
      row.category,
      row.quantity,
      `$${row.total.toLocaleString('es-CO')}`
    ]);

    (doc as any).autoTable({
      head: head,
      body: body,
      startY: 30,
      theme: 'grid',
      headStyles: {
        fillColor: [56, 128, 255]
      }
    });

    doc.save(`reporte_detallado_${this.getBogotaDate()}.pdf`);
    // 10. QUITA EL TOAST DE "NO IMPLEMENTADO"
  }

  /**
   * Lógica para exportar los datos de la tabla a un archivo Excel.
   */
  exportExcel() {
    if (!this.reportData || !this.reportData.tableRows.length) {
      this.presentToast('No hay datos para exportar.', 'warning');
      return;
    }
    const dataToExport = this.reportData.tableRows.map((row: any) => ({
      'Producto': row.productName,
      'Categoría': row.category,
      'Cantidad': row.quantity,
      'Total': row.total
    }));
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    ws['!cols'] = [
      { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 15 }
    ];
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Ventas');
    XLSX.writeFile(wb, `reporte_ventas_${this.getBogotaDate()}.xlsx`);
    // 11. QUITA EL TOAST DE "NO IMPLEMENTADO"
  }

  /**
   * Muestra un mensaje temporal (toast).
   */
  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2500,
      position: 'bottom',
      color: color,
    });
    toast.present();
  }

  /**
   * Se ejecuta cuando cambia la fecha de inicio
   */
  onStartDateChange(event: any) {
    this.startDate = event.detail.value;
    this.modalStart.dismiss();
  }

  /**
   * Se ejecuta cuando cambia la fecha de fin
   */
  onEndDateChange(event: any) {
    this.endDate = event.detail.value;
    this.modalEnd.dismiss();
  }

  onDailyDateChange(event: any): void {
    this.dailyDate = event.detail.value;
    this.modalDaily.dismiss();
  }

  toggleProducts(): void {
    this.productsExpanded = !this.productsExpanded;
  }

  togglePaymentReconciliation(): void {
    this.paymentReconciliationExpanded = !this.paymentReconciliationExpanded;
  }

  /**
   * Prepara los datos para el gráfico de horas, rellenando las horas vacías
   * para que el gráfico muestre un rango completo de 0 a 23h.
   */
  private prepareHourData(apiData: any[]) {
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const counts = Array(24).fill(0);

    apiData.forEach(item => {
      const hour = item.hour;
      if (hour >= 0 && hour < 24) {
        counts[hour] = item.orderCount;
      }
    });
    return { labels, counts };
  }

  /**
   * Renderiza el gráfico de LÍNEA para las horas pico.
   */
  renderPeakHoursChart(data: any[]) {
    const canvas = document.getElementById('peakHoursChart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { labels, counts } = this.prepareHourData(data);

    this.hoursChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'N° de Pedidos',
          data: counts,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  /**
   * Renderiza el gráfico de BARRAS para los días pico.
   */
  renderPeakDaysChart(data: any[]) {
    const canvas = document.getElementById('peakDaysChart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const labels = data.map(d => this.translateDayName(d.dayName));
    const counts = data.map(d => d.orderCount);

    this.daysChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'N° de Pedidos',
          data: counts,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  // Pequeña utilidad para traducir los nombres de los días
  private translateDayName(dayName: string): string {
    const map: { [key: string]: string } = {
      'Sunday': 'Domingo', 'Monday': 'Lunes', 'Tuesday': 'Martes',
      'Wednesday': 'Miércoles', 'Thursday': 'Jueves',
      'Friday': 'Viernes', 'Saturday': 'Sábado'
    };
    return map[dayName] || dayName;
  }

  formatBogotaDateTime(value?: string | null): string {
    if (!value) {
      return 'En curso';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Sin fecha';
    }

    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  private getBogotaDate(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = parts.reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

    return `${values['year']}-${values['month']}-${values['day']}`;
  }

  private getBogotaBusinessDate(cutoffHour: number): string {
    const cutoff = Number.isInteger(cutoffHour) && cutoffHour >= 0 && cutoffHour <= 23
      ? cutoffHour
      : 4;
    const shiftedNow = new Date(Date.now() - cutoff * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(shiftedNow);
    const values = parts.reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

    return `${values['year']}-${values['month']}-${values['day']}`;
  }

  private setDefaultDateRange(referenceDate: string): void {
    this.endDate = referenceDate;
    this.maxDate = referenceDate;
    this.startDate = `${referenceDate.slice(0, 8)}01`;
    this.dailyDate = referenceDate;
  }

  private getVisualOrderNumber(order: Order): string {
    if (order.companyId && order.companyOrderNumber) {
      return `${order.companyId}${String(order.companyOrderNumber).padStart(7, '0')}`;
    }

    return String(order.id || order.orderNumber || '');
  }

  private getPaymentMethodsLabel(order: Order): string {
    const grouped = (order.payments || [])
      .filter((payment) => Number(payment.amount || 0) > 0)
      .reduce<Map<string, number>>((result, payment) => {
        const name =
          payment.paymentMethod?.name?.trim() || 'Metodo no especificado';
        result.set(
          name,
          (result.get(name) || 0) + Number(payment.amount || 0),
        );
        return result;
      }, new Map<string, number>());

    return Array.from(grouped.entries())
      .map(
        ([name, amount]) =>
          `${name}: ${new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0,
          }).format(amount)}`,
      )
      .join(' + ');
  }

  private getAdjustmentTotal(
    order: Order,
    type: 'charge' | 'discount',
  ): number {
    const adjustments =
      ((order.paymentSummary as any)?.adjustments as Order['adjustments']) ||
      order.adjustments ||
      [];

    return adjustments
      .filter((adjustment) => adjustment.type === type)
      .reduce(
        (total, adjustment) => total + Number(adjustment.amount || 0),
        0,
      );
  }

  private getRefundTotal(order: Order): number {
    return (order.payments || [])
      .filter((payment) => Number(payment.amount || 0) < 0)
      .reduce(
        (total, payment) => total + Math.abs(Number(payment.amount || 0)),
        0,
      );
  }

  private formatReportDate(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);

    return new Date(year, month - 1, day).toLocaleDateString('es-CO');
  }
}
