// 1. Definimos cómo se ve un item dentro de la orden
export interface OrderItem {
  id?: number;
  productId: number;
  quantity: number;
  name?: string; // opcional, si tu backend devuelve nombre del producto
  price?: number; // opcional, si viene el precio unitario
  total?: number;
  currentOrder?: Order | null;
  product?: {
    name: string;
    category?: {
      name: string;
    };
  };
  unitPrice?: string;
  kitchenStatus?: 'pending' | 'in_preparation' | 'ready' | 'served';
}

export interface PaymentSummary {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  isFullyPaid: boolean;
}

export interface OrderPaymentRecord {
  id?: number;
  orderId?: number;
  paymentMethodId?: number;
  cashRegisterSessionId?: number | null;
  amount: number | string;
  referenceNumber?: string | null;
  processedBy?: number;
  processedAt?: string;
  notes?: string | null;
  paymentMethod?: {
    id?: number;
    name: string;
    type?: string;
  };
}

// 2. Definimos cómo se ve una orden
export interface Order {
  id?: number; // opcional, porque aún no existe hasta que backend la guarde
  companyId?: number;
  companyOrderNumber?: number | null;
  customerName?: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery'; // puedes ajustar según tipos reales
  tableId?: number | null;
  orderItems: OrderItem[];
  kitchenNotes?: string | null;
  isAdvancePayment: boolean;
  paymentMethodId?: number | null | undefined;
  notesPayment?: string | null;
  adjustments?: {
    type: 'charge' | 'discount';
    description: string;
    amount: number;
  }[];

  // Campos adicionales que puede devolver backend
  status?:
    | 'pending'
    | 'in_progress'
    | 'ready'
    | 'served'
    | 'paid'
    | 'completed'
    | 'cancelled';
  totalAmount?: number;
  createdAt?: string; // ISO string
  updatedAt?: string; // ISO string
  paymentDetails?: {
    paymentMethodId: number;
    amount?: number | string;
    totalPaid?: number | string;
    notesPayment?: string;
    adjustments?: {
      type: 'charge' | 'discount';
      description: string;
      amount: number;
    }[];
    advancePayments?: {
      paymentMethodId: number;
      amount: number;
      notesPayment: string;
    }[];
  } | null;

  advancePayments?: {
    paymentMethodId: number;
    amount: number;
    notesPayment: string;
  }[];

  isPrepaid?: boolean;
  orderNumber?: string | number;
  isReadyToServe?: boolean;
  isServed?: boolean;
  paidAt?: string | null;
  cancelledAt?: string | null;
  payments?: OrderPaymentRecord[];
  paymentSummary?: PaymentSummary;
  table?: {
    isBussy: boolean;
    tableNumber?: string | number;
    name?: string;
  };
  isFreedTable?: boolean;
  waiter?: {
    fullName: string;
  };
  justUpdated?: boolean;
  wasModified?: true;
}

export interface OrderPayment {
  orderId: number;
  paymentMethodId: number;
  movementType: 'sale' | 'withdrawal' | 'deposit';
  amount: number | string;

  notes?: string;
  notesPayment?: string;

  adjustments?: {
    type: 'charge' | 'discount';
    description: string;
    amount: number;
  }[];
}

// 3. Definimos la estructura completa del estado de órdenes
export interface OrdersState {
  customerName?: string;
  orders: Order[]; // todas las órdenes en memoria
  selectedOrder: Order | null; // orden activa/seleccionada
  loading: boolean; // indicador de carga
  error: string | null; // manejo de errores
  selectTabledOrder: {
    orderType: 'dine_in' | 'takeaway' | 'delivery';
    tableId: number;
    tableNumber: string;
  };
  numberTable: {
    tableNumber: string;
  };
  currentOrder: Order | null;
}

// 4. Creamos el estado inicial
export const initialOrdersState: OrdersState = {
  orders: [],
  selectedOrder: null,
  loading: false,
  error: null,
  selectTabledOrder: {
    orderType: 'dine_in',
    tableId: 0,
    tableNumber: '',
  },
  numberTable: {
    tableNumber: '',
  },
  currentOrder: null,
};
