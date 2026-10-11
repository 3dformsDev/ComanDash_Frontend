import { of, throwError } from 'rxjs';
import { MenuManagementPage } from './menu-management.page';
import { ProductFormSubmission } from '../../../../components/product-form/product-form.component';

describe('Retrying partially saved products', () => {
  it('updates the already created product after its option save failed, instead of duplicating it', async () => {
    const page: any = Object.create(MenuManagementPage.prototype);
    let onSave!: (data: ProductFormSubmission) => Promise<boolean>;
    page.modalCtrl = { create: async (config: any) => {
      onSave = config.componentProps.onSave;
      return { present: async () => undefined, onDidDismiss: async () => ({ data: null, role: 'cancel' }) };
    }};
    const product = { id: 19 };
    page._productService = { addProduct: jasmine.createSpy().and.returnValue(of(product)),
      updateProduct: jasmine.createSpy().and.returnValue(of(product)) };
    page.personalizationsService = { syncProductPersonalizations: jasmine.createSpy().and.returnValues(
      throwError(() => ({ status: 500 })), of({})) };
    page.loadData = jasmine.createSpy().and.resolveTo(); page.presentToast = jasmine.createSpy();
    await page.addNewItem();
    const data: ProductFormSubmission = { product: { name: 'Gaseosa', price: 3000, cost: 1000, categoryId: 2 }, file: null, personalizations: [] };
    expect(await onSave(data)).toBeFalse();
    expect(await onSave(data)).toBeTrue();
    expect(page._productService.addProduct).toHaveBeenCalledTimes(1);
    expect(page._productService.updateProduct).toHaveBeenCalledTimes(1);
    expect(page._productService.updateProduct.calls.first().args[0]).toBe(19);
  });
});
