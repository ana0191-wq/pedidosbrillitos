import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Package, CheckCircle2, Ruler, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { ClientOrder, ClientOrderProduct } from '@/hooks/useClientOrders';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import { useOrders } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';

const ORDER_STATUSES = ['Pagado sin comprar', 'Comprado', 'En Tránsito', 'Recibido'];
const PAYMENT_METHODS = ['Bolívares (tasa euro)', 'PayPal', 'Binance', 'Efectivo'];
const STORES = ['AliExpress', 'Shein', 'Temu', 'Amazon'];
const PRODUCT_STATUSES = ['Pedido', 'En Tránsito', 'Entregado'];

interface ProductDims {
  weightLb: string;
  lengthIn: string;
  widthIn: string;
  heightIn: string;
  salePriceUsd: string;
  shippingChargeClient: string;
  pricesConfirmed: boolean;
}

interface EditClientOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ClientOrder | null;
  onUpdateOrder: (id: string, updates: Record<string, any>) => void;
  onDeleteOrder: (id: string) => void;
  exchangeRate: number | null;
  shippingSettings?: ShippingSettings;
}

function calcProductShipping(
  weight: number,
  l: number,
  w: number,
  h: number,
  myRate: number,
  clientRate: number
) {
  const volWeight = (l && w && h) ? (l * w * h) / 166 : 0;
  const billable = Math.ceil(Math.max(weight, volWeight));
  const myCost = billable * myRate;
  const clientCharge = billable * clientRate;
  return { volWeight, billable, myCost, clientCharge, profit: clientCharge - myCost };
}

