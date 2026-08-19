import { CashBoxManagementPage } from './cash-box-management.page';

describe('CashBoxManagementPage', () => {
  let component: CashBoxManagementPage;
  let cashRegisterSessionService: jasmine.SpyObj<any>;

  beforeEach(() => {
    cashRegisterSessionService = jasmine.createSpyObj(
      'CashRegisterSessionService',
      ['updateBusinessDaySettings'],
    );
    component = new CashBoxManagementPage(
      jasmine.createSpyObj('AlertController', ['create']),
      jasmine.createSpyObj('ToastController', ['create']),
      jasmine.createSpyObj('ModalController', ['create']),
      jasmine.createSpyObj('LoadingController', ['create']),
      jasmine.createSpyObj('CashRegisterService', ['getCashRegisters']),
      cashRegisterSessionService,
      jasmine.createSpyObj('Store', ['select']),
      jasmine.createSpyObj('Router', ['navigate']),
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses a scoped popover for the business-day hour options', () => {
    expect(component.businessDaySelectOptions).toEqual({
      cssClass: 'business-day-hour-popover',
    });
  });

  it('does not update the business day while a cash session is open', async () => {
    component.isSessionOpenInLocation = true;
    component.savedBusinessDayCutoffHour = 4;
    component.businessDayCutoffHour = 20;
    spyOn(component, 'presentToast');

    await component.saveBusinessDaySettings();

    expect(component.businessDayCutoffHour).toBe(4);
    expect(
      cashRegisterSessionService.updateBusinessDaySettings,
    ).not.toHaveBeenCalled();
    expect(component.presentToast).toHaveBeenCalledWith(
      'Cierra la caja antes de modificar el día operativo.',
      'warning',
    );
  });
});
