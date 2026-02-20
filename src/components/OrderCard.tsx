import type { Order, PersonalOrder, MerchandiseOrder, ClientOrder } from '@/types/orders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, StoreBadge } from '@/components/StatusBadge';
import { Package, Truck, Check, Bell, Trash2, Calendar, Hash } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onUpdate: (id: string, updates: Partial<Order>) => void;
  onDelete: (id: string) => void;
}

export function OrderCard({ order, onUpdate, onDelete }: OrderCardProps) {
  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Photo */}
          <div className="relative h-48 w-full sm:h-auto sm:w-40 flex-shrink-0 bg-muted">
            {order.productPhoto ? (
              <img
                src={order.productPhoto}
                alt={order.productName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground leading-tight">{order.productName}</h3>
                <div className="flex gap-2">
                  <StoreBadge store={order.store} />
                  <StatusBadge status={order.status} />
                </div>
              </div>
              <p className="text-lg font-bold text-primary">{formatCurrency(order.pricePaid)}</p>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(order.orderDate)}</span>
              <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {formatDate(order.estimatedArrival)}</span>
              {order.orderNumber && <span className="flex items-center gap-1 col-span-2"><Hash className="h-3.5 w-3.5" /> {order.orderNumber}</span>}
            </div>

            {/* Category-specific fields */}
            {order.category === 'merchandise' && (
              <div className="text-sm space-y-1 rounded-md bg-muted/50 p-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unidades: {(order as MerchandiseOrder).unitsReceived}/{(order as MerchandiseOrder).unitsOrdered}</span>
                  <span className="font-medium">Total: {formatCurrency((order as MerchandiseOrder).pricePerUnit * (order as MerchandiseOrder).unitsOrdered)}</span>
                </div>
              </div>
            )}

            {order.category === 'client' && (
              <div className="text-sm space-y-1 rounded-md bg-muted/50 p-2">
                <p className="font-medium text-foreground">Cliente: {(order as ClientOrder).clientName}</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Envío: {formatCurrency((order as ClientOrder).shippingCost)}</span>
                  <span className="text-muted-foreground">Cobrado: {formatCurrency((order as ClientOrder).amountCharged)}</span>
                </div>
                <p className="font-semibold text-secondary">
                  Ganancia: {formatCurrency((order as ClientOrder).amountCharged - order.pricePaid - (order as ClientOrder).shippingCost)}
                </p>
              </div>
            )}

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
      </CardContent>
    </Card>
  );
}
