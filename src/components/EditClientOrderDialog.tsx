import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Package, Check, Save, DollarSign, Truck, AlertTriangle, Send } from 'lucide-react';
import type { ClientOrder, ClientOrderProduct } from '@/hooks/useClientOrders';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import { useOrders } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { QuotationGenerator } from '@/components/QuotationGenerator';

const PAYMENT_METHODS = ['PayPal', 'Binance', 'PagoMóvil', 'Zelle', 'Efectivo', 'Otro'];

interface ProductDims {
  weightLb: string;
  lengthIn: string;
  widthIn: string;
  heightIn: string;
  hasExtraCharge: boolean;
  extraChargeCompany: string;
  extraChargeClient: string;
  pricesConfirmed: boolean;
  shippingChargeClient: string;
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

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
      }`}
    >
      {label}
    </button>
  );
}

export function EditClientOrderDialog({ open, onOpenChange, order, onUpdateOrder, onDeleteOrder, exchangeRate, shippingSettings }: EditClientOrderDialogProps) {
  const { updateOrder: updateProduct, deleteOrder: deleteProduct } = useOrders();
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState<ClientOrderProduct[]>([]);
  const [productDims, setProductDims] = useState<Record<string, ProductDims>>({});

  // Stage 1 payment
  const [prodPayStatus, setProdPayStatus] = useState('Pendiente');
  const [prodPayMethod, setProdPayMethod] = useState('');
  const [prodPayAmount, setProdPayAmount] = useState('');

  // Stage 2 payment
  const [shipPayStatus, setShipPayStatus] = useState('Pendiente');
  const [shipPayMethod, setShipPayMethod] = useState('');
  const [shipPayAmount, setShipPayAmount] = useState('');

  // Editable rates per order
  const [freightRate, setFreightRate] = useState('6.50');
  const [clientShipRate, setClientShipRate] = useState('12.00');

  useEffect(() => {
    if (order && open) {
      setStatus(order.status);
      setNotes(order.notes);
      setProducts([...order.products]);

      setProdPayStatus(order.productPaymentStatus || 'Pendiente');
      setProdPayMethod(order.productPaymentMethod || '');
      setProdPayAmount(order.productPaymentAmount != null ? String(order.productPaymentAmount) : '');

      setShipPayStatus(order.shippingPaymentStatus || 'Pendiente');
      setShipPayMethod(order.shippingPaymentMethod || '');
      setShipPayAmount(order.shippingPaymentAmount != null ? String(order.shippingPaymentAmount) : '');

      setFreightRate(String(shippingSettings?.airRatePerLb ?? 6.50));
      setClientShipRate(String(shippingSettings?.airPricePerLb ?? 12.00));

      const dims: Record<string, ProductDims> = {};
      order.products.forEach(p => {
        dims[p.id] = {
          weightLb: p.weightLb != null ? String(p.weightLb) : '',
          lengthIn: p.lengthIn != null ? String(p.lengthIn) : '',
          widthIn: p.widthIn != null ? String(p.widthIn) : '',
          heightIn: p.heightIn != null ? String(p.heightIn) : '',
          hasExtraCharge: false,
          extraChargeCompany: '',
          extraChargeClient: '',
          pricesConfirmed: p.pricesConfirmed,
          shippingChargeClient: p.shippingChargeClient != null ? String(p.shippingChargeClient) : '',
        };
      });
      setProductDims(dims);
    }
  }, [order, open, shippingSettings]);

  const calcProduct = (p: ClientOrderProduct, d: ProductDims) => {
    const weight = parseFloat(d.weightLb) || 0;
    const l = parseFloat(d.lengthIn) || 0;
    const w = parseFloat(d.widthIn) || 0;
    const h = parseFloat(d.heightIn) || 0;
    const myRate = parseFloat(freightRate) || 6.50;
    const cRate = parseFloat(clientShipRate) || 12;

    const volWeight = (l && w && h) ? (l * w * h) / 166 : 0;
    const billable = Math.max(weight, volWeight);
    const extraCo = d.hasExtraCharge ? (parseFloat(d.extraChargeCompany) || 0) : 0;
    const extraCl = d.hasExtraCharge ? (parseFloat(d.extraChargeClient) || 0) : 0;

    const anaPaysFreight = (billable * myRate) + extraCo;
    const clientPaysShipping = (billable * cRate) + extraCl;
    const anaShippingProfit = clientPaysShipping - anaPaysFreight;

    return { volWeight, billable, anaPaysFreight, clientPaysShipping, anaShippingProfit, extraCo, extraCl };
  };

  const totals = useMemo(() => {
    let totalProductCost = 0;
    let totalAnaPaysFreight = 0;
    let totalClientPaysShipping = 0;

    products.forEach(p => {
      const d = productDims[p.id];
      if (!d) return;
      totalProductCost += p.pricePaid;
      const c = calcProduct(p, d);
      totalAnaPaysFreight += c.anaPaysFreight;
      totalClientPaysShipping += c.clientPaysShipping;
    });

    const totalAnaProfit = totalClientPaysShipping - totalAnaPaysFreight;
    return { totalProductCost, totalAnaPaysFreight, totalClientPaysShipping, totalAnaProfit };
  }, [products, productDims, freightRate, clientShipRate]);

  if (!order) return null;

  const updateDim = (id: string, field: keyof ProductDims, value: any) => {
    setProductDims(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleDeleteProduct = (productId: string) => {
    deleteProduct(productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const confirmPrices = async (productId: string) => {
    const d = productDims[productId];
    const p = products.find(x => x.id === productId);
    if (!d || !p) return;
    const c = calcProduct(p, d);

    await supabase.from('orders').update({
      weight_lb: parseFloat(d.weightLb) || null,
      length_in: parseFloat(d.lengthIn) || null,
      width_in: parseFloat(d.widthIn) || null,
      height_in: parseFloat(d.heightIn) || null,
      sale_price_usd: p.pricePaid,
      sale_price_ves: exchangeRate ? p.pricePaid * exchangeRate : 0,
      shipping_charge_client: c.clientPaysShipping,
      prices_confirmed: true,
    }).eq('id', productId);

    updateDim(productId, 'pricesConfirmed', true);
    updateDim(productId, 'shippingChargeClient', String(c.clientPaysShipping));
  };

  const deriveStatus = (pPay: string, sPay: string) => {
    if (pPay === 'Pagado' && sPay === 'Pagado') return 'Listo';
    if (pPay === 'Pagado') return 'En Tránsito';
    return 'Pendiente';
  };

  const handleSave = () => {
    const finalStatus = status === 'Entregado' ? 'Entregado' : deriveStatus(prodPayStatus, shipPayStatus);

    onUpdateOrder(order.id, {
      status: finalStatus,
      notes,
      productPaymentStatus: prodPayStatus,
      productPaymentAmount: prodPayAmount ? parseFloat(prodPayAmount) : totals.totalProductCost,
      productPaymentMethod: prodPayMethod || null,
      productPaymentDate: prodPayStatus === 'Pagado' ? (order.productPaymentDate || new Date().toISOString()) : null,
      shippingPaymentStatus: shipPayStatus,
      shippingPaymentAmount: shipPayAmount ? parseFloat(shipPayAmount) : totals.totalClientPaysShipping,
      shippingPaymentMethod: shipPayMethod || null,
      shippingPaymentDate: shipPayStatus === 'Pagado' ? (order.shippingPaymentDate || new Date().toISOString()) : null,
      shippingCostCompany: totals.totalAnaPaysFreight || null,
      shippingChargeToClient: totals.totalClientPaysShipping || null,
      amountCharged: totals.totalProductCost + totals.totalClientPaysShipping,
    });

    for (const p of products) {
      const d = productDims[p.id];
      if (!d) continue;
      const dbUpdates: any = {};
      const wl = parseFloat(d.weightLb) || null;
      const li = parseFloat(d.lengthIn) || null;
      const wi = parseFloat(d.widthIn) || null;
      const hi = parseFloat(d.heightIn) || null;
      if (wl !== p.weightLb) dbUpdates.weight_lb = wl;
      if (li !== p.lengthIn) dbUpdates.length_in = li;
      if (wi !== p.widthIn) dbUpdates.width_in = wi;
      if (hi !== p.heightIn) dbUpdates.height_in = hi;

      if (Object.keys(dbUpdates).length > 0) {
        supabase.from('orders').update(dbUpdates).eq('id', p.id).then();
      }
    }

    onOpenChange(false);
  };

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const bothPaid = prodPayStatus === 'Pagado' && shipPayStatus === 'Pagado';
  const myRate = parseFloat(freightRate) || 6.50;
  const cRate = parseFloat(clientShipRate) || 12;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden max-h-[95vh]">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold">Editar Pedido — {order.clientName}</DialogTitle>
            <div className="flex items-center gap-2">
              {bothPaid && status !== 'Entregado' && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStatus('Entregado')}>
                  📦 Marcar Entregado
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { onDeleteOrder(order.id); onOpenChange(false); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(95vh-60px)]">
          {/* ═══ ETAPA 1 — Producto ═══ */}
          <div className={`mx-4 mt-4 rounded-lg border-2 p-4 ${prodPayStatus === 'Pagado' ? 'border-green-500/30 bg-green-50 dark:bg-green-950/20' : 'border-amber-500/30 bg-amber-50 dark:bg-amber-950/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className={`h-4 w-4 ${prodPayStatus === 'Pagado' ? 'text-green-600' : 'text-amber-600'}`} />
              <span className="text-sm font-bold">ETAPA 1 — Producto</span>
              {prodPayStatus === 'Pagado' ? (
                <span className="ml-auto text-xs font-semibold text-green-600">✅ Pagado</span>
              ) : (
                <span className="ml-auto text-xs font-semibold text-amber-600">⏳ Pendiente</span>
              )}
            </div>

            {prodPayStatus === 'Pagado' ? (
              <div className="text-sm pl-6 flex items-center gap-3">
                <span>Pagado: <strong>{fmt(parseFloat(prodPayAmount) || totals.totalProductCost)}</strong> via <strong>{prodPayMethod || '—'}</strong></span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setProdPayStatus('Pendiente')}>✏️ Editar</Button>
              </div>
            ) : (
              <div className="pl-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cliente paga costo del producto: <strong>{fmt(totals.totalProductCost)}</strong>
                  {exchangeRate && <span className="text-muted-foreground"> ≈ {(totals.totalProductCost * exchangeRate).toFixed(2)} Bs</span>}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_METHODS.map(m => <Pill key={m} label={m} active={prodPayMethod === m} onClick={() => setProdPayMethod(m)} />)}
                </div>
                <div className="flex gap-2 items-center">
                  <Input value={prodPayAmount} onChange={e => setProdPayAmount(e.target.value)} placeholder={totals.totalProductCost.toFixed(2)} type="number" step="0.01" className="h-8 text-sm w-32" />
                  <Button size="sm" className="h-8" onClick={() => setProdPayStatus('Pagado')} disabled={!prodPayMethod}>
                    <Check className="h-3 w-3 mr-1" /> Registrar pago
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ═══ PRODUCTS — Shipping Calculator ═══ */}
          {products.map((p) => {
            const d = productDims[p.id] || { weightLb: '', lengthIn: '', widthIn: '', heightIn: '', hasExtraCharge: false, extraChargeCompany: '', extraChargeClient: '', pricesConfirmed: false, shippingChargeClient: '' };
            const c = calcProduct(p, d);
            const hasWeight = (parseFloat(d.weightLb) || 0) > 0;
            const isNegative = c.anaShippingProfit < 0 && hasWeight;

            return (
              <div key={p.id} className="mx-4 mt-4 border border-border rounded-lg overflow-hidden">
                {/* Product header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border-b border-border">
                  <div className="h-10 w-10 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                    {p.productPhoto ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 m-2.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.productName}</p>
                    <p className="text-xs text-muted-foreground">{p.store}</p>
                  </div>
                  <span className="text-lg font-bold">{fmt(p.pricePaid)}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(p.id)} className="h-7 w-7 p-0 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {d.pricesConfirmed ? (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 flex items-center justify-between">
                    <div className="text-sm space-y-0.5">
                      <p>Cobrar envío: <strong className="text-green-700 dark:text-green-400">{fmt(parseFloat(d.shippingChargeClient) || 0)}</strong></p>
                      <p className="text-xs text-muted-foreground">Precios confirmados ✅</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => updateDim(p.id, 'pricesConfirmed', false)}>✏️ Editar</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 divide-x divide-border">
                    {/* LEFT — Inputs */}
                    <div className="p-4 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ETAPA 2 — Calcular Envío</p>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground font-medium">Peso real (lbs)</label>
                          <Input type="number" step="0.1" value={d.weightLb} onChange={e => updateDim(p.id, 'weightLb', e.target.value)} className="h-8 text-sm" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground font-medium">Largo (in)</label>
                          <Input type="number" step="0.1" value={d.lengthIn} onChange={e => updateDim(p.id, 'lengthIn', e.target.value)} className="h-8 text-sm" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground font-medium">Ancho (in)</label>
                          <Input type="number" step="0.1" value={d.widthIn} onChange={e => updateDim(p.id, 'widthIn', e.target.value)} className="h-8 text-sm" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground font-medium">Alto (in)</label>
                          <Input type="number" step="0.1" value={d.heightIn} onChange={e => updateDim(p.id, 'heightIn', e.target.value)} className="h-8 text-sm" placeholder="0" />
                        </div>
                      </div>

                      {/* Extra charges */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">¿Cargo extra de la empresa?</span>
                          <div className="flex gap-1">
                            <Pill label="NO" active={!d.hasExtraCharge} onClick={() => updateDim(p.id, 'hasExtraCharge', false)} />
                            <Pill label="SÍ" active={d.hasExtraCharge} onClick={() => updateDim(p.id, 'hasExtraCharge', true)} />
                          </div>
                        </div>
                        {d.hasExtraCharge && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground font-medium">Empresa cobra $</label>
                              <Input type="number" step="0.01" value={d.extraChargeCompany} onChange={e => updateDim(p.id, 'extraChargeCompany', e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground font-medium">Tú cobras al cliente $</label>
                              <Input type="number" step="0.01" value={d.extraChargeClient} onChange={e => updateDim(p.id, 'extraChargeClient', e.target.value)} className="h-8 text-sm" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Editable rates */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                        <div>
                          <label className="text-[10px] text-muted-foreground font-medium">Tarifa empresa $/lb</label>
                          <Input type="number" step="0.01" value={freightRate} onChange={e => setFreightRate(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground font-medium">Tarifa cliente $/lb</label>
                          <Input type="number" step="0.01" value={clientShipRate} onChange={e => setClientShipRate(e.target.value)} className="h-8 text-sm" />
                        </div>
                      </div>

                      <Button size="sm" className="w-full h-8 text-xs mt-2" onClick={() => confirmPrices(p.id)} disabled={!hasWeight}>
                        <Check className="h-3 w-3 mr-1" /> ✅ Confirmar precios
                      </Button>
                    </div>

                    {/* RIGHT — Live Result Card */}
                    <div className="p-4 flex flex-col">
                      {hasWeight ? (
                        <div className="flex-1 flex flex-col gap-3">
                          {/* CLIENT PAYS — big pink */}
                          <div className="rounded-xl border-2 border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-950/30 p-4 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 mb-1">CLIENTE PAGA</p>
                            <p className="text-3xl font-black text-pink-700 dark:text-pink-300">{fmt(c.clientPaysShipping)}</p>
                            <div className="text-[10px] text-muted-foreground mt-2 space-y-0.5 text-left">
                              <p>Flete empresa: {c.billable.toFixed(1)} lbs × ${myRate.toFixed(2)}</p>
                              <p>Tu comisión: {c.billable.toFixed(1)} lbs × ${(cRate - myRate).toFixed(2)}</p>
                              {c.extraCl > 0 && <p>Extra: +{fmt(c.extraCl)}</p>}
                            </div>
                          </div>

                          {/* YOUR PROFIT — big green or red */}
                          <div className={`rounded-xl border-2 p-4 text-center ${
                            isNegative
                              ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
                              : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
                          }`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {isNegative ? '⚠️ PERDERÍAS DINERO' : 'TU GANANCIA'}
                            </p>
                            <p className={`text-3xl font-black ${isNegative ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                              {fmt(c.anaShippingProfit)} {!isNegative && '✅'}
                            </p>
                            <div className="text-[10px] text-muted-foreground mt-2 space-y-0.5 text-left">
                              <p>Por peso: {c.billable.toFixed(1)} × ${(cRate - myRate).toFixed(2)} = {fmt(c.billable * (cRate - myRate))}</p>
                              {(c.extraCo > 0 || c.extraCl > 0) && (
                                <p>Por extra: {fmt(c.extraCl)} − {fmt(c.extraCo)} = {fmt(c.extraCl - c.extraCo)}</p>
                              )}
                            </div>
                          </div>

                          <p className="text-[10px] text-muted-foreground text-center">
                            Peso facturable: {c.billable.toFixed(1)} lbs
                            {c.volWeight > 0 && <span> (Vol: {c.volWeight.toFixed(1)} · Real: {(parseFloat(d.weightLb) || 0).toFixed(1)})</span>}
                          </p>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-sm text-muted-foreground italic">Ingresa el peso para calcular</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ═══ ETAPA 2 — Pago del envío ═══ */}
          <div className={`mx-4 mt-4 rounded-lg border-2 p-4 ${shipPayStatus === 'Pagado' ? 'border-green-500/30 bg-green-50 dark:bg-green-950/20' : 'border-blue-500/30 bg-blue-50 dark:bg-blue-950/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Truck className={`h-4 w-4 ${shipPayStatus === 'Pagado' ? 'text-green-600' : 'text-blue-600'}`} />
              <span className="text-sm font-bold">ETAPA 2 — Pago del Envío</span>
              {shipPayStatus === 'Pagado' ? (
                <span className="ml-auto text-xs font-semibold text-green-600">✅ Pagado</span>
              ) : (
                <span className="ml-auto text-xs font-semibold text-blue-600">⏳ Pendiente</span>
              )}
            </div>

            {shipPayStatus === 'Pagado' ? (
              <div className="text-sm pl-6 space-y-1">
                <p>Cliente pagó: <strong>{fmt(parseFloat(shipPayAmount) || totals.totalClientPaysShipping)}</strong> via <strong>{shipPayMethod || '—'}</strong></p>
                <p className="text-muted-foreground text-xs">Yo pagué empresa: {fmt(totals.totalAnaPaysFreight)}</p>
                <p className="text-green-600 font-semibold text-xs">Mi ganancia envío: {fmt(totals.totalAnaProfit)} ✅</p>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShipPayStatus('Pendiente')}>✏️ Editar</Button>
              </div>
            ) : (
              <div className="pl-6 space-y-3">
                <div className="text-sm space-y-0.5">
                  <p className="text-muted-foreground">Cobrar al cliente: <strong className="text-foreground">{fmt(totals.totalClientPaysShipping)}</strong></p>
                  <p className="text-muted-foreground text-xs">Yo pago a empresa: {fmt(totals.totalAnaPaysFreight)} → Mi ganancia: <span className="text-green-600 font-semibold">{fmt(totals.totalAnaProfit)}</span></p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_METHODS.map(m => <Pill key={m} label={m} active={shipPayMethod === m} onClick={() => setShipPayMethod(m)} />)}
                </div>
                <div className="flex gap-2 items-center">
                  <Input value={shipPayAmount} onChange={e => setShipPayAmount(e.target.value)} placeholder={totals.totalClientPaysShipping.toFixed(2)} type="number" step="0.01" className="h-8 text-sm w-32" />
                  <Button size="sm" className="h-8" onClick={() => setShipPayStatus('Pagado')} disabled={!shipPayMethod}>
                    💰 Registrar pago envío
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Status badges */}
          {bothPaid && status !== 'Entregado' && (
            <div className="mx-4 mt-4 rounded-lg border-2 border-green-500/50 bg-green-50 dark:bg-green-950/20 p-4 text-center space-y-2">
              <p className="text-sm font-bold text-green-700 dark:text-green-400">🎉 Ambos pagos completados — Listo para entregar</p>
              <Button size="sm" onClick={() => setStatus('Entregado')} className="bg-green-600 hover:bg-green-700 text-white">
                📦 Marcar como Entregado
              </Button>
            </div>
          )}

          {status === 'Entregado' && (
            <div className="mx-4 mt-4 rounded-lg border-2 border-green-500/50 bg-green-50 dark:bg-green-950/20 p-4 text-center">
              <p className="text-sm font-bold text-green-700 dark:text-green-400">📦 Entregado ✅</p>
            </div>
          )}

          {/* Notes + Quotation + Save */}
          <div className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Notas</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-sm" />
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                const products = order.products.map(p => ({ name: p.productName, price: p.pricePaid }));
                const shipCharge = totals.totalClientPaysShipping;
                setQuotationData({ clientName: order.clientName || '', products, shippingCharge: shipCharge, exchangeRate });
              }}
            >
              <Send className="h-4 w-4" /> 📤 Generar cotización
            </Button>
            <Button onClick={handleSave} className="w-full gap-2" size="lg">
              <Save className="h-4 w-4" /> 💾 Guardar todo
            </Button>
          </div>

          <QuotationGenerator
            open={!!quotationData}
            onOpenChange={(v) => { if (!v) setQuotationData(null); }}
            data={quotationData}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
