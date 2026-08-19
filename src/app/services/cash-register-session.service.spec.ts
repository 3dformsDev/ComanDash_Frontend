import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';

import { CashRegisterSessionService } from './cash-register-session.service';

describe('CashRegisterSessionService', () => {
  let service: CashRegisterSessionService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CashRegisterSessionService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads the business-day setting for the current location context', () => {
    let result: any;

    service.getBusinessDaySettings().subscribe((settings) => {
      result = settings;
    });

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/v1/cashregistersessions/business-day-settings`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      data: {
        businessTimeZone: 'America/Bogota',
        cutoffHour: 4,
        defaultCutoffHour: 4,
      },
    });

    expect(result.cutoffHour).toBe(4);
  });

  it('updates the cutoff using an unambiguous 24-hour value', () => {
    service.updateBusinessDaySettings(20).subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/v1/cashregistersessions/business-day-settings`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ cutoffHour: 20 });
    request.flush({
      data: {
        businessTimeZone: 'America/Bogota',
        cutoffHour: 20,
        defaultCutoffHour: 4,
      },
    });
  });

  it('loads the operating state for the current location context', () => {
    service.getOperatingState().subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/v1/cashregistersessions/operating-state`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      data: {
        status: 'open_previous',
        sessionId: 10,
        currentBusinessDate: '2026-08-04',
        sessionBusinessDate: '2026-08-03',
        businessDayCutoffHour: 4,
        openedAt: '2026-08-03T13:00:00.000Z',
        isPreviousBusinessDay: true,
        recoveryIsActive: false,
        recoveryAuthorizedUntil: null,
        recoveryAuthorizedBy: null,
        recoveryReason: null,
      },
    });
  });

  it('authorizes a 60-minute recovery with its audit reason', () => {
    service.authorizeRecovery(10, 'Venta omitida al cierre').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/v1/cashregistersessions/10/recovery`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Venta omitida al cierre' });
    request.flush({ data: {} });
  });

  it('ends an active recovery explicitly', () => {
    service.endRecovery(10).subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/v1/cashregistersessions/10/recovery`,
    );
    expect(request.request.method).toBe('DELETE');
    request.flush({ data: {} });
  });
});
