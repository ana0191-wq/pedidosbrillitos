import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ClientOrderProduct {
  id: string;
  productName: string;
  productPhoto: string;
  store: string;
  pricePaid: number;
  orderNumber: string;
  status: string;
  arrived: boolean;
  weightLb: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  salePriceUsd: number | null;
  salePriceVes: number | null;
  shippingChargeClient: number | null;
  pricesConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientOrder {
  id: string;
  clientId: string;
  clientName?: string;
  status: string;
  paymentMethod: string;
  paymentReference: string;
  shippingCost: number;
  amountCharged: number;
  shippingType: string;
  shippingWeightLb: number;
  shippingVolumeFt3: number;
  shippingDimensions: string;
  notes: string;
  createdAt: string;
  products: ClientOrderProduct[];
  // Two-stage payment
  productPaymentStatus: string;
  productPaymentAmount: number | null;
  productPaymentMethod: string | null;
  productPaymentDate: string | null;
  shippingPaymentStatus: string;
  shippingPaymentAmount: number | null;
  shippingPaymentMethod: string | null;
  shippingPaymentDate: string | null;
  shippingCostCompany: number | null;
  shippingChargeToClient: number | null;
}

export function useClientOrders() {
  const [clientOrders, setClientOrders] = useState<ClientOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchClientOrders = useCallback(async () => {
    // Fetch client orders
    const { data: coData, error: coError } = await supabase
      .from('client_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (coError) { console.error(coError); return; }

    // Fetch clients for names
    const { data: clientsData } = await supabase.from('clients').select('id, name');
    const clientMap: Record<string, string> = {};
    (clientsData || []).forEach((c: any) => { clientMap[c.id] = c.name; });

    // Fetch products linked to client orders
    const coIds = (coData || []).map((co: any) => co.id);
    let productsMap: Record<string, ClientOrderProduct[]> = {};

    if (coIds.length > 0) {
      const { data: prodData } = await supabase
        .from('orders')
        .select('*')
        .in('client_order_id', coIds);

      (prodData || []).forEach((p: any) => {
        const coId = p.client_order_id;
        if (!productsMap[coId]) productsMap[coId] = [];
        productsMap[coId].push({
          id: p.id,
          productName: p.product_name,
          productPhoto: p.product_photo || '',
          store: p.store,
          pricePaid: Number(p.price_paid),
          orderNumber: p.order_number || '',
          status: p.status,
          arrived: !!p.arrived,
          weightLb: p.weight_lb != null ? Number(p.weight_lb) : null,
          lengthIn: p.length_in != null ? Number(p.length_in) : null,
          widthIn: p.width_in != null ? Number(p.width_in) : null,
          heightIn: p.height_in != null ? Number(p.height_in) : null,
          salePriceUsd: p.sale_price_usd != null ? Number(p.sale_price_usd) : null,
          salePriceVes: p.sale_price_ves != null ? Number(p.sale_price_ves) : null,
          shippingChargeClient: p.shipping_charge_client != null ? Number(p.shipping_charge_client) : null,
          pricesConfirmed: !!p.prices_confirmed,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        });
      });
    }

    setClientOrders((coData || []).map((r: any) => ({
      id: r.id,
      clientId: r.client_id,
      clientName: clientMap[r.client_id] || 'Desconocido',
      status: r.status,
      paymentMethod: r.payment_method || '',
      paymentReference: r.payment_reference || '',
      shippingCost: Number(r.shipping_cost) || 0,
      amountCharged: Number(r.amount_charged) || 0,
      shippingType: r.shipping_type || '',
      shippingWeightLb: Number(r.shipping_weight_lb) || 0,
      shippingVolumeFt3: Number(r.shipping_volume_ft3) || 0,
      shippingDimensions: r.shipping_dimensions || '',
      notes: r.notes || '',
      createdAt: r.created_at,
      products: productsMap[r.id] || [],
      productPaymentStatus: r.product_payment_status || 'Pendiente',
      productPaymentAmount: r.product_payment_amount != null ? Number(r.product_payment_amount) : null,
      productPaymentMethod: r.product_payment_method || null,
      productPaymentDate: r.product_payment_date || null,
      shippingPaymentStatus: r.shipping_payment_status || 'Pendiente',
      shippingPaymentAmount: r.shipping_payment_amount != null ? Number(r.shipping_payment_amount) : null,
      shippingPaymentMethod: r.shipping_payment_method || null,
      shippingPaymentDate: r.shipping_payment_date || null,
      shippingCostCompany: r.shipping_cost_company != null ? Number(r.shipping_cost_company) : null,
      shippingChargeToClient: r.shipping_charge_to_client != null ? Number(r.shipping_charge_to_client) : null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchClientOrders(); }, [fetchClientOrders]);

  const addClientOrder = useCallback(async (clientId: string, data: Partial<ClientOrder>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: result, error } = await supabase.from('client_orders').insert({
      user_id: user.id,
      client_id: clientId,
      status: data.status || 'Pendiente',
      payment_method: data.paymentMethod || '',
      payment_reference: data.paymentReference || '',
      shipping_cost: data.shippingCost || 0,
      amount_charged: data.amountCharged || 0,
      shipping_type: data.shippingType || '',
      notes: data.notes || '',
      shipping_cost_company: data.shippingCostCompany ?? null,
      shipping_charge_to_client: data.shippingChargeToClient ?? null,
    }).select('id').single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchClientOrders();
    return result?.id;
  }, [fetchClientOrders, toast]);

  const updateClientOrder = useCallback(async (id: string, updates: Record<string, any>) => {
    const row: any = {};
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.paymentMethod !== undefined) row.payment_method = updates.paymentMethod;
    if (updates.paymentReference !== undefined) row.payment_reference = updates.paymentReference;
    if (updates.shippingCost !== undefined) row.shipping_cost = updates.shippingCost;
    if (updates.amountCharged !== undefined) row.amount_charged = updates.amountCharged;
    if (updates.shippingType !== undefined) row.shipping_type = updates.shippingType;
    if (updates.shippingWeightLb !== undefined) row.shipping_weight_lb = updates.shippingWeightLb;
    if (updates.shippingVolumeFt3 !== undefined) row.shipping_volume_ft3 = updates.shippingVolumeFt3;
    if (updates.shippingDimensions !== undefined) row.shipping_dimensions = updates.shippingDimensions;
    if (updates.notes !== undefined) row.notes = updates.notes;
    if (updates.productPaymentStatus !== undefined) row.product_payment_status = updates.productPaymentStatus;
    if (updates.productPaymentAmount !== undefined) row.product_payment_amount = updates.productPaymentAmount;
    if (updates.productPaymentMethod !== undefined) row.product_payment_method = updates.productPaymentMethod;
    if (updates.productPaymentDate !== undefined) row.product_payment_date = updates.productPaymentDate;
    if (updates.shippingPaymentStatus !== undefined) row.shipping_payment_status = updates.shippingPaymentStatus;
    if (updates.shippingPaymentAmount !== undefined) row.shipping_payment_amount = updates.shippingPaymentAmount;
    if (updates.shippingPaymentMethod !== undefined) row.shipping_payment_method = updates.shippingPaymentMethod;
    if (updates.shippingPaymentDate !== undefined) row.shipping_payment_date = updates.shippingPaymentDate;
    if (updates.shippingCostCompany !== undefined) row.shipping_cost_company = updates.shippingCostCompany;
    if (updates.shippingChargeToClient !== undefined) row.shipping_charge_to_client = updates.shippingChargeToClient;

    const { error } = await supabase.from('client_orders').update(row).eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else await fetchClientOrders();
  }, [fetchClientOrders, toast]);

  const deleteClientOrder = useCallback(async (id: string) => {
    const { error } = await supabase.from('client_orders').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else await fetchClientOrders();
  }, [fetchClientOrders, toast]);

  const linkProductToOrder = useCallback(async (productId: string, clientOrderId: string) => {
    const { error } = await supabase.from('orders').update({ client_order_id: clientOrderId }).eq('id', productId);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else await fetchClientOrders();
  }, [fetchClientOrders, toast]);

  const getByClient = useCallback((clientId: string) => {
    return clientOrders.filter(co => co.clientId === clientId);
  }, [clientOrders]);

  return { clientOrders, loading, addClientOrder, updateClientOrder, deleteClientOrder, linkProductToOrder, getByClient, refetch: fetchClientOrders };
}
