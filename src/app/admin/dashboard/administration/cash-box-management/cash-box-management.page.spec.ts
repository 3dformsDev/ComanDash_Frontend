import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CashBoxManagementPage } from './cash-box-management.page';

describe('CashBoxManagementPage', () => {
  let component: CashBoxManagementPage;
  let fixture: ComponentFixture<CashBoxManagementPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CashBoxManagementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
