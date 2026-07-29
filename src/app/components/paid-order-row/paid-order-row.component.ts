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
  @Input() mode: 'paid' | 'cancelled' = 'paid';
  @Input() showReceipt = true;

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

  get eventTime(): string {
    const timestamp =
      this.mode === 'cancelled' ? this.order.cancelledAt : this.order.paidAt;

    if (!timestamp) {
      return 'Sin hora';
    }

    const date = new Date(timestamp);

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

  get eventTimeLabel(): string {
    return this.mode === 'cancelled' ? 'Cancelacion' : 'Pago';
  }

  get statusLabel(): string {
    return this.mode === 'cancelled' ? 'Cancelada' : 'Pagada';
  }

  get paymentMethodsLabel(): string {
    const grouped = (this.order.payments || [])
      .filter((payment) => Number(payment.amount || 0) > 0)
      .reduce<Map<string, number>>((result, payment) => {
        const methodName =
          payment.paymentMethod?.name?.trim() || 'Metodo no especificado';
        const amount = Number(payment.amount || 0);

        result.set(methodName, (result.get(methodName) || 0) + amount);
        return result;
      }, new Map<string, number>());

    return Array.from(grouped.entries())
      .map(([name, amount]) => {
        const formattedAmount = new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(amount);

        return `${name}: ${formattedAmount}`;
      })
      .join(' + ');
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
