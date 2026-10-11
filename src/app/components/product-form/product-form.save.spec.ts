import { TestBed } from '@angular/core/testing';
import { ProductFormComponent } from './product-form.component';
import { InventoryService } from '@services/inventory.service';

describe('Product form confirmed saving', () => {
  let form: ProductFormComponent;
  let modal: any;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: InventoryService, useValue: {} }] });
    modal = { dismiss: jasmine.createSpy('dismiss').and.resolveTo(true) };
    form = TestBed.runInInjectionContext(() => new ProductFormComponent(modal,
      { create: async () => ({ present: async () => undefined }) } as any, {} as any, {} as any, {} as any, {} as any));
    form.product = { name: 'Gaseosa', price: 3000, cost: 1000, categoryId: 2 };
  });
  it('keeps entered data and the image when the server rejects saving', async () => {
    const image = new File(['image'], 'foto.png', { type: 'image/png' });
    form.selectedImageFile = image;
    form.onSave = async () => false;
    await form.save();
    expect(modal.dismiss).not.toHaveBeenCalled();
    expect(form.product.name).toBe('Gaseosa'); expect(form.selectedImageFile).toBe(image);
    expect(form.isSaving).toBeFalse();
  });
  it('waits for confirmation and suppresses duplicate clicks while saving', async () => {
    let finish!: (saved: boolean) => void;
    const save = jasmine.createSpy('save').and.callFake(() => new Promise<boolean>((resolve) => finish = resolve));
    form.onSave = save;
    const first = form.save(); await form.save(); form.dismiss();
    expect(save).toHaveBeenCalledTimes(1); expect(modal.dismiss).not.toHaveBeenCalled();
    finish(true); await first;
    expect(modal.dismiss).toHaveBeenCalledOnceWith(null, 'saved');
  });
  it('rejects oversized and unsupported images before any save request', async () => {
    form.onSave = jasmine.createSpy('save').and.resolveTo(true);
    form.selectedImageFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
    await form.save(); expect(form.onSave).not.toHaveBeenCalled();
    form.selectedImageFile = new File(['image'], 'foto.gif', { type: 'image/gif' });
    await form.save(); expect(form.onSave).not.toHaveBeenCalled();
  });
});
