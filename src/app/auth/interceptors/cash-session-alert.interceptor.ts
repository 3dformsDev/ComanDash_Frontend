import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { CashSessionAlertCoordinatorService } from '@services/cash-session-alert-coordinator.service';
import { CashRegisterOperatingStateI } from '@services/cash-register-session.service';

export const CASH_REGISTER_PREVIOUS_BUSINESS_DAY =
  'CASH_REGISTER_PREVIOUS_BUSINESS_DAY';

@Injectable()
export class CashSessionAlertInterceptor implements HttpInterceptor {
  private readonly coordinator = inject(CashSessionAlertCoordinatorService);

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (
          error.status === 409 &&
          error.error?.code === CASH_REGISTER_PREVIOUS_BUSINESS_DAY
        ) {
          this.coordinator.requestExpansion(
            error.error?.data as CashRegisterOperatingStateI | undefined,
          );
        }

        return throwError(() => error);
      }),
    );
  }
}
