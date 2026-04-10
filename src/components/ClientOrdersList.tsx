import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Package, Plus, Pencil } from 'lucide-react';
import type { ClientOrder } from '@/hooks/useClientOrders';
import type { Client } from '@/hooks/useClients';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import { AddClientOrderDialog } from '@/components/AddClientOrderDialog';
import { EditClientOrderDialog } from '@/components/EditClientOrderDialog';

interface ClientOrdersListProps {
  clientOrders: ClientOrder[];
  clients: Client[];
  onAddOrder: (clientId: string, data: Partial<ClientOrder>) => Promise<string | null>;
  onAddProduct: (order: any, clientOrderId?: string) => Promise<void>;
  onUpdateOrder: (id: string, updates: Record<string, any>) => void;
  onDeleteOrder: (id: string) => void;
  exchangeRate: number | null;
  shippingSettings?: ShippingSettings;
}

export function ClientOrdersList({ clientOrders, clients, onAddOrder, onAddProduct, onUpdateOrder, onDeleteOrder, exchangeRate, shippingSettings }: ClientOrdersListProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ClientOrder | null>(null);
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const clientMap: Record<string, string> = {};
  clients.forEach(c => { clientMap[c.id] = c.name; });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">📋 Pedidos de Clientes</h2>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuevo Pedido
        </Button>
      </div>

      <AddClientOrderDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        clients={clients}
        onAddOrder={onAddOrder}
        onAddProduct={onAddProduct}
      />

      <EditClientOrderDialog
        open={!!editingOrder}
        onOpenChange={(v) => { if (!v) setEditingOrder(null); }}
        order={editingOrder}
        onUpdateOrder={onUpdateOrder}
        onDeleteOrder={onDeleteOrder}
        exchangeRate={exchangeRate}
        shippingSettings={shippingSettings}
      />

      {clientOrders.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No hay pedidos. ¡Crea uno!</CardContent></Card>
      ) : (
        clientOrders.map(order => {
          const isProdPaid = order.productPaymentStatus === 'Pagado';
          const isShipPaid = order.shippingPaymentStatus === 'Pagado';
          const shippingProfit = (order.shippingChargeToClient || 0) - (order.shippingCostCompany || 0);

          return (
            <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setEditingOrder(order)}>
              <CardContent className="p-4 space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-foreground">{order.clientName || clientMap[order.clientId] || 'Sin cliente'}</p>
                    <Badge variant="outline" className="text-[10px] mt-0.5">{order.status}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingOrder(order); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteOrder(order.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Products list */}
                {order.products.length > 0 && (
                  <div className="space-y-1">
                    {order.products.map(p => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <div className="h-8 w-8 rounded bg-muted flex-shrink-0 overflow-hidden">
                          {p.productPhoto ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 m-2 text-muted-foreground" />}
                        </div>
                        <span className="flex-1 truncate text-foreground">{p.productName}</span>
                        <span className="font-semibold">{fmt(p.pricePaid)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Two-stage status */}
                <div className="space-y-1 pt-2 border-t border-border text-sm">
                  {/* Stage 1 */}
                  {isProdPaid ? (
                    <p className="text-green-600 font-medium text-xs">
                      ✅ Etapa 1: {fmt(order.productPaymentAmount || 0)} pagado ({order.productPaymentMethod || '—'})
                    </p>
                  ) : (
                    <p className="text-amber-600 font-medium text-xs">⏳ Etapa 1: Producto pendiente de pago</p>
                  )}

                  {/* Stage 2 */}
                  {isShipPaid ? (
                    <p className="text-green-600 font-medium text-xs">
                      ✅ Etapa 2: {fmt(order.shippingPaymentAmount || 0)} pagado ({order.shippingPaymentMethod || '—'})
                    </p>
                  ) : (
                    <div className="text-xs">
                      <p className="text-blue-600 font-medium">
                        ⏳ Etapa 2: Envío {order.shippingChargeToClient ? fmt(order.shippingChargeToClient) : '—'}
                      </p>
                      {order.shippingCostCompany != null && order.shippingCostCompany > 0 && (
                        <p className="text-muted-foreground ml-6">
                          Yo pago: {fmt(order.shippingCostCompany)} → Cobro: {fmt(order.shippingChargeToClient || 0)} → Mi ganancia: <span className="text-green-600 font-semibold">{fmt(shippingProfit)}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {order.notes && <p className="text-xs text-muted-foreground">📝 {order.notes}</p>}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
