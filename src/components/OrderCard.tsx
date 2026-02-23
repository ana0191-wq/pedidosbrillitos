import { useState } from 'react';
import type { Order, MerchandiseOrder, ClientOrder, OrderCategory } from '@/types/orders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge, StoreBadge } from '@/components/StatusBadge';
import { Package, Truck, Check, Bell, Trash2, Calendar, Hash, ChevronDown, ChevronUp, ShoppingBag, Users, ArrowRightLeft } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onUpdate: (id: string, updates: Partial<Order>) => void;
  onDelete: (id: string) => void;
}

export function OrderCard({ order, onUpdate, onDelete }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);

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

  const categoryLabel: Record<OrderCategory, string> = {
    personal: '🛍️ Mis Pedidos',
    merchandise: '📦 Mercancía',
    client: '👤 Clientes',
  };

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardContent className="p-0">
        {/* Compact header - always visible */}
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
              <h3 className="font-semibold text-foreground text-base">{order.productName}</h3>

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
                {order.category === 'merchandise' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unidades: {(order as MerchandiseOrder).unitsReceived}/{(order as MerchandiseOrder).unitsOrdered}</span>
                      <span className="font-medium">{formatCurrency((order as MerchandiseOrder).pricePerUnit * (order as MerchandiseOrder).unitsOrdered)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Precio/unidad</span>
                      <span>{formatCurrency((order as MerchandiseOrder).pricePerUnit)}</span>
                    </div>
                  </>
                )}
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

              {/* Actions */}
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
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
