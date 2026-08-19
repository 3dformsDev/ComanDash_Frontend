import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { AuthService } from '@services/auth.service';
import { SocketService } from '@services/socket.service';
import { SessionActivityService } from './session-activity.service';

describe('SessionActivityService', () => {
  const now = new Date('2026-08-18T12:00:00.000Z').getTime();
  const sixHours = 6 * 60 * 60 * 1000;
  const tenMinutes = 10 * 60 * 1000;

  let service: SessionActivityService;
  let store: { dispatch: jasmine.Spy };
  let authService: { refreshToken: jasmine.Spy };
  let socketService: { renewToken: jasmine.Spy };

  beforeEach(() => {
    localStorage.removeItem('last_activity');
    localStorage.removeItem('last_token_refresh');
    spyOn(Date, 'now').and.returnValue(now);

    store = { dispatch: jasmine.createSpy('dispatch') };
    authService = {
      refreshToken: jasmine
        .createSpy('refreshToken')
        .and.returnValue(of('renewed-token')),
    };
    socketService = { renewToken: jasmine.createSpy('renewToken') };

    const ngZone = new NgZone({ enableLongStackTrace: false });
    const alertController = {
      create: jasmine.createSpy('create'),
    };

    TestBed.configureTestingModule({
      providers: [
        SessionActivityService,
        { provide: NgZone, useValue: ngZone },
        { provide: Store, useValue: store },
        { provide: AlertController, useValue: alertController },
        { provide: AuthService, useValue: authService },
        { provide: SocketService, useValue: socketService },
      ],
    });
    service = TestBed.inject(SessionActivityService);
  });

  afterEach(() => {
    service?.stopMonitoring();
    localStorage.removeItem('last_activity');
    localStorage.removeItem('last_token_refresh');
  });

  it('does not show the warning after only ten minutes of inactivity', () => {
    localStorage.setItem('last_activity', String(now - tenMinutes));
    const warning = spyOn<any>(service, 'presentSessionWarning').and.resolveTo();

    (service as any).checkSessionTimeout();

    expect(warning).not.toHaveBeenCalled();
  });

  it('shows the warning when ten minutes remain before six hours', () => {
    localStorage.setItem(
      'last_activity',
      String(now - (sixHours - tenMinutes)),
    );
    const warning = spyOn<any>(service, 'presentSessionWarning').and.resolveTo();

    (service as any).checkSessionTimeout();

    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('logs out at six hours without opening a stale warning', () => {
    localStorage.setItem('last_activity', String(now - sixHours));
    const warning = spyOn<any>(service, 'presentSessionWarning').and.resolveTo();
    const expire = spyOn<any>(service, 'expireSession');

    (service as any).checkSessionTimeout();

    expect(expire).toHaveBeenCalledTimes(1);
    expect(warning).not.toHaveBeenCalled();
  });

  it('rechecks elapsed time when an iPhone or browser resumes', () => {
    localStorage.setItem('last_activity', String(now - sixHours - 1));
    const expire = spyOn<any>(service, 'expireSession');

    (service as any).handleApplicationResume();

    expect(expire).toHaveBeenCalledTimes(1);
  });

  it('replaces existing monitoring subscriptions instead of duplicating them', () => {
    service.startMonitoring({ resetActivity: true });
    const firstActivitySubscription = (service as any).activitySubscription;
    const firstCheckSubscription = (service as any).checkSubscription;

    service.startMonitoring();

    expect(firstActivitySubscription.closed).toBeTrue();
    expect(firstCheckSubscription.closed).toBeTrue();
    expect((service as any).activitySubscription).not.toBe(
      firstActivitySubscription,
    );
  });

  it('stores a renewed token and updates the socket authentication', async () => {
    localStorage.setItem('last_token_refresh', String(now - 60 * 60 * 1000));

    await (service as any).refreshTokenIfNeeded();

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(socketService.renewToken).toHaveBeenCalledOnceWith('renewed-token');
    expect(localStorage.getItem('last_token_refresh')).toBe(String(now));
  });
});
