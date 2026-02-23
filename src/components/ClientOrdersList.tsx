import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Package, DollarSign } from 'lucide-react';
import type { ClientOrder } from '@/hooks/useClientOrders';
import type { Client } from '@/hooks/useClients';

const ORDER_STATUSES = ['Pendiente', 'Pagado', 'En Tránsito', 'Entregado', 'Notificado'];

interface ClientOrdersListProps {
  clientOrders: ClientOrder[];
  clients: Client[];
  onUpdateOrder: (id: string, updates: Record<string, any>) => void;
  onDeleteOrder: (id: string) => void;
  exchangeRate: number | null;
}

export function ClientOrdersList({ clientOrders, clients, onUpdateOrder, onDeleteOrder, exchangeRate }: ClientOrdersListProps) {
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const clientMap: Record<string, string> = {};
  clients.forEach(c => { clientMap[c.id] = c.name; });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">📋 Pedidos de Clientes</h2>

      {clientOrders.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No hay pedidos. Crea uno desde la pestaña de Clientes.</CardContent></Card>
      ) : (
        clientOrders.map(order => {
          const totalProductCost = order.products.reduce((s, p) => s + p.pricePaid, 0);
          const profit = order.amountCharged - totalProductCost - order.shippingCost;

          return (
            <Card key={order.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{order.clientName || clientMap[order.clientId] || 'Sin cliente'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">{order.status}</Badge>
                      {order.paymentMethod && <Badge variant="secondary" className="text-xs">{order.paymentMethod}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Select value={order.status} onValueChange={v => onUpdateOrder(order.id, { status: v })}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDeleteOrder(order.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {order.products.length > 0 ? (
                  <div className="space-y-1">
                    {order.products.map(p => (
                      <div key={p.id} className="flex items-center gap-2 text-xs">
                        <div className="h-6 w-6 rounded bg-muted flex-shrink-0 overflow-hidden">
                          {p.productPhoto ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" /> : <Package className="h-3 w-3 m-1.5 text-muted-foreground" />}
                        </div>
                        <span className="flex-1 truncate text-foreground">{p.productName}</span>
                        <span className="text-muted-foreground">{p.store}</span>
                        <span className="font-medium text-foreground">{fmt(p.pricePaid)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin productos asignados</p>
                )}

                <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span><DollarSign className="h-3 w-3 inline" /> Productos: {fmt(totalProductCost)}</span>
                    <span>Envío: {fmt(order.shippingCost)}</span>
                    <span>Cobrado: {fmt(order.amountCharged)}</span>
                  </div>
                  <span className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {fmt(profit)}
                  </span>
                </div>

                {exchangeRate && order.amountCharged > 0 && (
                  <p className="text-xs text-muted-foreground">💱 ≈ {(order.amountCharged * exchangeRate).toFixed(2)} Bs</p>
                )}

                {order.notes && <p className="text-xs text-muted-foreground">📝 {order.notes}</p>}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
