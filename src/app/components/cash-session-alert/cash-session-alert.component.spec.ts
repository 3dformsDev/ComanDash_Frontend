import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { TestBed } from '@angular/core/testing';
import { EMPTY, of } from 'rxjs';

import { CashSessionAlertCoordinatorService } from '@services/cash-session-alert-coordinator.service';
import {
  CashRegisterOperatingStateI,
  CashRegisterSessionService,
} from '@services/cash-register-session.service';
import { SocketService } from '@services/socket.service';
import { ToastService } from '@services/toast.service';
import { CashSessionAlertComponent } from './cash-session-alert.component';

describe('CashSessionAlertComponent', () => {
  let component: CashSessionAlertComponent;
  let coordinator: CashSessionAlertCoordinatorService;
  let sessionsService: jasmine.SpyObj<CashRegisterSessionService>;
  let alertController: jasmine.SpyObj<AlertController>;

  const previousState: CashRegisterOperatingStateI = {
    status: 'open_previous',
    sessionId: 26,
    currentBusinessDate: '2026-08-05',
    sessionBusinessDate: '2026-07-28',
    businessDayCutoffHour: 4,
    openedAt: '2026-07-28T13:00:00.000Z',
    isPreviousBusinessDay: true,
    recoveryIsActive: false,
    recoveryAuthorizedUntil: null,
    recoveryAuthorizedBy: null,
    recoveryReason: null,
  };

  beforeEach(() => {
    sessionsService = jasmine.createSpyObj('CashRegisterSessionService', [
      'getOperatingState',
      'authorizeRecovery',
      'endRecovery',
    ]);
    sessionsService.getOperatingState.and.returnValue(of(previousState));
    alertController = jasmine.createSpyObj('AlertController', ['create']);

    TestBed.configureTestingModule({
      providers: [
        CashSessionAlertCoordinatorService,
        { provide: CashRegisterSessionService, useValue: sessionsService },
        {
          provide: Store,
          useValue: {
            select: () => of({
              isAuthenticated: true,
              locationId: 9,
              user: {
                role: { code: 'admin' },
                company: { id: 1 },
              },
            }),
          },
        },
        {
          provide: SocketService,
          useValue: {
            isConnected$: of(false),
            emit: jasmine.createSpy('emit'),
            listen: jasmine.createSpy('listen').and.returnValue(EMPTY),
          },
        },
        { provide: AlertController, useValue: alertController },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['presentToast']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
      ],
    });

    coordinator = TestBed.inject(CashSessionAlertCoordinatorService);
    component = TestBed.runInInjectionContext(
      () => new CashSessionAlertComponent(),
    );
    component.ngOnInit();
  });

  afterEach(() => component.ngOnDestroy());

  it('keeps a compact warning instead of dismissing the previous-day state', () => {
    coordinator.requestExpansion(previousState);

    component.minimize();

    expect(component.isMinimized).toBeTrue();
    expect(component.state).toEqual(previousState);

    component.expand();
    expect(component.isMinimized).toBeFalse();
  });

  it('reopens immediately when a blocked transaction requests expansion', () => {
    coordinator.requestExpansion(previousState);
    component.minimize();

    coordinator.requestExpansion(previousState);

    expect(component.isMinimized).toBeFalse();
  });

  it('does not reopen during a normal refresh of the same cash session', () => {
    coordinator.requestExpansion(previousState);
    component.minimize();

    component.refresh();

    expect(component.isMinimized).toBeTrue();
  });

  it('describes the recovery period without technical server wording', async () => {
    alertController.create.and.returnValue(Promise.resolve({
      present: () => Promise.resolve(),
      onDidDismiss: () => Promise.resolve({ role: 'cancel' }),
    } as any));
    component.state = previousState;
    component.canAuthorize = true;

    await component.authorizeRecovery();

    const config = alertController.create.calls.mostRecent().args[0];
    expect(config).toBeDefined();
    expect(config!.message).toContain(
      'La autorización estará activa durante 60 minutos y finalizará automáticamente.',
    );
    expect(config!.message).not.toContain('hora del servidor');
  });
});
