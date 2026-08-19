import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { CashRegisterOperatingStateI } from './cash-register-session.service';

@Injectable({ providedIn: 'root' })
export class CashSessionAlertCoordinatorService {
  private readonly expandRequestsSubject =
    new Subject<CashRegisterOperatingStateI | null>();

  readonly expandRequests$ = this.expandRequestsSubject.asObservable();

  requestExpansion(state?: CashRegisterOperatingStateI): void {
    this.expandRequestsSubject.next(state || null);
  }
}
