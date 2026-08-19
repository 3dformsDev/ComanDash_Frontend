import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import {
  CashRegisterOperatingStateI,
  CashRegisterSessionService,
} from '@services/cash-register-session.service';
import { CashSessionAlertCoordinatorService } from '@services/cash-session-alert-coordinator.service';
import { SocketService } from '@services/socket.service';
import { ToastService } from '@services/toast.service';
import {
  selectCashSessionAlertContext,
} from '@store/auth/selectors/auth.selectors';
import { combineLatest, firstValueFrom, Subscription } from 'rxjs';

@Component({
  selector: 'app-cash-session-alert',
  templateUrl: './cash-session-alert.component.html',
  styleUrls: ['./cash-session-alert.component.scss'],
  standalone: false,
})
export class CashSessionAlertComponent implements OnInit, OnDestroy {
  state: CashRegisterOperatingStateI | null = null;
  canAuthorize = false;
  canManageCash = false;
  isBusy = false;
  isMinimized = false;

  private locationId: number | null = null;
  private previousSessionId: number | null = null;
  private contextSubscription = new Subscription();
  private realtimeSubscription = new Subscription();
  private expandRequestSubscription = new Subscription();
  private pollingTimer?: ReturnType<typeof setInterval>;
  private readonly store = inject(Store);
  private readonly sessionsService = inject(CashRegisterSessionService);
  private readonly alertCoordinator = inject(CashSessionAlertCoordinatorService);
  private readonly socketService = inject(SocketService);
  private readonly alertController = inject(AlertController);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.expandRequestSubscription = this.alertCoordinator.expandRequests$
      .subscribe(state => {
        if (!this.locationId) return;

        this.isMinimized = false;
        if (state) {
          this.applyOperatingState(state, true);
          return;
        }

        this.refresh();
      });

