export type Store = string;

export type PersonalStatus = 'Pedido' | 'En Tránsito' | 'Entregado';
export type MerchandiseStatus = 'Pedido' | 'En Tránsito' | 'Parcialmente Recibido' | 'Completo';
export type ClientStatus = 'Pedido' | 'En Tránsito' | 'Entregado' | 'Cliente Notificado';

export type OrderCategory = 'personal' | 'merchandise' | 'client';

export type PaymentMethod = 'PayPal' | 'Binance' | 'PagoMóvil' | 'Zelle' | 'Efectivo' | 'Otro';
export type PaymentCurrency = 'USD' | 'EUR' | 'BS';

export interface BaseOrder {
  id: string;
  category: OrderCategory;
  productName: string;
  productPhoto: string;
  store: Store;
  pricePaid: number;
  orderDate: string;
  estimatedArrival: string;
  orderNumber: string;
  notes: string;
  createdAt: string;
  // Payment tracking
  amountPaid?: number | null;
  paymentMethod?: PaymentMethod | null;
  paymentCurrency?: PaymentCurrency | null;
  euroRate?: number | null;
  deliveryNotes?: string | null;
  deliveredAt?: string | null;
}

export interface PersonalOrder extends BaseOrder {
  category: 'personal';
  status: PersonalStatus;
}

export interface MerchandiseOrder extends BaseOrder {
  category: 'merchandise';
  status: MerchandiseStatus;
  unitsOrdered: number;
  unitsReceived: number;
  pricePerUnit: number;
  suggestedPrice: number | null;
}

export interface ClientOrder extends BaseOrder {
  category: 'client';
  status: ClientStatus;
  clientName: string;
  shippingCost: number;
  amountCharged: number;
}

export type Order = PersonalOrder | MerchandiseOrder | ClientOrder;

export interface Product {
  id: string;
  userId: string;
  name: string;
  description: string;
  costUsd: number;
  salePriceUsd: number;
  salePriceVes: number;
  isSet: boolean;
  setQuantity: number;
  stock: number;
  store: string;
  images: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}
