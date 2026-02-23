import { useState } from 'react';
import type { Order, MerchandiseOrder, ClientOrder, OrderCategory } from '@/types/orders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge, StoreBadge } from '@/components/StatusBadge';
import { Package, Truck, Check, Bell, Trash2, Calendar, Hash, ChevronDown, ChevronUp, ArrowRightLeft, Pencil, Save, X } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onUpdate: (id: string, updates: Partial<Order>) => void;
  onDelete: (id: string) => void;
}

export function OrderCard({ order, onUpdate, onDelete }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

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

  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

  const handleCategoryChange = (newCategory: OrderCategory) => {
    const updates: any = { category: newCategory, status: 'Pedido' };
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

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardContent className="p-0">
        {/* Compact header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="h-14 w-14 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
            {order.productPhoto ? (
              <img src={order.productPhoto} alt={order.productName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground leading-tight truncate text-sm">{order.productName}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <StoreBadge store={order.store} />
              <StatusBadge status={order.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <p className="text-lg font-bold text-primary">{formatCurrency(order.pricePaid)}</p>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-border">
            {order.productPhoto && (
              <div className="w-full bg-muted">
                <img src={order.productPhoto} alt={order.productName} className="w-full max-h-80 object-contain mx-auto" />
              </div>
            )}

            <div className="p-4 space-y-3">
              {/* Edit / View toggle */}
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

                  <Input
                    value={editData.productName || ''}
                    onChange={(e) => setEditData(p => ({ ...p, productName: e.target.value }))}
                    placeholder="Nombre del producto"
                    className="h-8 text-sm"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Select value={editData.store} onValueChange={(v) => setEditData(p => ({ ...p, store: v }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Tienda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AliExpress">AliExpress</SelectItem>
                        <SelectItem value="Shein">Shein</SelectItem>
                        <SelectItem value="Temu">Temu</SelectItem>
                        <SelectItem value="Amazon">Amazon</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      value={editData.pricePaid ?? ''}
                      onChange={(e) => setEditData(p => ({ ...p, pricePaid: parseFloat(e.target.value) || 0 }))}
                      placeholder="Precio $"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Fecha pedido</label>
                      <Input
                        type="date"
                        value={editData.orderDate || ''}
                        onChange={(e) => setEditData(p => ({ ...p, orderDate: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Llegada estimada</label>
                      <Input
                        type="date"
                        value={editData.estimatedArrival || ''}
                        onChange={(e) => setEditData(p => ({ ...p, estimatedArrival: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <Input
                    value={editData.orderNumber || ''}
                    onChange={(e) => setEditData(p => ({ ...p, orderNumber: e.target.value }))}
                    placeholder="# Orden"
                    className="h-8 text-xs"
                  />

                  {order.category === 'merchandise' && (
                    <div className="grid grid-cols-3 gap-2">
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
                  )}

                  {order.category === 'client' && (
                    <div className="grid grid-cols-3 gap-2">
                      <Input value={editData.clientName || ''} onChange={(e) => setEditData(p => ({ ...p, clientName: e.target.value }))} placeholder="Cliente" className="h-8 text-xs" />
                      <Input type="number" step="0.01" value={editData.shippingCost ?? ''} onChange={(e) => setEditData(p => ({ ...p, shippingCost: parseFloat(e.target.value) || 0 }))} placeholder="Envío $" className="h-8 text-xs" />
                      <Input type="number" step="0.01" value={editData.amountCharged ?? ''} onChange={(e) => setEditData(p => ({ ...p, amountCharged: parseFloat(e.target.value) || 0 }))} placeholder="Cobrado $" className="h-8 text-xs" />
                    </div>
                  )}

                  <Textarea
                    value={editData.notes || ''}
                    onChange={(e) => setEditData(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Notas..."
                    className="text-xs min-h-[60px]"
                  />
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
                      <SelectTrigger className="h-8 text-xs w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
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

                  {/* Spending detail */}
                  <div className="rounded-md bg-primary/5 border border-primary/20 p-2 text-sm space-y-1">
                    <p className="font-medium text-foreground flex items-center gap-1">💰 Detalle de gasto</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Precio pagado</span>
                      <span className="font-semibold text-foreground">{formatCurrency(order.pricePaid)}</span>
                    </div>
                    {order.category === 'merchandise' && (() => {
                      const m = order as MerchandiseOrder;
                      const shippingBase = 37;
                      const totalProducts = 20;
                      const marginPercent = 0.35;
                      // pricePerUnit should be per-unit; if it equals pricePaid and units > 1, derive it
                      const actualPricePerUnit = (m.pricePerUnit > 0 && m.unitsOrdered > 1 && m.pricePerUnit === order.pricePaid)
                        ? order.pricePaid / m.unitsOrdered
                        : (m.pricePerUnit > 0 ? m.pricePerUnit : order.pricePaid / (m.unitsOrdered || 1));
                      const shippingPerUnit = shippingBase / totalProducts;
                      const costPerUnit = actualPricePerUnit + shippingPerUnit;
                      const suggestedPrice = costPerUnit * (1 + marginPercent);
                      const profitPerUnit = suggestedPrice - costPerUnit;
                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Unidades: {m.unitsReceived}/{m.unitsOrdered}</span>
                            <span className="font-medium">{formatCurrency(order.pricePaid)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Precio/unidad</span>
                            <span>{formatCurrency(actualPricePerUnit)}</span>
                          </div>
                          <div className="border-t border-primary/20 pt-1 mt-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="space-y-1 text-xs flex-1">
                                <p className="font-medium text-foreground flex items-center gap-1">🏷️ Precio sugerido</p>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Costo/ud</span>
                                  <span>{formatCurrency(actualPricePerUnit)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">+ Envío/ud</span>
                                  <span>{formatCurrency(shippingPerUnit)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">+ Margen 35%</span>
                                  <span className="text-green-600">+{formatCurrency(profitPerUnit)}</span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 pl-3 border-l border-primary/20">
                                <p className="text-xs text-muted-foreground">Vender a</p>
                                <p className="text-2xl font-bold text-primary">{formatCurrency(suggestedPrice)}</p>
                                <p className="text-xs text-green-600">+{formatCurrency(profitPerUnit)}/ud</p>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                    {order.category === 'client' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cliente</span>
                          <span className="font-medium text-foreground">{(order as ClientOrder).clientName || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Envío</span>
                          <span>{formatCurrency((order as ClientOrder).shippingCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cobrado al cliente</span>
                          <span>{formatCurrency((order as ClientOrder).amountCharged)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-1">
                          <span className="font-semibold text-foreground">Ganancia</span>
                          <span className={`font-bold ${((order as ClientOrder).amountCharged - order.pricePaid - (order as ClientOrder).shippingCost) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {formatCurrency((order as ClientOrder).amountCharged - order.pricePaid - (order as ClientOrder).shippingCost)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {order.notes && <p className="text-sm text-muted-foreground italic">"{order.notes}"</p>}
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
                  {order.category === 'personal' && order.status === 'Pedido' && (
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
