import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { OpenCashRegisterSessionFormComponent } from './open-cash-register-session-form.component';

describe('OpenCashRegisterSessionFormComponent', () => {
  let component: OpenCashRegisterSessionFormComponent;
  let fixture: ComponentFixture<OpenCashRegisterSessionFormComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [OpenCashRegisterSessionFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OpenCashRegisterSessionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
