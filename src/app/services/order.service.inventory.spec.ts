import { orderFromUpdateResponse } from './order.service';
import { Order } from '@store/orders/orders.state';

describe('Order inventory response contract', () => {
  it('gives NgRx the refreshed order when the API also returns operation metadata', () => {
    const order = { id: 42, orderNumber: '7', inventoryVersion: 3 } as Order;
    expect(orderFromUpdateResponse({ order })).toBe(order);
    expect(orderFromUpdateResponse(order)).toBe(order);
  });
});
