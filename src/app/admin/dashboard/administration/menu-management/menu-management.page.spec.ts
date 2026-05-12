import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuManagementPage } from './menu-management.page';

describe('MenuManagementPage', () => {
  let component: MenuManagementPage;
  let fixture: ComponentFixture<MenuManagementPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MenuManagementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
