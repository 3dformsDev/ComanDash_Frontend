import { Injectable, NgZone } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { fromEvent, merge, Subscription, interval } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import * as AuthActions from '@store/auth/actions/auth.actions';

@Injectable({
  providedIn: 'root',
})
export class SessionActivityService {
  // Configuración de tiempos en milisegundos
  private readonly SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000;

  private readonly WARNING_TIMEOUT_MS = 10 * 60 * 1000;

  private activitySubscription?: Subscription;
  private checkSubscription?: Subscription;

  private warningShown = false;
  private warningAlertPresented = false;
  private warningAlert: HTMLIonAlertElement | null = null;

  constructor(
    private ngZone: NgZone,
    private store: Store,
    private alertController: AlertController,
  ) {}

  startMonitoring(): void {
    this.validateExistingSession();

    this.updateLastActivity();

    this.ngZone.runOutsideAngular(() => {
      const activityEvents$ = merge(
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'click'),
        fromEvent(document, 'keydown'),
        fromEvent(document, 'scroll'),
        fromEvent(document, 'touchstart'),
      ).pipe(throttleTime(30000));

      this.activitySubscription = activityEvents$.subscribe(() => {
        this.updateLastActivity();
      });

      this.checkSubscription = interval(60000).subscribe(() => {
        this.checkSessionTimeout();
      });
    });
  }

  stopMonitoring(): void {
    this.activitySubscription?.unsubscribe();
    this.checkSubscription?.unsubscribe();

    this.resetSessionState();
  }

  resetSessionState(): void {
    this.warningShown = false;
    this.warningAlertPresented = false;

    if (this.warningAlert) {
      this.warningAlert.dismiss();
      this.warningAlert = null;
    }

    localStorage.removeItem('last_activity');
  }

  private updateLastActivity(): void {
    localStorage.setItem('last_activity', Date.now().toString());

    if (this.warningShown) {
      this.warningShown = false;
    }
  }

  private checkSessionTimeout(): void {
    const lastActivity = localStorage.getItem('last_activity');

    if (!lastActivity) {
      return;
    }

    const inactiveTime = Date.now() - Number(lastActivity);

    // Warning previo
    if (inactiveTime >= this.WARNING_TIMEOUT_MS && !this.warningShown) {
      this.warningShown = true;

      this.ngZone.run(() => {
        this.presentSessionWarning();
      });
    }

    // Logout definitivo
    if (inactiveTime >= this.SESSION_TIMEOUT_MS) {
      console.warn('Sesión cerrada por inactividad.');

      this.ngZone.run(async () => {
        // Cerrar modal si sigue abierto
        if (this.warningAlert) {
          await this.warningAlert.dismiss();
          this.warningAlert = null;
        }

        this.warningShown = false;
        this.warningAlertPresented = false;

        this.store.dispatch(AuthActions.logout());
      });
    }
  }

  private validateExistingSession(): void {
    const lastActivity = localStorage.getItem('last_activity');

    if (!lastActivity) {
      return;
    }

    const inactiveTime = Date.now() - Number(lastActivity);

    if (inactiveTime >= this.SESSION_TIMEOUT_MS) {
      console.warn('Sesión expirada al iniciar aplicación.');

      this.ngZone.run(() => {
        this.store.dispatch(AuthActions.logout());
      });

      return;
    }

    console.log('Sesión válida. Restaurando monitoreo.');
  }

  private async presentSessionWarning(): Promise<void> {
    if (this.warningAlertPresented) {
      return;
    }

    this.warningAlertPresented = true;

    this.warningAlert = await this.alertController.create({
      header: 'Sesión próxima a expirar',
      message: 'Tu sesión se cerrará pronto por inactividad.',
      backdropDismiss: false,
      cssClass: 'session-timeout-alert',
      buttons: [
        {
          text: 'Cerrar sesión',
          role: 'destructive',
          handler: () => {
            this.warningAlertPresented = false;
            this.warningAlert = null;

            this.store.dispatch(AuthActions.logout());

            return true;
          },
        },
        {
          text: 'Continuar sesión',
          role: 'confirm',
          handler: () => {
            this.updateLastActivity();

            this.warningShown = false;
            this.warningAlertPresented = false;
            this.warningAlert = null;

            console.log('✅ Sesión extendida por el usuario.');

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
}
