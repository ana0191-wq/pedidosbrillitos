import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Order, OrderCategory } from '@/types/orders';
import { useToast } from '@/hooks/use-toast';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      return;
    }

    const mapped: Order[] = (data || []).map((row: any) => {
      const base = {
        id: row.id,
        productName: row.product_name,
        productPhoto: row.product_photo || '',
        store: row.store,
        pricePaid: Number(row.price_paid),
        orderDate: row.order_date || '',
        estimatedArrival: row.estimated_arrival || '',
        orderNumber: row.order_number || '',
        notes: row.notes || '',
        createdAt: row.created_at,
        status: row.status,
        category: row.category as OrderCategory,
        amountPaid: row.amount_paid != null ? Number(row.amount_paid) : null,
        paymentMethod: row.payment_method || null,
        paymentCurrency: row.payment_currency || null,
        euroRate: row.euro_rate != null ? Number(row.euro_rate) : null,
        deliveryNotes: row.delivery_notes || null,
        deliveredAt: row.delivered_at || null,
      };

      if (row.category === 'merchandise') {
        return { ...base, category: 'merchandise' as const, unitsOrdered: row.units_ordered || 1, unitsReceived: row.units_received || 0, pricePerUnit: Number(row.price_per_unit) || 0, suggestedPrice: row.suggested_price != null ? Number(row.suggested_price) : null };
      }
      if (row.category === 'client') {
        return { ...base, category: 'client' as const, clientName: row.client_name || '', shippingCost: Number(row.shipping_cost) || 0, amountCharged: Number(row.amount_charged) || 0 };
      }
      return { ...base, category: 'personal' as const };
    });

    setOrders(mapped);
    setLoading(false);
  }, []);

  // Backfill: ensure all orders have created_at
  const backfillDates = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id')
      .is('created_at', null);
    
    if (data && data.length > 0) {
      const ids = data.map(r => r.id);
      await supabase
        .from('orders')
        .update({ created_at: new Date().toISOString() })
        .in('id', ids);
      console.log(`Backfilled created_at for ${ids.length} orders`);
    }
  }, []);

  useEffect(() => { 
    backfillDates().then(() => fetchOrders()); 
  }, [fetchOrders, backfillDates]);

  const addOrder = useCallback(async (order: Order, clientOrderId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const row: any = {
      user_id: user.id,
      category: order.category,
      product_name: order.productName,
      product_photo: order.productPhoto,
      store: order.store.toLowerCase(),
      price_paid: order.pricePaid,
      order_date: order.orderDate || null,
      estimated_arrival: order.estimatedArrival || null,
      order_number: order.orderNumber,
      status: order.status,
      notes: order.notes,
    };

    if (order.category === 'merchandise') {
      row.units_ordered = (order as any).unitsOrdered;
      row.units_received = (order as any).unitsReceived;
      row.price_per_unit = (order as any).pricePerUnit;
      row.suggested_price = (order as any).suggestedPrice ?? null;
    }
    if (order.category === 'client') {
      row.client_name = (order as any).clientName;
      row.shipping_cost = (order as any).shippingCost;
      row.amount_charged = (order as any).amountCharged;
    }
    if (clientOrderId) {
      row.client_order_id = clientOrderId;
    }

    const { error } = await supabase.from('orders').insert(row);
    if (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchOrders();
  }, [fetchOrders, toast]);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
    const row: any = {};
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.category !== undefined) row.category = updates.category;
    if ((updates as any).productName !== undefined) row.product_name = (updates as any).productName;
    if ((updates as any).store !== undefined) row.store = String((updates as any).store).toLowerCase();
    if ((updates as any).pricePaid !== undefined) row.price_paid = (updates as any).pricePaid;
    if ((updates as any).orderDate !== undefined) row.order_date = (updates as any).orderDate || null;
    if ((updates as any).estimatedArrival !== undefined) row.estimated_arrival = (updates as any).estimatedArrival || null;
    if ((updates as any).orderNumber !== undefined) row.order_number = (updates as any).orderNumber;
    if ((updates as any).unitsReceived !== undefined) row.units_received = (updates as any).unitsReceived;
    if ((updates as any).unitsOrdered !== undefined) row.units_ordered = (updates as any).unitsOrdered;
    if ((updates as any).pricePerUnit !== undefined) row.price_per_unit = (updates as any).pricePerUnit;
    if ((updates as any).clientName !== undefined) row.client_name = (updates as any).clientName;
    if ((updates as any).shippingCost !== undefined) row.shipping_cost = (updates as any).shippingCost;
    if ((updates as any).amountCharged !== undefined) row.amount_charged = (updates as any).amountCharged;
    if (updates.notes !== undefined) row.notes = updates.notes;
    if ((updates as any).suggestedPrice !== undefined) row.suggested_price = (updates as any).suggestedPrice;
    if ((updates as any).arrived !== undefined) row.arrived = (updates as any).arrived;
    // Payment fields
    if ((updates as any).amountPaid !== undefined) row.amount_paid = (updates as any).amountPaid;
    if ((updates as any).paymentMethod !== undefined) row.payment_method = (updates as any).paymentMethod;
    if ((updates as any).paymentCurrency !== undefined) row.payment_currency = (updates as any).paymentCurrency;
    if ((updates as any).euroRate !== undefined) row.euro_rate = (updates as any).euroRate;
    if ((updates as any).deliveryNotes !== undefined) row.delivery_notes = (updates as any).deliveryNotes;
    if ((updates as any).deliveredAt !== undefined) row.delivered_at = (updates as any).deliveredAt;

    // Auto-set delivered_at when status changes to Entregado
    if (updates.status === 'Entregado' && !row.delivered_at) {
      row.delivered_at = new Date().toISOString();
    }

    const { error } = await supabase.from('orders').update(row).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchOrders();
  }, [fetchOrders, toast]);

  const deleteOrder = useCallback(async (id: string) => {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchOrders();
  }, [fetchOrders, toast]);

  const getByCategory = useCallback((category: OrderCategory) => {
    return orders.filter(o => o.category === category);
  }, [orders]);

  const getCounts = useCallback(() => {
    const personal = orders.filter(o => o.category === 'personal' && o.status !== 'Entregado').length;
    const merchandise = orders.filter(o => o.category === 'merchandise' && o.status !== 'Entregado').length;
    const client = orders.filter(o => o.category === 'client' && o.status !== 'Entregado').length;
    return { personal, merchandise, client, total: personal + merchandise + client };
  }, [orders]);

  return { orders, loading, addOrder, updateOrder, deleteOrder, getByCategory, getCounts };
}
