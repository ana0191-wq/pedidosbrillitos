import { useState, useEffect, useCallback } from 'react';
import type { Order, OrderCategory } from '@/types/orders';

const STORAGE_KEY = 'order-tracker-orders';

function loadOrders(): Order[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>(loadOrders);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  const addOrder = useCallback((order: Order) => {
    setOrders(prev => [order, ...prev]);
  }, []);

  const updateOrder = useCallback((id: string, updates: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } as Order : o));
  }, []);

  const deleteOrder = useCallback((id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  }, []);

  const getByCategory = useCallback((category: OrderCategory) => {
    return orders.filter(o => o.category === category);
  }, [orders]);

  const getCounts = useCallback(() => {
    const personal = orders.filter(o => o.category === 'personal' && o.status !== 'Entregado').length;
    const merchandise = orders.filter(o => o.category === 'merchandise' && o.status !== 'Completo').length;
    const client = orders.filter(o => o.category === 'client' && o.status !== 'Entregado' && o.status !== 'Cliente Notificado').length;
    return { personal, merchandise, client, total: personal + merchandise + client };
  }, [orders]);

  return { orders, addOrder, updateOrder, deleteOrder, getByCategory, getCounts };
}