    this.contextSubscription = combineLatest([
      this.store.select(selectCashSessionAlertContext),
      this.socketService.isConnected$,
    ]).subscribe(([context, socketConnected]) => {
      const { isAuthenticated, locationId, user } = context;
      this.locationId = Number(locationId) || null;
      this.canAuthorize = ['super_admin', 'admin', 'manager'].includes(
        user?.role?.code || '',
      );
      this.canManageCash = ['super_admin', 'admin', 'manager', 'cashier'].includes(
        user?.role?.code || '',
      );

      if (!isAuthenticated || !this.locationId) {
        this.stopPolling();
        this.realtimeSubscription.unsubscribe();
        this.realtimeSubscription = new Subscription();
        this.state = null;
        this.previousSessionId = null;
        this.isMinimized = false;
        return;
      }

      // loginSuccess actualiza NgRx antes de que el token termine de persistirse.
      // El socket solo se conecta después de guardar el token, por lo que actúa
      // como señal de que ya es seguro realizar solicitudes autenticadas.
      if (!socketConnected) {
        this.stopPolling();
        this.realtimeSubscription.unsubscribe();
        this.realtimeSubscription = new Subscription();
        return;
      }

      this.refresh();
      this.startPolling();

      this.socketService.emit('join_kitchen_room', {
        companyId: user?.company?.id,
        locationId: this.locationId,
      });
      this.attachRealtimeListener();
    });
  }

  ngOnDestroy(): void {
    this.contextSubscription.unsubscribe();
    this.realtimeSubscription.unsubscribe();
    this.expandRequestSubscription.unsubscribe();
    this.stopPolling();
  }

  refresh(): void {
    if (!this.locationId) return;

    this.sessionsService.getOperatingState().subscribe({
      next: state => this.applyOperatingState(state),
      error: error => console.error('No se pudo consultar el estado de caja:', error),
    });
  }

  minimize(): void {
    if (this.state?.status === 'open_previous') {
      this.isMinimized = true;
    }
  }

  expand(): void {
    this.isMinimized = false;
  }

  async authorizeRecovery(): Promise<void> {
    if (!this.state?.sessionId || !this.canAuthorize || this.isBusy) return;

    let reason = '';
    const businessDate = this.formatBusinessDate(
      this.state.sessionBusinessDate,
    );
    const alert = await this.alertController.create({
      header: this.state.recoveryIsActive
        ? 'Renovar modo recuperación'
        : 'Autorizar modo recuperación',
      message: this.state.recoveryIsActive
        ? `Las operaciones seguirán registrándose en el día operativo ${businessDate}. ` +
          'Al renovar, la autorización estará activa durante 60 minutos desde este momento.'
        : `Las operaciones realizadas durante este periodo se registrarán en el día operativo ${businessDate}. ` +
          'La autorización estará activa durante 60 minutos y finalizará automáticamente.',
      cssClass: 'confirmation-action-alert',
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Motivo de la recuperación (mínimo 10 caracteres)',
          attributes: { maxlength: 500 },
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-secondary-action',
        },
        {
          text: this.state.recoveryIsActive ? 'Renovar' : 'Autorizar',
          role: 'confirm',
          cssClass: 'alert-primary-action',
          handler: values => {
            reason = String(values.reason || '').trim();
            if (reason.length < 10) {
              this.toastService.presentToast(
                'Escribe un motivo de al menos 10 caracteres.',
                'danger',
              );
              return false;
            }
            return true;
          },
        },
      ],
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    this.isBusy = true;
    try {
      const state = await firstValueFrom(
        this.sessionsService.authorizeRecovery(this.state.sessionId, reason),
      );
      this.applyOperatingState(state);
      this.toastService.presentToast(
        'Modo recuperación habilitado durante 60 minutos.',
        'success',
      );
    } catch (error: any) {
      this.toastService.presentToast(
        error.error?.message || 'No se pudo autorizar la recuperación.',
        'danger',
      );
      this.refresh();
    } finally {
      this.isBusy = false;
    }
  }

  async endRecovery(): Promise<void> {
    if (!this.state?.sessionId || !this.canAuthorize || this.isBusy) return;

    const alert = await this.alertController.create({
      header: 'Finalizar modo recuperación',
      message: 'Las nuevas transacciones volverán a quedar bloqueadas.',
      cssClass: 'confirmation-action-alert',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-secondary-action',
        },
        {
          text: 'Finalizar',
          role: 'confirm',
          cssClass: 'alert-primary-action',
        },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    this.isBusy = true;
    try {
      const state = await firstValueFrom(
        this.sessionsService.endRecovery(this.state.sessionId),
      );
      this.applyOperatingState(state);
      this.toastService.presentToast('Modo recuperación finalizado.', 'success');
    } catch (error: any) {
      this.toastService.presentToast(
        error.error?.message || 'No se pudo finalizar la recuperación.',
        'danger',
      );
      this.refresh();
    } finally {
      this.isBusy = false;
    }
  }

  goToCashManagement(): void {
    this.router.navigate(['/dashboard/administration/cash-box-management']);
  }

  goToPreviousReport(): void {
    if (!this.state?.sessionBusinessDate) return;
    this.router.navigate(['/dashboard/administration/reports'], {
      queryParams: {
        businessDate: this.state.sessionBusinessDate,
        tab: 'daily',
      },
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

  formatRecoveryTime(value: string | null): string {
    if (!value) return '';

    return new Date(value).toLocaleTimeString('es-CO', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Bogota',
    });
  }

  private startPolling(): void {
    if (this.pollingTimer) return;
    this.pollingTimer = setInterval(() => this.refresh(), 30_000);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  private attachRealtimeListener(): void {
    this.realtimeSubscription.unsubscribe();
    this.realtimeSubscription = this.socketService
      .listen('cash_register_recovery_changed')
      .subscribe((state: CashRegisterOperatingStateI) => {
        this.applyOperatingState(state);
      });
  }

  private applyOperatingState(
    state: CashRegisterOperatingStateI,
    forceExpansion = false,
  ): void {
    const recoveryChanged = Boolean(
      this.state?.status === 'open_previous' &&
      state.status === 'open_previous' &&
      this.state.recoveryIsActive !== state.recoveryIsActive,
    );
    const isNewPreviousSession = Boolean(
      state.status === 'open_previous' &&
      state.sessionId !== this.previousSessionId,
    );

    this.state = state;

    if (state.status !== 'open_previous') {
      this.previousSessionId = null;
      this.isMinimized = false;
      return;
    }

    this.previousSessionId = state.sessionId;
    if (forceExpansion || recoveryChanged || isNewPreviousSession) {
      this.isMinimized = false;
    }
  }
}
