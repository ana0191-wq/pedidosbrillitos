import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Package, Plus, Pencil, CheckCircle2, Circle } from 'lucide-react';
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
          const totalProductCost = order.products.reduce((s, p) => s + p.pricePaid, 0);
          const isProdPaid = order.productPaymentStatus === 'Pagado';
          const isShipPaid = order.shippingPaymentStatus === 'Pagado';

          return (
            <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setEditingOrder(order)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{order.clientName || clientMap[order.clientId] || 'Sin cliente'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">{order.status}</Badge>
                    </div>
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

                {/* Products */}
                {order.products.length > 0 ? (
                  <div className="space-y-2">
                    {order.products.map(p => (
                      <div key={p.id} className="flex items-center gap-3 text-sm">
                        {p.arrived ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                        <div className="h-12 w-12 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                          {p.productPhoto ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 m-3.5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`block truncate text-foreground font-medium ${p.arrived ? 'line-through opacity-60' : ''}`}>{p.productName}</span>
                          <span className="text-xs text-muted-foreground">{p.store}</span>
                        </div>
                        <span className="font-semibold text-foreground">{fmt(p.pricePaid)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin productos asignados</p>
                )}

                {/* Two-stage payment status */}
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <div className="flex items-center gap-2 text-xs">
                    {isProdPaid ? (
                      <span className="text-green-600 font-medium">✅ Producto pagado: {fmt(order.productPaymentAmount || 0)} ({order.productPaymentMethod || '—'})</span>
                    ) : (
                      <span className="text-amber-600 font-medium">⏳ Producto pendiente de pago</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {isShipPaid ? (
                      <span className="text-green-600 font-medium">✅ Envío pagado: {fmt(order.shippingPaymentAmount || 0)} ({order.shippingPaymentMethod || '—'})</span>
                    ) : (
                      <span className="text-blue-600 font-medium">
                        ⏳ Envío pendiente
                        {order.shippingCostCompany != null && (
                          <span className="text-muted-foreground font-normal ml-2">
                            Yo pago: {fmt(order.shippingCostCompany)} → Cobro: {fmt(order.shippingChargeToClient || 0)} → Ganancia: {fmt((order.shippingChargeToClient || 0) - order.shippingCostCompany)}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {exchangeRate && order.amountCharged > 0 && (
                  <p className="text-xs text-muted-foreground">💱 Total ≈ {(order.amountCharged * exchangeRate).toFixed(2)} Bs</p>
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
