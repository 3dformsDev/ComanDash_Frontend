import { TestBed } from '@angular/core/testing';

import { OrdersRealtimeService } from './orders-realtime.service';

describe('OrdersrealtimeService', () => {
  let service: OrdersRealtimeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrdersRealtimeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
