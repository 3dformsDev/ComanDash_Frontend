import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectTablePage } from './select-table.page';

describe('SelectTablePage', () => {
  let component: SelectTablePage;
  let fixture: ComponentFixture<SelectTablePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectTablePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
