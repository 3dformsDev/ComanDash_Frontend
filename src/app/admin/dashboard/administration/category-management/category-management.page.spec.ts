import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryManagementPage } from './category-management.page';

describe('CategoryManagementPage', () => {
  let component: CategoryManagementPage;
  let fixture: ComponentFixture<CategoryManagementPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CategoryManagementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
