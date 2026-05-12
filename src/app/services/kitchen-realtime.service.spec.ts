import { TestBed } from '@angular/core/testing';

import { KitchenRealtimeService } from './kitchen-realtime.service';

describe('KitchenRealtimeService', () => {
  let service: KitchenRealtimeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KitchenRealtimeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
