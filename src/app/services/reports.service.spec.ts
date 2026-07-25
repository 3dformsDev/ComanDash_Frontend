import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';

import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('sends calendar dates without UTC conversion', () => {
    service
      .generateReportSalesWithDateRange(
        '2026-07-18T00:00:00.000-05:00',
        '2026-07-19T00:00:00.000-05:00',
      )
      .subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/v1/reports/sales?startDate=2026-07-18&endDate=2026-07-19`,
    );

    expect(request.request.method).toBe('GET');
    request.flush({ data: {} });
  });
});
