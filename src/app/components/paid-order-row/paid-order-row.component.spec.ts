import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PaidOrderRowComponent } from './paid-order-row.component';

describe('PaidOrderRowComponent', () => {
  let component: PaidOrderRowComponent;
  let fixture: ComponentFixture<PaidOrderRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaidOrderRowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaidOrderRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('order', {
      id: 211,
      companyId: 14,
      companyOrderNumber: 2,
      orderNumber: 2,
      status: 'paid',
      paidAt: '2026-07-18T20:44:04.000-05:00',
      totalAmount: 55000,
      waiter: { fullName: 'Administrador' },
      customerName: 'SAFASF',
      orderItems: [],
    });
    fixture.detectChanges();
  });

  it('shows the compact paid-order identity and total', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Comanda #2');
    expect(text).toContain('Orden');
    expect(text).toContain('#140000002');
    expect(text).toMatch(/55[.,]000/);
  });

  it('expands actions without exposing administrative refund by default', () => {
    fixture.debugElement
      .query(By.css('.paid-order-summary'))
      .triggerEventHandler('click');
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.receipt-pill'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.refund-pill'))).toBeNull();
  });
});
