import { ReportsPage } from './reports.page';

describe('ReportsPage', () => {
  let component: ReportsPage;

  beforeEach(() => {
    component = new ReportsPage(
      jasmine.createSpyObj('LoadingController', ['create']),
      jasmine.createSpyObj('ToastController', ['create']),
      jasmine.createSpyObj('ReportsService', [
        'generateReportSalesWithDateRange',
        'generateReportPeakTimesWithDateRange',
      ]),
      jasmine.createSpyObj('CashRegisterSessionService', [
        'getBusinessDaySettings',
      ]),
    );
  });

  it('keeps payment reconciliation collapsed until requested', () => {
    expect(component.paymentReconciliationExpanded).toBeFalse();

    component.togglePaymentReconciliation();
    expect(component.paymentReconciliationExpanded).toBeTrue();

    component.togglePaymentReconciliation();
    expect(component.paymentReconciliationExpanded).toBeFalse();
  });
});
