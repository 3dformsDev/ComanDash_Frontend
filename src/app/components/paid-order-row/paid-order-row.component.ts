import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Order } from '@store/orders/orders.state';

@Component({
  selector: 'app-paid-order-row',
  templateUrl: './paid-order-row.component.html',
  styleUrls: ['./paid-order-row.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class PaidOrderRowComponent {
  @Input({ required: true }) order!: Order;
  @Input() canRefund = false;

  @Output() receiptRequested = new EventEmitter<number>();
  @Output() refundRequested = new EventEmitter<Order>();

  expanded = false;

  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleExpanded();
    }
  }

  get visualOrderNumber(): string {
    if (this.order.companyId && this.order.companyOrderNumber) {
      return `${this.order.companyId}${String(
        this.order.companyOrderNumber,
      ).padStart(7, '0')}`;
    }

    return String(this.order.id || this.order.orderNumber || 'Sin numero');
  }

  get paidTime(): string {
    if (!this.order.paidAt) {
      return 'Sin hora';
    }

    const date = new Date(this.order.paidAt);

    if (Number.isNaN(date.getTime())) {
      return 'Sin hora';
    }

    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  get tableLabel(): string {
    if (!this.order.table) {
      return `Para llevar${
        this.order.customerName ? ` - ${this.order.customerName}` : ''
      }`;
    }

    const tableName =
      this.order.table.tableNumber || this.order.table.name || this.order.tableId;
    return `Mesa ${tableName}${
      this.order.customerName ? ` - ${this.order.customerName}` : ''
    }`;
  }

  get adjustments(): NonNullable<Order['adjustments']> {
    const paymentAdjustments = (this.order.paymentSummary as any)?.adjustments;

    if (Array.isArray(paymentAdjustments)) {
      return paymentAdjustments;
    }

    return Array.isArray(this.order.adjustments) ? this.order.adjustments : [];
  }

  requestReceipt(event: Event): void {
    event.stopPropagation();

    if (this.order.id) {
      this.receiptRequested.emit(this.order.id);
    }
  }

  requestRefund(event: Event): void {
    event.stopPropagation();
    this.refundRequested.emit(this.order);
  }
}
