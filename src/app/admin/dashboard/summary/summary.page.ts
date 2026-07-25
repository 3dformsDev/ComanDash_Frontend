import { Component, OnDestroy, OnInit } from '@angular/core';
import { AppState } from '@capacitor/app';
import { Store } from '@ngrx/store';
import {
  CashRegisterSessionService,
  DailySummaryI,
} from '@services/cash-register-session.service';
import { OrderService } from '@services/order.service';
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