export function EditClientOrderDialog({ open, onOpenChange, order, onUpdateOrder, onDeleteOrder, exchangeRate, shippingSettings }: EditClientOrderDialogProps) {
  const { updateOrder: updateProduct, deleteOrder: deleteProduct } = useOrders();
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [payRef, setPayRef] = useState('');
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState<ClientOrderProduct[]>([]);
  const [productDims, setProductDims] = useState<Record<string, ProductDims>>({});

  const myRate = shippingSettings?.airRatePerLb ?? 6.50;
  const clientRate = shippingSettings?.airPricePerLb ?? 10;
  const profitPercent = 0.30;

  useEffect(() => {
    if (order && open) {
      setStatus(order.status);
      setPayment(order.paymentMethod);
      setPayRef(order.paymentReference);
      setNotes(order.notes);
      setProducts([...order.products]);

      const dims: Record<string, ProductDims> = {};
      order.products.forEach(p => {
        dims[p.id] = {
          weightLb: p.weightLb != null ? String(p.weightLb) : '',
          lengthIn: p.lengthIn != null ? String(p.lengthIn) : '',
          widthIn: p.widthIn != null ? String(p.widthIn) : '',
          heightIn: p.heightIn != null ? String(p.heightIn) : '',
          salePriceUsd: p.salePriceUsd != null ? String(p.salePriceUsd) : '',
          shippingChargeClient: p.shippingChargeClient != null ? String(p.shippingChargeClient) : '',
          pricesConfirmed: p.pricesConfirmed,
        };
      });
      setProductDims(dims);
    }
  }, [order, open]);

  if (!order) return null;

  const updateDim = (id: string, field: keyof ProductDims, value: any) => {
    setProductDims(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const updateLocalProduct = (id: string, field: keyof ClientOrderProduct, value: any) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleDeleteProduct = (productId: string) => {
    deleteProduct(productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  // Per-product calcs
  const productCalcs = useMemo(() => {
    const calcs: Record<string, ReturnType<typeof calcProductShipping> & { suggestedSaleUsd: number }> = {};
    products.forEach(p => {
      const d = productDims[p.id];
      if (!d) return;
      const weight = parseFloat(d.weightLb) || 0;
      const l = parseFloat(d.lengthIn) || 0;
      const w = parseFloat(d.widthIn) || 0;
      const h = parseFloat(d.heightIn) || 0;
      if (weight > 0) {
        const calc = calcProductShipping(weight, l, w, h, myRate, clientRate);
        const suggestedSaleUsd = p.pricePaid * (1 + profitPercent);
        calcs[p.id] = { ...calc, suggestedSaleUsd };
      }
    });
    return calcs;
  }, [products, productDims, myRate, clientRate]);

  // Order summary
  const summary = useMemo(() => {
    let totalSaleUsd = 0;
    let totalShippingClient = 0;
    let totalCostUsd = 0;
    let totalShippingMy = 0;

    products.forEach(p => {
      const d = productDims[p.id];
      const calc = productCalcs[p.id];
      const salePrice = d ? (parseFloat(d.salePriceUsd) || calc?.suggestedSaleUsd || 0) : 0;
      const shippingClient = d ? (parseFloat(d.shippingChargeClient) || calc?.clientCharge || 0) : 0;
      totalSaleUsd += salePrice;
      totalShippingClient += shippingClient;
      totalCostUsd += p.pricePaid;
      totalShippingMy += calc?.myCost || 0;
    });

    const totalChargeClient = totalSaleUsd + totalShippingClient;
    const totalChargeVes = exchangeRate ? totalChargeClient * exchangeRate : 0;
    const profit = totalChargeClient - totalCostUsd - totalShippingMy;
    return { totalSaleUsd, totalShippingClient, totalChargeClient, totalChargeVes, totalCostUsd, totalShippingMy, profit };
  }, [products, productDims, productCalcs, exchangeRate]);

  const confirmPrices = async (productId: string) => {
    const d = productDims[productId];
    const calc = productCalcs[productId];
    if (!d) return;

    const saleUsd = parseFloat(d.salePriceUsd) || calc?.suggestedSaleUsd || 0;
    const shippingClient = parseFloat(d.shippingChargeClient) || calc?.clientCharge || 0;
    const saleVes = exchangeRate ? saleUsd * exchangeRate : 0;

    await supabase.from('orders').update({
      weight_lb: parseFloat(d.weightLb) || null,
      length_in: parseFloat(d.lengthIn) || null,
      width_in: parseFloat(d.widthIn) || null,
      height_in: parseFloat(d.heightIn) || null,
      sale_price_usd: saleUsd,
      sale_price_ves: saleVes,
      shipping_charge_client: shippingClient,
      prices_confirmed: true,
    }).eq('id', productId);

    updateDim(productId, 'pricesConfirmed', true);
    updateDim(productId, 'salePriceUsd', String(saleUsd));
    updateDim(productId, 'shippingChargeClient', String(shippingClient));
  };

  const handleSave = () => {
    // Update client order totals
    onUpdateOrder(order.id, {
      status,
      paymentMethod: payment,
      paymentReference: payRef,
      shippingCost: summary.totalShippingMy,
      amountCharged: summary.totalChargeClient,
      notes,
    });

    // Update each product's basic fields
    for (const p of products) {
      const orig = order.products.find(op => op.id === p.id);
      if (!orig) continue;
      const updates: Record<string, any> = {};
      if (p.productName !== orig.productName) updates.productName = p.productName;
      if (p.store !== orig.store) updates.store = p.store;
      if (p.pricePaid !== orig.pricePaid) updates.pricePaid = p.pricePaid;
      if (p.orderNumber !== orig.orderNumber) updates.orderNumber = p.orderNumber;
      if (p.status !== orig.status) updates.status = p.status;
      if (p.arrived !== orig.arrived) updates.arrived = p.arrived;

      // Save dims
      const d = productDims[p.id];
      if (d) {
        const wl = parseFloat(d.weightLb) || null;
        const li = parseFloat(d.lengthIn) || null;
        const wi = parseFloat(d.widthIn) || null;
        const hi = parseFloat(d.heightIn) || null;
        if (wl !== orig.weightLb) updates.weightLb = wl;
        if (li !== orig.lengthIn) updates.lengthIn = li;
        if (wi !== orig.widthIn) updates.widthIn = wi;
        if (hi !== orig.heightIn) updates.heightIn = hi;
      }

      if (Object.keys(updates).length > 0) {
        // Map to DB columns for weight/dims
        const dbUpdates: any = {};
        Object.entries(updates).forEach(([k, v]) => {
          if (k === 'weightLb') dbUpdates.weight_lb = v;
          else if (k === 'lengthIn') dbUpdates.length_in = v;
          else if (k === 'widthIn') dbUpdates.width_in = v;
          else if (k === 'heightIn') dbUpdates.height_in = v;
          else {
            // Use updateProduct for standard fields
          }
        });

        // Standard fields via hook
        const stdUpdates: any = { ...updates };
        delete stdUpdates.weightLb;
        delete stdUpdates.lengthIn;
        delete stdUpdates.widthIn;
        delete stdUpdates.heightIn;
        if (Object.keys(stdUpdates).length > 0) updateProduct(p.id, stdUpdates);

        // DB-direct for new columns
        if (Object.keys(dbUpdates).length > 0) {
          supabase.from('orders').update(dbUpdates).eq('id', p.id).then();
        }
      }
    }

    onOpenChange(false);
  };

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pedido — {order.clientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Método de pago</Label>
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div><Label>Referencia de pago</Label><Input value={payRef} onChange={e => setPayRef(e.target.value)} /></div>

          <div><Label>Notas</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>

          {/* Products with per-product calculator */}
          <div className="border-t border-border pt-3 space-y-3">
            <Label className="text-base font-semibold">Productos ({products.length})</Label>
            {products.map((p, idx) => {
              const d = productDims[p.id] || { weightLb: '', lengthIn: '', widthIn: '', heightIn: '', salePriceUsd: '', shippingChargeClient: '', pricesConfirmed: false };
              const calc = productCalcs[p.id];
              const isConfirmed = d.pricesConfirmed;

              return (
                <div key={p.id} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                  {/* Product header */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!!p.arrived}
                      onCheckedChange={(checked) => updateLocalProduct(p.id, 'arrived', !!checked)}
                      className="flex-shrink-0"
                    />
                    <div className="h-14 w-14 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                      {p.productPhoto ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 m-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input value={p.productName} onChange={e => updateLocalProduct(p.id, 'productName', e.target.value)} className={`h-7 text-xs ${p.arrived ? 'line-through opacity-60' : ''}`} />
                    </div>
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">{fmt(p.pricePaid)}</span>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(p.id)} className="h-7 w-7 p-0 text-destructive flex-shrink-0">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Store / price / status row */}
                  <div className="flex gap-1">
                    <Select value={p.store} onValueChange={v => updateLocalProduct(p.id, 'store', v)}>
                      <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" step="0.01" value={p.pricePaid} onChange={e => updateLocalProduct(p.id, 'pricePaid', parseFloat(e.target.value) || 0)} className="h-7 text-xs w-20" placeholder="$" />
                    <Select value={p.status} onValueChange={v => updateLocalProduct(p.id, 'status', v)}>
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRODUCT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Per-product shipping calculator */}
                  {isConfirmed ? (
                    <div className="rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-2 text-xs space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vender:</span>
                        <span className="font-bold text-green-700 dark:text-green-400">{fmt(parseFloat(d.salePriceUsd) || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Envío al cliente:</span>
                        <span className="font-semibold">{fmt(parseFloat(d.shippingChargeClient) || 0)}</span>
                      </div>
                      {exchangeRate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Bs:</span>
                          <span>{((parseFloat(d.salePriceUsd) || 0) + (parseFloat(d.shippingChargeClient) || 0)) * exchangeRate} Bs</span>
                        </div>
                      )}
                      <Button size="sm" variant="ghost" className="h-5 text-[10px] w-full" onClick={() => updateDim(p.id, 'pricesConfirmed', false)}>
                        ✏️ Editar precios
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-md bg-muted/40 border border-border p-2 space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Ruler className="h-3 w-3" /> 📐 Peso y medidas
                      </p>
                      <div className="grid grid-cols-4 gap-1">
                        <div>
                          <label className="text-[9px] text-muted-foreground">Peso (lbs)</label>
                          <Input type="number" step="0.1" value={d.weightLb} onChange={e => updateDim(p.id, 'weightLb', e.target.value)} className="h-6 text-[10px]" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground">Largo</label>
                          <Input type="number" step="0.1" value={d.lengthIn} onChange={e => updateDim(p.id, 'lengthIn', e.target.value)} className="h-6 text-[10px]" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground">Ancho</label>
                          <Input type="number" step="0.1" value={d.widthIn} onChange={e => updateDim(p.id, 'widthIn', e.target.value)} className="h-6 text-[10px]" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground">Alto</label>
                          <Input type="number" step="0.1" value={d.heightIn} onChange={e => updateDim(p.id, 'heightIn', e.target.value)} className="h-6 text-[10px]" placeholder="0" />
                        </div>
                      </div>

                      {calc && (
                        <div className="text-[10px] space-y-0.5 border-t border-border pt-1">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Peso facturable:</span>
                            <span className="font-medium text-foreground">{calc.billable} lbs</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Mi flete:</span>
                            <span className="text-foreground">{fmt(calc.myCost)}</span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <label className="text-[9px] text-muted-foreground">Precio venta $</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={d.salePriceUsd}
                            onChange={e => updateDim(p.id, 'salePriceUsd', e.target.value)}
                            placeholder={calc ? calc.suggestedSaleUsd.toFixed(2) : '0'}
                            className="h-6 text-[10px]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground">Envío cliente $</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={d.shippingChargeClient}
                            onChange={e => updateDim(p.id, 'shippingChargeClient', e.target.value)}
                            placeholder={calc ? calc.clientCharge.toFixed(2) : '0'}
                            className="h-6 text-[10px]"
                          />
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="default"
                        className="h-6 text-[10px] w-full"
                        onClick={() => confirmPrices(p.id)}
                      >
                        <Check className="h-3 w-3 mr-1" /> ✅ Usar estos precios
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ORDER SUMMARY */}
          {products.length > 0 && (
            <div className="border-t-2 border-primary/30 pt-3 space-y-2">
              <p className="text-sm font-bold text-foreground">📋 RESUMEN DEL PEDIDO</p>
              <div className="text-xs space-y-1 font-mono bg-muted/30 rounded-md p-2 border border-border">
                {products.map((p, idx) => {
                  const d = productDims[p.id];
                  const calc = productCalcs[p.id];
                  const sale = d ? (parseFloat(d.salePriceUsd) || calc?.suggestedSaleUsd || 0) : 0;
                  const ship = d ? (parseFloat(d.shippingChargeClient) || calc?.clientCharge || 0) : 0;
                  return (
                    <div key={p.id} className="flex justify-between">
                      <span className="truncate max-w-[60%]">Producto {idx + 1}: {p.productName}</span>
                      <span>Vender {fmt(sale)} + Envío {fmt(ship)}</span>
                    </div>
                  );
                })}
                <div className="border-t border-border mt-1 pt-1 space-y-0.5">
                  <div className="flex justify-between font-bold">
                    <span>Total a cobrarle al cliente:</span>
                    <span>{fmt(summary.totalChargeClient)}</span>
                  </div>
                  {exchangeRate && summary.totalChargeVes > 0 && (
                    <div className="flex justify-between">
                      <span>Total en Bs:</span>
                      <span>{summary.totalChargeVes.toFixed(2)} Bs</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-green-600">
                    <span>Mi ganancia total:</span>
                    <span>{fmt(summary.profit)} ✅</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">Guardar Cambios</Button>
            <Button variant="destructive" onClick={() => { onDeleteOrder(order.id); onOpenChange(false); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
