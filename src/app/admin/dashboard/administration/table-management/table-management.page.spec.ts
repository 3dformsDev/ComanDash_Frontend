import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableManagementPage } from './table-management.page';

describe('TableManagementPage', () => {
  let component: TableManagementPage;
  let fixture: ComponentFixture<TableManagementPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TableManagementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
