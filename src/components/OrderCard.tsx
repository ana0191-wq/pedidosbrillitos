import { useState, useRef, useMemo } from 'react';
import type { Order, MerchandiseOrder, ClientOrder, OrderCategory, PaymentMethod, PaymentCurrency } from '@/types/orders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge, StoreBadge } from '@/components/StatusBadge';
import { PaymentMethodSelector, CurrencySelector } from '@/components/PaymentMethodSelector';
import { Package, Truck, Check, Bell, Trash2, Calendar, Hash, ChevronDown, ChevronUp, ArrowRightLeft, Pencil, Save, X, DollarSign, Ruler } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onUpdate: (id: string, updates: Partial<Order>) => void;
  onDelete: (id: string) => void;
  shippingSettings?: {
    airRatePerLb: number;
    airPricePerLb: number;
  };
}

export function OrderCard({ order, onUpdate, onDelete, shippingSettings }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

  // Inline dimension inputs
  const [dims, setDims] = useState({ weight: '', length: '', width: '', height: '' });

  const myRate = shippingSettings?.airRatePerLb ?? 6.50;
  const clientRate = shippingSettings?.airPricePerLb ?? 10;

  const startEditing = () => {
    setEditData({
      productName: order.productName,
      store: order.store,
      pricePaid: order.pricePaid,
      orderDate: order.orderDate,
      estimatedArrival: order.estimatedArrival,
      orderNumber: order.orderNumber,
      notes: order.notes,
      ...(order.category === 'merchandise' ? {
        unitsOrdered: (order as MerchandiseOrder).unitsOrdered,
        unitsReceived: (order as MerchandiseOrder).unitsReceived,
        pricePerUnit: (order as MerchandiseOrder).pricePerUnit,
        suggestedPrice: (order as MerchandiseOrder).suggestedPrice,
      } : {}),
      ...(order.category === 'client' ? {
        clientName: (order as ClientOrder).clientName,
        shippingCost: (order as ClientOrder).shippingCost,
        amountCharged: (order as ClientOrder).amountCharged,
      } : {}),
    });
    setEditing(true);
  };

  const saveEdits = () => {
    const updates: any = {};
    if (editData.productName !== order.productName) updates.productName = editData.productName;
    if (editData.store !== order.store) updates.store = editData.store;
    if (editData.pricePaid !== order.pricePaid) updates.pricePaid = editData.pricePaid;
    if (editData.orderDate !== order.orderDate) updates.orderDate = editData.orderDate;
    if (editData.estimatedArrival !== order.estimatedArrival) updates.estimatedArrival = editData.estimatedArrival;
    if (editData.orderNumber !== order.orderNumber) updates.orderNumber = editData.orderNumber;
    if (editData.notes !== order.notes) updates.notes = editData.notes;
    if (order.category === 'merchandise') {
      const m = order as MerchandiseOrder;
      if (editData.unitsOrdered !== m.unitsOrdered) updates.unitsOrdered = editData.unitsOrdered;
      if (editData.unitsReceived !== m.unitsReceived) updates.unitsReceived = editData.unitsReceived;
      if (editData.pricePerUnit !== m.pricePerUnit) updates.pricePerUnit = editData.pricePerUnit;
      if (editData.suggestedPrice !== m.suggestedPrice) updates.suggestedPrice = editData.suggestedPrice;
    }
    if (order.category === 'client') {
      const c = order as ClientOrder;
      if (editData.clientName !== c.clientName) updates.clientName = editData.clientName;
      if (editData.shippingCost !== c.shippingCost) updates.shippingCost = editData.shippingCost;
      if (editData.amountCharged !== c.amountCharged) updates.amountCharged = editData.amountCharged;
    }
    if (Object.keys(updates).length > 0) onUpdate(order.id, updates);
    setEditing(false);
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const handleCategoryChange = (newCategory: OrderCategory) => {
    const updates: any = { category: newCategory, status: 'Pendiente' };
    if (newCategory === 'merchandise') {
      updates.unitsOrdered = 1;
      updates.unitsReceived = 0;
      updates.pricePerUnit = order.pricePaid;
    }
    if (newCategory === 'client') {
      updates.clientName = '';
      updates.shippingCost = 0;
      updates.amountCharged = 0;
    }
    onUpdate(order.id, updates);
  };

  // Shipping calc from dims
  const shippingCalc = useMemo(() => {
    const w = parseFloat(dims.weight);
    const l = parseFloat(dims.length);
    const wd = parseFloat(dims.width);
    const h = parseFloat(dims.height);
    if (!w || w <= 0) return null;
    const volWeight = (l && wd && h) ? (l * wd * h) / 166 : 0;
    const billable = Math.max(w, volWeight);
    const roundedBillable = Math.ceil(billable);
    const myCost = roundedBillable * myRate;
    const clientCharge = roundedBillable * clientRate;
    return { volWeight, billable: roundedBillable, myCost, clientCharge, profit: clientCharge - myCost };
  }, [dims, myRate, clientRate]);

  const saveDimsToOrder = () => {
    if (!shippingCalc) return;
    const updates: any = { shippingCost: shippingCalc.myCost };
    if (order.category === 'client') {
      updates.amountCharged = (order as ClientOrder).amountCharged || shippingCalc.clientCharge;
    }
    onUpdate(order.id, updates);
  };

  const isMerch = order.category === 'merchandise';
  const isClient = order.category === 'client';
  const merchOrder = isMerch ? (order as MerchandiseOrder) : null;
  const clientOrder = isClient ? (order as ClientOrder) : null;

  // Inline pricing for merchandise
  const merchPricing = useMemo(() => {
    if (!merchOrder) return null;
    const costPerUnit = merchOrder.pricePerUnit > 0 ? merchOrder.pricePerUnit : order.pricePaid / (merchOrder.unitsOrdered || 1);
    const suggested = merchOrder.suggestedPrice ?? costPerUnit * 1.35;
    return { costPerUnit, suggested };
  }, [merchOrder, order.pricePaid]);

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardContent className="p-0">
        {/* Header row */}
        <div
          className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="h-20 w-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
            {order.productPhoto ? (
              <img src={order.productPhoto} alt={order.productName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground leading-tight text-sm truncate">{order.productName}</h3>
            <div className="flex items-center gap-2 mt-0.5 mb-1">
              <StoreBadge store={order.store} />
              <StatusBadge status={order.status} />
            </div>

            {/* Always-visible pricing */}
            <div className="text-xs space-y-0.5 mt-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Costo:</span>
                <span className="font-semibold text-foreground">{fmt(order.pricePaid)}</span>
              </div>
              {isMerch && merchPricing && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Precio/ud:</span>
                    <span className="text-foreground">{fmt(merchPricing.costPerUnit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vender a:</span>
                    <span className="font-bold text-green-600">{fmt(merchPricing.suggested)}</span>
                  </div>
                </>
              )}
              {isClient && clientOrder && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Envío:</span>
                    <span>{fmt(clientOrder.shippingCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cobrado:</span>
                    <span className="font-bold text-foreground">{fmt(clientOrder.amountCharged)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ganancia:</span>
                    <span className={`font-bold ${(clientOrder.amountCharged - order.pricePaid - clientOrder.shippingCost) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {fmt(clientOrder.amountCharged - order.pricePaid - clientOrder.shippingCost)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 pt-1">
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-border">
            {order.productPhoto && (
              <div className="w-full bg-muted">
                <img src={order.productPhoto} alt={order.productName} className="w-full max-h-80 object-contain mx-auto" />
              </div>
            )}

            <div className="p-4 space-y-3">
              {editing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">✏️ Editando</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" onClick={saveEdits} className="h-7 text-xs">
                        <Save className="h-3 w-3 mr-1" /> Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs">
                        <X className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                    </div>
                  </div>

                  <Input value={editData.productName || ''} onChange={(e) => setEditData(p => ({ ...p, productName: e.target.value }))} placeholder="Nombre del producto" className="h-8 text-sm" />

                  <div className="grid grid-cols-2 gap-2">
                    <Select value={editData.store} onValueChange={(v) => setEditData(p => ({ ...p, store: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tienda" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AliExpress">AliExpress</SelectItem>
                        <SelectItem value="Shein">Shein</SelectItem>
                        <SelectItem value="Temu">Temu</SelectItem>
                        <SelectItem value="Amazon">Amazon</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" step="0.01" value={editData.pricePaid ?? ''} onChange={(e) => setEditData(p => ({ ...p, pricePaid: parseFloat(e.target.value) || 0 }))} placeholder="Precio $" className="h-8 text-xs" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Fecha pedido</label>
                      <Input type="date" value={editData.orderDate || ''} onChange={(e) => setEditData(p => ({ ...p, orderDate: e.target.value }))} className="h-8 text-xs" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Llegada estimada</label>
                      <Input type="date" value={editData.estimatedArrival || ''} onChange={(e) => setEditData(p => ({ ...p, estimatedArrival: e.target.value }))} className="h-8 text-xs" />
                    </div>
                  </div>

                  <Input value={editData.orderNumber || ''} onChange={(e) => setEditData(p => ({ ...p, orderNumber: e.target.value }))} placeholder="# Orden" className="h-8 text-xs" />

                  {order.category === 'merchandise' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid grid-cols-3 gap-2 col-span-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Uds pedidas</label>
                          <Input type="number" min="1" value={editData.unitsOrdered ?? 1} onChange={(e) => setEditData(p => ({ ...p, unitsOrdered: parseInt(e.target.value) || 1 }))} className="h-8 text-xs" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Uds recibidas</label>
                          <Input type="number" min="0" value={editData.unitsReceived ?? 0} onChange={(e) => setEditData(p => ({ ...p, unitsReceived: parseInt(e.target.value) || 0 }))} className="h-8 text-xs" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Precio/ud</label>
                          <Input type="number" step="0.01" value={editData.pricePerUnit ?? ''} onChange={(e) => setEditData(p => ({ ...p, pricePerUnit: parseFloat(e.target.value) || 0 }))} className="h-8 text-xs" />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Precio de venta sugerido $</label>
                        <Input type="number" step="0.01" value={editData.suggestedPrice ?? ''} onChange={(e) => setEditData(p => ({ ...p, suggestedPrice: parseFloat(e.target.value) || null }))} placeholder="Auto-calculado si vacío" className="h-8 text-xs" />
                      </div>
                    </div>
                  )}

                  {order.category === 'client' && (
                    <div className="grid grid-cols-3 gap-2">
                      <Input value={editData.clientName || ''} onChange={(e) => setEditData(p => ({ ...p, clientName: e.target.value }))} placeholder="Cliente" className="h-8 text-xs" />
                      <Input type="number" step="0.01" value={editData.shippingCost ?? ''} onChange={(e) => setEditData(p => ({ ...p, shippingCost: parseFloat(e.target.value) || 0 }))} placeholder="Envío $" className="h-8 text-xs" />
                      <Input type="number" step="0.01" value={editData.amountCharged ?? ''} onChange={(e) => setEditData(p => ({ ...p, amountCharged: parseFloat(e.target.value) || 0 }))} placeholder="Cobrado $" className="h-8 text-xs" />
                    </div>
                  )}

                  <Textarea value={editData.notes || ''} onChange={(e) => setEditData(p => ({ ...p, notes: e.target.value }))} placeholder="Notas..." className="text-xs min-h-[60px]" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground text-base">{order.productName}</h3>
                    <Button size="sm" variant="ghost" onClick={startEditing} className="h-7 text-xs text-muted-foreground">
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  </div>

                  {/* Category change */}
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={order.category} onValueChange={(v) => handleCategoryChange(v as OrderCategory)}>
                      <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">🛍️ Mis Pedidos</SelectItem>
                        <SelectItem value="merchandise">📦 Mercancía</SelectItem>
                        <SelectItem value="client">👤 Clientes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(order.orderDate)}</span>
                    <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {formatDate(order.estimatedArrival)}</span>
                    {order.orderNumber && <span className="flex items-center gap-1 col-span-2"><Hash className="h-3.5 w-3.5" /> {order.orderNumber}</span>}
                  </div>

                  {/* Inline shipping dimensions — always visible if no shipping cost */}
                  {(order.category === 'client' || order.category === 'merchandise') && (
                    <div className="rounded-md bg-muted/40 border border-border p-2.5 space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <Ruler className="h-3.5 w-3.5" /> 📐 Peso y medidas para calcular envío
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Peso (lbs)</label>
                          <Input type="number" step="0.1" value={dims.weight} onChange={(e) => setDims(p => ({ ...p, weight: e.target.value }))} className="h-7 text-xs" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Largo (in)</label>
                          <Input type="number" step="0.1" value={dims.length} onChange={(e) => setDims(p => ({ ...p, length: e.target.value }))} className="h-7 text-xs" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Ancho (in)</label>
                          <Input type="number" step="0.1" value={dims.width} onChange={(e) => setDims(p => ({ ...p, width: e.target.value }))} className="h-7 text-xs" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Alto (in)</label>
                          <Input type="number" step="0.1" value={dims.height} onChange={(e) => setDims(p => ({ ...p, height: e.target.value }))} className="h-7 text-xs" placeholder="0" />
                        </div>
                      </div>

                      {shippingCalc && (
                        <div className="text-xs space-y-1 border-t border-border pt-2">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Peso facturable:</span>
                            <span className="font-medium text-foreground">{shippingCalc.billable} lbs</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Flete para mí:</span>
                            <span className="font-medium text-foreground">{fmt(shippingCalc.myCost)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Cobro al cliente:</span>
                            <span className="font-bold text-foreground">{fmt(shippingCalc.clientCharge)}</span>
                          </div>
                          <div className="flex justify-between border-t border-border pt-1">
                            <span className="text-muted-foreground">Mi ganancia envío:</span>
                            <span className="font-bold text-green-600">{fmt(shippingCalc.profit)} ✅</span>
                          </div>
                          <Button size="sm" variant="outline" onClick={saveDimsToOrder} className="h-6 text-[10px] w-full mt-1">
                            💾 Guardar precios de envío
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {order.notes && <p className="text-sm text-muted-foreground italic">"{order.notes}"</p>}

                  {/* Payment tracking */}
                  <div className="rounded-md bg-muted/30 border border-border p-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Pago</p>
                    <PaymentMethodSelector
                      selected={order.paymentMethod as PaymentMethod || null}
                      onSelect={(m) => onUpdate(order.id, { paymentMethod: m } as any)}
                    />
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.01" placeholder="Monto pagado" defaultValue={order.amountPaid ?? ''} onBlur={(e) => onUpdate(order.id, { amountPaid: parseFloat(e.target.value) || null } as any)} className="h-7 text-xs w-28" />
                      <CurrencySelector
                        selected={order.paymentCurrency as PaymentCurrency || null}
                        onSelect={(c) => onUpdate(order.id, { paymentCurrency: c } as any)}
                      />
                    </div>
                    {order.deliveredAt && (
                      <p className="text-xs text-muted-foreground">✅ Entregado: {new Date(order.deliveredAt).toLocaleDateString('es-ES')}</p>
                    )}
                  </div>
                </>
              )}

              {/* Actions */}
              {!editing && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {order.category === 'personal' && order.status !== 'Entregado' && (
                    <Button size="sm" variant="default" onClick={() => onUpdate(order.id, { status: 'Entregado' })}>
                      <Check className="h-4 w-4 mr-1" /> Entregado
                    </Button>
                  )}
                  {order.category === 'personal' && order.status === 'Pendiente' && (
                    <Button size="sm" variant="secondary" onClick={() => onUpdate(order.id, { status: 'En Tránsito' })}>
                      <Truck className="h-4 w-4 mr-1" /> En Tránsito
                    </Button>
                  )}
                  {order.category === 'merchandise' && order.status !== 'Completo' && (
                    <Button size="sm" variant="default" onClick={() => onUpdate(order.id, { status: 'Completo', unitsReceived: (order as MerchandiseOrder).unitsOrdered } as any)}>
                      <Check className="h-4 w-4 mr-1" /> Completo
                    </Button>
                  )}
                  {order.category === 'client' && order.status !== 'Cliente Notificado' && (
                    <>
                      {order.status !== 'Entregado' && (
                        <Button size="sm" variant="default" onClick={() => onUpdate(order.id, { status: 'Entregado' })}>
                          <Check className="h-4 w-4 mr-1" /> Entregado
                        </Button>
                      )}
                      {order.status === 'Entregado' && (
                        <Button size="sm" variant="secondary" onClick={() => onUpdate(order.id, { status: 'Cliente Notificado' })}>
                          <Bell className="h-4 w-4 mr-1" /> Notificar
                        </Button>
                      )}
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => onDelete(order.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
