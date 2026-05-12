import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KitchenPage } from './kitchen.page';

describe('KitchenPage', () => {
  let component: KitchenPage;
  let fixture: ComponentFixture<KitchenPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(KitchenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
