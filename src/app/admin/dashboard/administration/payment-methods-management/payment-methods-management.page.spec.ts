import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaymentMethodsManagementPage } from './payment-methods-management.page';

describe('PaymentMethodsManagementPage', () => {
  let component: PaymentMethodsManagementPage;
  let fixture: ComponentFixture<PaymentMethodsManagementPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PaymentMethodsManagementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
