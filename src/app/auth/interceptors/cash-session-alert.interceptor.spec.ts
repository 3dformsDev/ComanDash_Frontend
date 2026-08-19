import { HttpErrorResponse, HttpHandler, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CashSessionAlertCoordinatorService } from '@services/cash-session-alert-coordinator.service';
import {
  CASH_REGISTER_PREVIOUS_BUSINESS_DAY,
  CashSessionAlertInterceptor,
} from './cash-session-alert.interceptor';

describe('CashSessionAlertInterceptor', () => {
  let coordinator: jasmine.SpyObj<CashSessionAlertCoordinatorService>;
  let interceptor: CashSessionAlertInterceptor;
  const request = new HttpRequest('POST', '/api/v1/orders', {});

  beforeEach(() => {
    coordinator = jasmine.createSpyObj('CashSessionAlertCoordinatorService', [
      'requestExpansion',
    ]);
    TestBed.configureTestingModule({
      providers: [
        CashSessionAlertInterceptor,
        {
          provide: CashSessionAlertCoordinatorService,
          useValue: coordinator,
        },
      ],
    });
    interceptor = TestBed.inject(CashSessionAlertInterceptor);
  });

  it('reopens the alert only for the previous-business-day conflict', () => {
    const state = { status: 'open_previous', sessionId: 26 };
    const error = new HttpErrorResponse({
      status: 409,
      error: {
        code: CASH_REGISTER_PREVIOUS_BUSINESS_DAY,
        data: state,
      },
    });
    const next = {
      handle: () => throwError(() => error),
    } as HttpHandler;

    interceptor.intercept(request, next).subscribe({ error: () => undefined });

    expect(coordinator.requestExpansion).toHaveBeenCalledOnceWith(state as any);
  });

  it('does not react to unrelated HTTP conflicts', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: { code: 'ANOTHER_CONFLICT' },
    });
    const next = {
      handle: () => throwError(() => error),
    } as HttpHandler;

    interceptor.intercept(request, next).subscribe({ error: () => undefined });

    expect(coordinator.requestExpansion).not.toHaveBeenCalled();
  });

  it('leaves successful requests untouched', () => {
    const next = { handle: () => of({} as any) } as HttpHandler;

    interceptor.intercept(request, next).subscribe();

    expect(coordinator.requestExpansion).not.toHaveBeenCalled();
  });
});
