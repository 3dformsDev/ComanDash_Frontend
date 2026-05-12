import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { CloseCashRegisterSessionFormComponent } from './close-cash-register-session-form.component';

describe('CloseCashRegisterSessionFormComponent', () => {
  let component: CloseCashRegisterSessionFormComponent;
  let fixture: ComponentFixture<CloseCashRegisterSessionFormComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [CloseCashRegisterSessionFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CloseCashRegisterSessionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
