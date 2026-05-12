import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WaitersPage } from './waiters.page';

describe('WaitersPage', () => {
  let component: WaitersPage;
  let fixture: ComponentFixture<WaitersPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(WaitersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
