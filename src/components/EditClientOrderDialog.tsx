import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Package, Check, Save } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { ClientOrder, ClientOrderProduct } from '@/hooks/useClientOrders';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import { useOrders } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';

const ORDER_STATUSES = ['Pendiente', 'En Tránsito', 'Listo', 'Entregado'];
const PAYMENT_METHODS = ['PayPal', 'Binance', 'PagoMóvil', 'Zelle', 'Efectivo', 'Otro'];
const CURRENCIES = ['USD', 'EUR', 'Bs'];

interface ProductDims {
  weightLb: string;
  lengthIn: string;
  widthIn: string;
  heightIn: string;
  salePriceUsd: string;
  shippingChargeClient: string;
  pricesConfirmed: boolean;
  hasExtraCharge: boolean;
  extraChargeCompany: string;
  extraChargeClient: string;
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

function calcShipping(weight: number, l: number, w: number, h: number, myRate: number, clientRate: number) {
  const volWeight = (l && w && h) ? (l * w * h) / 166 : 0;
  const billable = Math.ceil(Math.max(weight, volWeight));
  const myCost = billable * myRate;
  const clientCharge = billable * clientRate;
  return { volWeight, billable, myCost, clientCharge };
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
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
  const [payment, setPayment] = useState('');
  const [payRef, setPayRef] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState<ClientOrderProduct[]>([]);
  const [productDims, setProductDims] = useState<Record<string, ProductDims>>({});

  const myRate = shippingSettings?.airRatePerLb ?? 6.50;
  const clientRate = shippingSettings?.airPricePerLb ?? 10;
  const profitPercent = shippingSettings?.defaultMarginPercent ?? 0.30;

  useEffect(() => {
    if (order && open) {
      setStatus(order.status);
      setPayment(order.paymentMethod);
      setPayRef(order.paymentReference);
      setNotes(order.notes);
      setProducts([...order.products]);
      setCurrency('USD');
      setAmountPaid('');

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
          hasExtraCharge: false,
          extraChargeCompany: '',
          extraChargeClient: '',
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

  const confirmPrices = async (productId: string) => {
    const d = productDims[productId];
    const p = products.find(x => x.id === productId);
    if (!d || !p) return;
    const weight = parseFloat(d.weightLb) || 0;
    const l = parseFloat(d.lengthIn) || 0;
    const w = parseFloat(d.widthIn) || 0;
    const h = parseFloat(d.heightIn) || 0;
    const calc = calcShipping(weight, l, w, h, myRate, clientRate);
    const suggestedSale = p.pricePaid * (1 + profitPercent);
    const saleUsd = parseFloat(d.salePriceUsd) || suggestedSale;
    const extraClient = d.hasExtraCharge ? (parseFloat(d.extraChargeClient) || 0) : 0;
    const shippingClient = (parseFloat(d.shippingChargeClient) || calc.clientCharge) + extraClient;
    const saleVes = exchangeRate ? saleUsd * exchangeRate : 0;

    await supabase.from('orders').update({
      weight_lb: weight || null,
      length_in: l || null,
      width_in: w || null,
      height_in: h || null,
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
    onUpdateOrder(order.id, {
      status,
      paymentMethod: payment,
      paymentReference: payRef,
      notes,
    });

    for (const p of products) {
      const orig = order.products.find(op => op.id === p.id);
      if (!orig) continue;
      const dbUpdates: any = {};
      if (p.productName !== orig.productName) dbUpdates.product_name = p.productName;
      if (p.store !== orig.store) dbUpdates.store = p.store;
      if (p.pricePaid !== orig.pricePaid) dbUpdates.price_paid = p.pricePaid;
      if (p.status !== orig.status) dbUpdates.status = p.status;
      if (p.arrived !== orig.arrived) dbUpdates.arrived = p.arrived;

      const d = productDims[p.id];
      if (d) {
        const wl = parseFloat(d.weightLb) || null;
        const li = parseFloat(d.lengthIn) || null;
        const wi = parseFloat(d.widthIn) || null;
        const hi = parseFloat(d.heightIn) || null;
        if (wl !== orig.weightLb) dbUpdates.weight_lb = wl;
        if (li !== orig.lengthIn) dbUpdates.length_in = li;
        if (wi !== orig.widthIn) dbUpdates.width_in = wi;
        if (hi !== orig.heightIn) dbUpdates.height_in = hi;
      }

      if (Object.keys(dbUpdates).length > 0) {
        supabase.from('orders').update(dbUpdates).eq('id', p.id).then();
      }
    }

    onOpenChange(false);
  };

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border">
          <DialogTitle className="text-base">Editar Pedido — {order.clientName}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-3 space-y-3 max-h-[80vh] overflow-y-auto">
          {/* STATUS + PAYMENT row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Estado</Label>
              <div className="flex flex-wrap gap-1">
                {ORDER_STATUSES.map(s => <Pill key={s} label={s} active={status === s} onClick={() => setStatus(s)} />)}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Pago</Label>
              <div className="flex flex-wrap gap-1">
                {PAYMENT_METHODS.map(m => <Pill key={m} label={m} active={payment === m} onClick={() => setPayment(m)} />)}
              </div>
              <div className="flex gap-1.5 items-center mt-1">
                <Input
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder="Monto"
                  type="number"
                  step="0.01"
                  className="h-7 text-xs w-24"
                />
                {CURRENCIES.map(c => <Pill key={c} label={c} active={currency === c} onClick={() => setCurrency(c)} />)}
              </div>
            </div>
          </div>

          {/* PRODUCTS */}
          {products.map((p) => {
            const d = productDims[p.id] || { weightLb: '', lengthIn: '', widthIn: '', heightIn: '', salePriceUsd: '', shippingChargeClient: '', pricesConfirmed: false, hasExtraCharge: false, extraChargeCompany: '', extraChargeClient: '' };
            const weight = parseFloat(d.weightLb) || 0;
            const l = parseFloat(d.lengthIn) || 0;
            const w = parseFloat(d.widthIn) || 0;
            const h = parseFloat(d.heightIn) || 0;
            const calc = weight > 0 ? calcShipping(weight, l, w, h, myRate, clientRate) : null;

            const extraCompany = d.hasExtraCharge ? (parseFloat(d.extraChargeCompany) || 0) : 0;
            const extraClient = d.hasExtraCharge ? (parseFloat(d.extraChargeClient) || 0) : 0;
            const suggestedSale = p.pricePaid * (1 + profitPercent);
            const saleUsd = parseFloat(d.salePriceUsd) || suggestedSale;
            const shippingClient = (parseFloat(d.shippingChargeClient) || calc?.clientCharge || 0) + extraClient;
            const myShippingCost = (calc?.myCost || 0) + extraCompany;
            const profitAmount = saleUsd + shippingClient - p.pricePaid - myShippingCost;

            return (
              <div key={p.id} className="border border-border rounded-lg overflow-hidden">
                {/* Product header bar */}
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                  <div className="h-8 w-8 rounded bg-muted flex-shrink-0 overflow-hidden">
                    {p.productPhoto ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 m-2 text-muted-foreground" />}
                  </div>
                  <span className="text-sm font-semibold flex-1 truncate">PRODUCTO: {p.productName}</span>
                  <span className="text-sm font-bold text-foreground">{fmt(p.pricePaid)}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(p.id)} className="h-6 w-6 p-0 text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {d.pricesConfirmed ? (
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Precio venta:</span><span className="font-bold text-green-700 dark:text-green-400">{fmt(parseFloat(d.salePriceUsd) || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Envío al cliente:</span><span className="font-semibold">{fmt(parseFloat(d.shippingChargeClient) || 0)}</span></div>
                    {exchangeRate && <div className="flex justify-between"><span className="text-muted-foreground">Total Bs:</span><span>{(((parseFloat(d.salePriceUsd) || 0) + (parseFloat(d.shippingChargeClient) || 0)) * exchangeRate).toFixed(2)} Bs</span></div>}
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] w-full mt-1" onClick={() => updateDim(p.id, 'pricesConfirmed', false)}>✏️ Editar precios</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 divide-x divide-border">
                    {/* LEFT: inputs */}
                    <div className="p-3 space-y-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Peso y medidas</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[9px] text-muted-foreground">Peso (lbs)</label>
                          <Input type="number" step="0.1" value={d.weightLb} onChange={e => updateDim(p.id, 'weightLb', e.target.value)} className="h-7 text-xs" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground">Largo (in)</label>
                          <Input type="number" step="0.1" value={d.lengthIn} onChange={e => updateDim(p.id, 'lengthIn', e.target.value)} className="h-7 text-xs" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground">Ancho (in)</label>
                          <Input type="number" step="0.1" value={d.widthIn} onChange={e => updateDim(p.id, 'widthIn', e.target.value)} className="h-7 text-xs" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground">Alto (in)</label>
                          <Input type="number" step="0.1" value={d.heightIn} onChange={e => updateDim(p.id, 'heightIn', e.target.value)} className="h-7 text-xs" placeholder="0" />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-muted-foreground">¿Cargo adicional de la empresa?</label>
                          <div className="flex gap-1">
                            <Pill label="NO" active={!d.hasExtraCharge} onClick={() => updateDim(p.id, 'hasExtraCharge', false)} />
                            <Pill label="SÍ" active={d.hasExtraCharge} onClick={() => updateDim(p.id, 'hasExtraCharge', true)} />
                          </div>
                        </div>
                        {d.hasExtraCharge && (
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="text-[9px] text-muted-foreground">Empresa cobra $</label>
                              <Input type="number" step="0.01" value={d.extraChargeCompany} onChange={e => updateDim(p.id, 'extraChargeCompany', e.target.value)} className="h-7 text-xs" placeholder="0" />
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground">Cliente paga $</label>
                              <Input type="number" step="0.01" value={d.extraChargeClient} onChange={e => updateDim(p.id, 'extraChargeClient', e.target.value)} className="h-7 text-xs" placeholder="0" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Editable overrides */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border">
                        <div>
                          <label className="text-[9px] text-muted-foreground">Precio venta $</label>
                          <Input type="number" step="0.01" value={d.salePriceUsd} onChange={e => updateDim(p.id, 'salePriceUsd', e.target.value)} placeholder={suggestedSale.toFixed(2)} className="h-7 text-xs" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground">Envío cliente $</label>
                          <Input type="number" step="0.01" value={d.shippingChargeClient} onChange={e => updateDim(p.id, 'shippingChargeClient', e.target.value)} placeholder={calc ? calc.clientCharge.toFixed(2) : '0'} className="h-7 text-xs" />
                        </div>
                      </div>

                      <Button size="sm" className="h-7 text-xs w-full" onClick={() => confirmPrices(p.id)}>
                        <Check className="h-3 w-3 mr-1" /> Confirmar precios
                      </Button>
                    </div>

                    {/* RIGHT: results */}
                    <div className="p-3 space-y-1.5 text-xs">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Resultado</p>
                      {calc ? (
                        <div className="space-y-1">
                          <Row label="Peso facturable:" value={`${calc.billable} lbs`} />
                          <Row label="Flete me cuesta:" value={fmt(myShippingCost)} />
                          <div className="border-t border-border my-1" />
                          <Row label="Precio venta:" value={fmt(saleUsd)} bold />
                          {exchangeRate && <Row label="En Bs:" value={`${(saleUsd * exchangeRate).toFixed(2)} Bs`} />}
                          <div className="border-t border-border my-1" />
                          <Row label="Envío al cliente:" value={fmt(shippingClient)} />
                          <div className="border-t border-border my-1" />
                          <div className="flex justify-between font-bold text-green-600 dark:text-green-400 pt-1">
                            <span>MI GANANCIA:</span>
                            <span>{fmt(profitAmount)} ✅</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-[10px] italic pt-2">Ingresa el peso para ver los cálculos</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Notes + Save */}
          <div className="space-y-2 pt-1">
            <div>
              <Label className="text-[11px] text-muted-foreground">Notas</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 gap-2">
                <Save className="h-4 w-4" /> Guardar todo
              </Button>
              <Button variant="destructive" size="icon" onClick={() => { onDeleteOrder(order.id); onOpenChange(false); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : 'text-muted-foreground'}`}>
      <span>{label}</span>
      <span className={bold ? 'text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  );
}
