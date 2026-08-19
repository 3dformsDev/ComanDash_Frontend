import { inject, Injectable, NgZone } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { firstValueFrom, fromEvent, interval, merge, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import * as AuthActions from '@store/auth/actions/auth.actions';
import { AuthService } from '@services/auth.service';
import { SocketService } from '@services/socket.service';

interface SessionMonitoringOptions {
  resetActivity?: boolean;
  refreshToken?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SessionActivityService {
  private readonly ngZone = inject(NgZone);
  private readonly store = inject(Store);
  private readonly alertController = inject(AlertController);
  private readonly authService = inject(AuthService);
  private readonly socketService = inject(SocketService);

  private readonly SESSION_TIMEOUT_MS = 6 * 60 * 60 * 1000;
  private readonly WARNING_LEAD_MS = 10 * 60 * 1000;
  private readonly WARNING_TIMEOUT_MS =
    this.SESSION_TIMEOUT_MS - this.WARNING_LEAD_MS;
  private readonly TOKEN_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
  private readonly TOKEN_REFRESH_RETRY_MS = 5 * 60 * 1000;
  private readonly CHECK_INTERVAL_MS = 60 * 1000;
  private readonly LAST_ACTIVITY_KEY = 'last_activity';
  private readonly LAST_TOKEN_REFRESH_KEY = 'last_token_refresh';

  private activitySubscription?: Subscription;
  private checkSubscription?: Subscription;
  private visibilitySubscription?: Subscription;

  private warningShown = false;
  private warningAlertPresented = false;
  private warningAlert: HTMLIonAlertElement | null = null;
  private tokenRefreshInProgress = false;
  private lastTokenRefreshAttemptAt = 0;
  private logoutInProgress = false;

  startMonitoring(options: SessionMonitoringOptions = {}): boolean {
    this.unsubscribeMonitoring();
    this.logoutInProgress = false;

    if (options.resetActivity) {
      this.clearWarningState();
      this.updateLastActivity();
      this.markTokenRefreshed();
    } else if (!this.validateExistingSession()) {
      return false;
    }

    if (!this.getLastActivity()) {
      this.updateLastActivity();
    }

    this.ngZone.runOutsideAngular(() => {
      const activityEvents$ = merge(
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'click'),
        fromEvent(document, 'keydown'),
        fromEvent(document, 'scroll'),
        fromEvent(document, 'touchstart'),
      ).pipe(throttleTime(30000));

      this.activitySubscription = activityEvents$.subscribe(() => {
        this.registerActivity();
      });

      this.visibilitySubscription = fromEvent(
        document,
        'visibilitychange',
      ).subscribe(() => {
        if (document.visibilityState === 'visible') {
          this.handleApplicationResume();
        }
      });

      this.checkSubscription = interval(this.CHECK_INTERVAL_MS).subscribe(() => {
        this.checkSessionTimeout();
      });
    });

    this.checkSessionTimeout();

    if (options.refreshToken) {
      void this.refreshTokenIfNeeded(true);
    }

    return true;
  }

  stopMonitoring(): void {
    this.unsubscribeMonitoring();
    this.resetSessionState();
  }

  resetSessionState(): void {
    this.logoutInProgress = false;
    this.tokenRefreshInProgress = false;
    this.lastTokenRefreshAttemptAt = 0;
    this.clearWarningState();
    localStorage.removeItem(this.LAST_ACTIVITY_KEY);
    localStorage.removeItem(this.LAST_TOKEN_REFRESH_KEY);
  }

  private unsubscribeMonitoring(): void {
    this.activitySubscription?.unsubscribe();
    this.checkSubscription?.unsubscribe();
    this.visibilitySubscription?.unsubscribe();
    this.activitySubscription = undefined;
    this.checkSubscription = undefined;
    this.visibilitySubscription = undefined;
  }

  private registerActivity(): void {
    if (this.warningAlertPresented || this.logoutInProgress) {
      return;
    }

    if (this.hasSessionExpired()) {
      this.expireSession('Sesión cerrada por inactividad.');
      return;
    }

    this.updateLastActivity();
    void this.refreshTokenIfNeeded();
  }

  private handleApplicationResume(): void {
    if (this.hasSessionExpired()) {
      this.expireSession('Sesión expirada al volver a la aplicación.');
      return;
    }

    this.checkSessionTimeout();
    void this.refreshTokenIfNeeded();
  }

  private updateLastActivity(): void {
    localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
  }

  private getLastActivity(): number | null {
    const storedValue = localStorage.getItem(this.LAST_ACTIVITY_KEY);
    const timestamp = Number(storedValue);

    return storedValue && Number.isFinite(timestamp) && timestamp > 0
      ? timestamp
      : null;
  }

  private getInactiveTime(): number | null {
    const lastActivity = this.getLastActivity();
    return lastActivity ? Math.max(0, Date.now() - lastActivity) : null;
  }

  private hasSessionExpired(): boolean {
    const inactiveTime = this.getInactiveTime();
    return inactiveTime !== null && inactiveTime >= this.SESSION_TIMEOUT_MS;
  }

  private checkSessionTimeout(): void {
    const inactiveTime = this.getInactiveTime();

    if (inactiveTime === null || this.logoutInProgress) {
      return;
    }

    if (inactiveTime >= this.SESSION_TIMEOUT_MS) {
      this.expireSession('Sesión cerrada por inactividad.');
      return;
    }

    if (
      inactiveTime >= this.WARNING_TIMEOUT_MS &&
      !this.warningShown &&
      !this.warningAlertPresented
    ) {
      this.warningShown = true;

      this.ngZone.run(() => {
        void this.presentSessionWarning();
      });
    }
  }

  private validateExistingSession(): boolean {
    if (!this.hasSessionExpired()) {
      return true;
    }

    this.expireSession('Sesión expirada al iniciar la aplicación.');
    return false;
  }

  private async presentSessionWarning(): Promise<void> {
    if (this.warningAlertPresented || this.logoutInProgress) {
      return;
    }

    if (this.hasSessionExpired()) {
      this.expireSession('Sesión cerrada por inactividad.');
      return;
    }

    this.warningAlertPresented = true;

    this.warningAlert = await this.alertController.create({
      header: 'Sesión próxima a expirar',
      message:
        'Tu sesión se cerrará en 10 minutos por inactividad. ¿Deseas continuar?',
      backdropDismiss: false,
      cssClass: ['confirmation-action-alert', 'session-timeout-alert'],
      buttons: [
        {
          text: 'Cerrar sesión',
          role: 'destructive',
          cssClass: 'alert-secondary-action',
          handler: () => {
            this.logoutInProgress = true;
            this.warningAlertPresented = false;
            this.warningAlert = null;
            this.store.dispatch(AuthActions.logout());
            return true;
          },
        },
        {
          text: 'Continuar',
          role: 'confirm',
          cssClass: 'alert-primary-action',
          handler: () => {
            this.updateLastActivity();
            this.warningShown = false;
            this.warningAlertPresented = false;
            this.warningAlert = null;
            void this.refreshTokenIfNeeded(true);
            return true;
          },
        },
      ],
    });

    await this.warningAlert.present();

    this.warningAlert.onDidDismiss().then(() => {
      this.warningAlertPresented = false;
      this.warningAlert = null;
    });
  }

  private expireSession(message: string): void {
    if (this.logoutInProgress) {
      return;
    }

    this.logoutInProgress = true;
    console.warn(message);

    this.ngZone.run(() => {
      void this.dismissWarning().finally(() => {
        this.store.dispatch(AuthActions.logout());
      });
    });
  }

  private clearWarningState(): void {
    this.warningShown = false;
    this.warningAlertPresented = false;
    void this.dismissWarning();
  }

  private async dismissWarning(): Promise<void> {
    const alert = this.warningAlert;
    this.warningAlert = null;

    if (alert) {
      try {
        await alert.dismiss();
      } catch (error) {
        console.warn('No fue posible cerrar la alerta de sesión:', error);
      }
    }
  }

  private markTokenRefreshed(): void {
    localStorage.setItem(this.LAST_TOKEN_REFRESH_KEY, Date.now().toString());
  }

  private async refreshTokenIfNeeded(force = false): Promise<void> {
    if (this.tokenRefreshInProgress || this.logoutInProgress) {
      return;
    }

    const now = Date.now();
    const lastRefresh = Number(
      localStorage.getItem(this.LAST_TOKEN_REFRESH_KEY),
    );
    const refreshIsDue =
      !Number.isFinite(lastRefresh) ||
      lastRefresh <= 0 ||
      now - lastRefresh >= this.TOKEN_REFRESH_INTERVAL_MS;

    if (!force && !refreshIsDue) {
      return;
    }

    if (
      !force &&
      now - this.lastTokenRefreshAttemptAt < this.TOKEN_REFRESH_RETRY_MS
    ) {
      return;
    }

    this.tokenRefreshInProgress = true;
    this.lastTokenRefreshAttemptAt = now;

    try {
      const newToken = await firstValueFrom(this.authService.refreshToken());
      this.markTokenRefreshed();
      this.socketService.renewToken(newToken);
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401) {
        this.expireSession('La sesión ya no es válida.');
      } else {
        console.warn('No fue posible renovar la sesión en este momento.', error);
      }
    } finally {
      this.tokenRefreshInProgress = false;
    }
  }
}
