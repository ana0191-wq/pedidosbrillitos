export type Store = 'AliExpress' | 'Shein' | 'Temu' | 'Amazon';

export type PersonalStatus = 'Pedido' | 'En Tránsito' | 'Entregado';
export type MerchandiseStatus = 'Pedido' | 'En Tránsito' | 'Parcialmente Recibido' | 'Completo';
export type ClientStatus = 'Pedido' | 'En Tránsito' | 'Entregado' | 'Cliente Notificado';

export type OrderCategory = 'personal' | 'merchandise' | 'client';

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
