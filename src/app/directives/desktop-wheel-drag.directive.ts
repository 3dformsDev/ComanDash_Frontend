import { Directive, ElementRef, HostListener, OnDestroy, inject } from '@angular/core';

/** Month/year wheels emit intermediate dates before a calendar day is chosen. */
export function selectedCalendarDay(event: CustomEvent): string | undefined {
  const picker = event.target;
  if (!(picker instanceof HTMLElement) || picker.classList.contains('month-year-picker-open')) return;
  const value: unknown = event.detail?.value;
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : undefined;
}

@Directive({
  selector: 'ion-datetime[appDesktopWheelDrag]',
  standalone: true,
})
export class DesktopWheelDragDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private scrollElement?: HTMLElement;
  private pointerId?: number;
  private startY = 0;
  private startScrollTop = 0;
  private dragged = false;
  private suppressClick = false;
  private previousScrollSnapType = '';
  private keepScrollActiveTimer?: number;

  constructor() {
    this.host.addEventListener('click', this.onClickCapture, true);
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const scrollElement = event.composedPath().find(
      (node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains('picker-opts'),
    );
    if (!scrollElement) return;

    this.scrollElement = scrollElement;
    this.pointerId = event.pointerId;
    this.startY = event.clientY;
    this.startScrollTop = scrollElement.scrollTop;
    this.dragged = false;
    this.previousScrollSnapType = scrollElement.style.scrollSnapType;
    scrollElement.style.scrollSnapType = 'none';
    scrollElement.style.cursor = 'grabbing';
    this.keepScrollActiveTimer = window.setInterval(() => {
      this.scrollElement?.dispatchEvent(new Event('scroll'));
    }, 100);
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.scrollElement || event.pointerId !== this.pointerId) return;
    const distance = event.clientY - this.startY;
    if (!this.dragged && Math.abs(distance) < 4) return;
    this.dragged = true;
    this.scrollElement.scrollTop = this.startScrollTop - distance;
    event.preventDefault();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    if (this.scrollElement) {
      this.scrollElement.style.scrollSnapType = this.previousScrollSnapType;
      this.scrollElement.style.cursor = 'grab';
    }
    this.suppressClick = this.dragged;
    this.clearDrag();
    if (this.suppressClick) window.setTimeout(() => this.suppressClick = false);
  };

  private readonly onClickCapture = (event: MouseEvent): void => {
    if (!this.suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.suppressClick = false;
  };

  private clearDrag(): void {
    if (this.keepScrollActiveTimer !== undefined) window.clearInterval(this.keepScrollActiveTimer);
    this.keepScrollActiveTimer = undefined;
    this.scrollElement = undefined;
    this.pointerId = undefined;
    this.dragged = false;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  ngOnDestroy(): void {
    this.clearDrag();
    this.host.removeEventListener('click', this.onClickCapture, true);
  }
}
