import { Injectable, NgZone } from '@angular/core';
import { Store } from '@ngrx/store';
import { fromEvent, merge, Subscription, interval } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import * as AuthActions from '@store/auth/actions/auth.actions';

@Injectable({
  providedIn: 'root'
})
export class SessionActivityService {

  private readonly SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 horas
  private readonly WARNING_TIMEOUT_MS = 3.5 * 60 * 60 * 1000; // 3h 30m

  private activitySubscription?: Subscription;
  private checkSubscription?: Subscription;

  private warningShown = false;

  constructor(
    private ngZone: NgZone,
    private store: Store
  ) { }

  startMonitoring(): void {

    this.validateExistingSession();

    this.updateLastActivity();

    this.ngZone.runOutsideAngular(() => {

      const activityEvents$ = merge(
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'click'),
        fromEvent(document, 'keydown'),
        fromEvent(document, 'scroll'),
        fromEvent(document, 'touchstart')
      ).pipe(
        throttleTime(30000)
      );

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
    if (
      inactiveTime >= this.WARNING_TIMEOUT_MS &&
      !this.warningShown
    ) {

      this.warningShown = true;

      console.warn('La sesión expirará pronto por inactividad.');
    }

    // Logout definitivo
    if (inactiveTime >= this.SESSION_TIMEOUT_MS) {

      console.warn('Sesión cerrada por inactividad.');

      this.ngZone.run(() => {
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
}
