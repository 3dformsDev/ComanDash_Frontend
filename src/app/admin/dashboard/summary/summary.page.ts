import { Component, OnDestroy, OnInit } from '@angular/core';
import { AppState } from '@capacitor/app';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  CashRegisterSessionService,
  DailySummaryI,
} from '@services/cash-register-session.service';
import { OrderService } from '@services/order.service';
import {
  ProductOptionSalesBreakdown,
  ProductOptionSalesGroup,
} from '@services/reports.service';
import { SocketService } from '@services/socket.service';
import { ToastService } from '@services/toast.service';
import {
  selectCurrentCompanyId,
  selectLocationId,
} from '@store/auth/selectors/auth.selectors';
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  Subscription,
} from 'rxjs';

@Component({
  selector: 'app-summary',
  templateUrl: './summary.page.html',
  styleUrls: ['./summary.page.scss'],
  standalone: false,
})
export class SummaryPage implements OnInit, OnDestroy {
  public summaryDate = '';
  public isLoading = false;
  public topProductsExpanded = false;
  public expandedTopProductIds = new Set<number>();
  public topProductOptionGroups = new Map<number, ProductOptionSalesGroup[]>();
  private readonly emptyOptionGroups: ProductOptionSalesGroup[] = [];

  summaryData: DailySummaryI = {
    totalOrders: 0,
    totalRevenue: 0,
    tableOrders: 0,
    takeawayOrders: 0,
    ordersInProcess: 0,
    ordersFinished: 0,
    ordersCancelled: 0,
    topProducts: [],
    cuts: [],
    paidOrders: [],
    cancelledOrders: [],
  };

  private summaryRequest?: Subscription;
  private realtimeContext = new Subscription();
  private realtimeEvents = new Subscription();
  private refreshTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private cashRegisterSessionService: CashRegisterSessionService,
    private orderService: OrderService,
    private socketService: SocketService,
    private toastService: ToastService,
    private store: Store<AppState>,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.setFormattedDate();
  }

  ionViewWillEnter(): void {
    this.setFormattedDate();
    this.loadDailySummary();
    this.startRealtimeRefresh();
  }

  ionViewWillLeave(): void {
    this.stopRealtimeRefresh();
  }

  ngOnDestroy(): void {
    this.summaryRequest?.unsubscribe();
    this.stopRealtimeRefresh();
  }

  loadDailySummary(event?: any): void {
    this.isLoading = true;
    this.summaryRequest?.unsubscribe();

    this.summaryRequest = this.cashRegisterSessionService
      .getDailySessionSummary()
      .subscribe({
        next: (data) => {
          this.summaryData = data;
          this.buildTopProductOptionGroups(data.topProducts);
          this.setFormattedDate(data.businessDate);
          this.isLoading = false;
          event?.target?.complete?.();
        },
        error: (error) => {
          this.isLoading = false;
          event?.target?.complete?.();
          console.error('Error al cargar el resumen diario:', error);
          this.toastService.presentToast(
            'No se pudo actualizar el resumen del dia.',
            'danger',
          );
        },
      });
  }

  downloadReceipt(orderId: number): void {
    this.orderService.downloadReceipt(orderId).subscribe({
      error: () =>
        this.toastService.presentToast(
          'No se pudo descargar el recibo.',
          'danger',
        ),
    });
  }

  trackByOrder(_: number, order: any): number {
    return order.id;
  }

  toggleTopProducts(): void {
    this.topProductsExpanded = !this.topProductsExpanded;
  }

  toggleTopProduct(productId: number): void {
    const expanded = new Set(this.expandedTopProductIds);
    expanded.has(productId) ? expanded.delete(productId) : expanded.add(productId);
    this.expandedTopProductIds = expanded;
  }

  topProductIsExpanded(productId: number): boolean {
    return this.expandedTopProductIds.has(productId);
  }

  getTopProductOptionGroups(productId: number): ProductOptionSalesGroup[] {
    return this.topProductOptionGroups.get(productId) || this.emptyOptionGroups;
  }

  private buildTopProductOptionGroups(products: DailySummaryI['topProducts']): void {
    const groupedByProduct = new Map<number, ProductOptionSalesGroup[]>();

    products.forEach((product) => {
      const optionsByGroup = new Map<string, ProductOptionSalesBreakdown[]>();
      product.optionBreakdown.forEach((option) => {
        const groupName = option.groupName || 'Otras opciones';
        const groupOptions = optionsByGroup.get(groupName) || [];
        groupOptions.push(option);
        optionsByGroup.set(groupName, groupOptions);
      });

      groupedByProduct.set(
        product.id,
        Array.from(optionsByGroup.entries()).map(([groupName, options]) => ({
          groupName,
          options,
          total: options.reduce((sum, option) => sum + Number(option.total || 0), 0),
        })),
      );
    });

    this.topProductOptionGroups = groupedByProduct;
  }

  goToCashManagement(): void {
    this.router.navigate(['/dashboard/administration/cash-box-management']);
  }

  goToPreviousBusinessDayReport(): void {
    const businessDate = this.summaryData.cashRegisterState?.sessionBusinessDate;
    if (!businessDate) return;

    this.router.navigate(['/dashboard/administration/reports'], {
      queryParams: { businessDate, tab: 'daily' },
    });
  }

  formatBusinessDate(value: string | null): string {
    if (!value) return '';

    return new Date(`${value}T12:00:00-05:00`).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Bogota',
    });
  }

  private setFormattedDate(businessDate?: string): void {
    const date = businessDate
      ? new Date(`${businessDate}T12:00:00-05:00`)
      : new Date();

    this.summaryDate = date.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private startRealtimeRefresh(): void {
    this.stopRealtimeRefresh();

    this.realtimeContext = combineLatest([
      this.store.select(selectCurrentCompanyId),
      this.store.select(selectLocationId),
      this.socketService.isConnected$,
    ])
      .pipe(
        filter(
          ([companyId, locationId, connected]) =>
            Number(companyId) > 0 && Number(locationId) > 0 && connected,
        ),
        distinctUntilChanged(
          (previous, current) =>
            Number(previous[0]) === Number(current[0]) &&
            Number(previous[1]) === Number(current[1]) &&
            previous[2] === current[2],
        ),
      )
      .subscribe(([companyId, locationId]) => {
        this.socketService.emit('join_kitchen_room', {
          companyId: Number(companyId),
          locationId: Number(locationId),
        });
        this.attachRealtimeEvents();
      });
  }

  private attachRealtimeEvents(): void {
    this.realtimeEvents.unsubscribe();
    this.realtimeEvents = new Subscription();

    [
      'order_payment_completed',
      'order_is_cancelled',
      'order_updated',
      'cash_register_recovery_changed',
    ].forEach((eventName) => {
      this.realtimeEvents.add(
        this.socketService
          .listen(eventName)
          .subscribe(() => this.scheduleSummaryRefresh()),
      );
    });
  }

  private scheduleSummaryRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => this.loadDailySummary(), 250);
  }

  private stopRealtimeRefresh(): void {
    this.realtimeContext.unsubscribe();
    this.realtimeContext = new Subscription();

    this.realtimeEvents.unsubscribe();
    this.realtimeEvents = new Subscription();

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }
}
