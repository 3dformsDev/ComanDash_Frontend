import { TestBed } from '@angular/core/testing';

import { CashRegisterSessionService } from './cash-register-session.service';

describe('CashRegisterSessionService', () => {
  let service: CashRegisterSessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CashRegisterSessionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
