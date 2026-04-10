import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronDown, ChevronUp, Trash2, Package, Phone, Pencil } from 'lucide-react';
import type { Client } from '@/hooks/useClients';
import type { ClientOrder } from '@/hooks/useClientOrders';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import { AddClientOrderDialog } from '@/components/AddClientOrderDialog';
import { EditClientOrderDialog } from '@/components/EditClientOrderDialog';
import { useToast } from '@/hooks/use-toast';

interface ClientsSectionProps {
  clients: Client[];
  clientOrders: ClientOrder[];
  onAddClient: (name: string, phone?: string, notes?: string) => Promise<string | null>;
  onDeleteClient: (id: string) => void;
  onAddOrder: (clientId: string, data: Partial<ClientOrder>) => Promise<string | null>;
  onAddProduct: (order: any, clientOrderId?: string) => Promise<void>;
  onUpdateOrder: (id: string, updates: Record<string, any>) => void;
  onDeleteOrder: (id: string) => void;
  getOrdersByClient: (clientId: string) => ClientOrder[];
  exchangeRate: number | null;
  shippingSettings?: ShippingSettings;
}

// Compute shipping from saved product data
function calcShippingFromProducts(order: ClientOrder, settings?: ShippingSettings) {
  const freightRate = settings?.airRatePerLb ?? 6.50;
  const clientRate = settings?.airPricePerLb ?? 12.00;

  let totalAnaPays = 0;
  let totalClientPays = 0;

  for (const p of order.products) {
    const weight = p.weightLb || 0;
    const l = p.lengthIn || 0;
    const w = p.widthIn || 0;
    const h = p.heightIn || 0;
    const volWeight = (l && w && h) ? (l * w * h) / 166 : 0;
    const billable = Math.max(weight, volWeight);
    totalAnaPays += billable * freightRate;
    totalClientPays += billable * clientRate;
  }

  // Use saved values if available, otherwise use calculated
  if (order.shippingChargeToClient && order.shippingChargeToClient > 0) {
    totalClientPays = order.shippingChargeToClient;
  }
  if (order.shippingCostCompany && order.shippingCostCompany > 0) {
    totalAnaPays = order.shippingCostCompany;
  }

  return { totalAnaPays, totalClientPays, profit: totalClientPays - totalAnaPays };
}

export function ClientsSection({
  clients, clientOrders, onAddClient, onDeleteClient,
  onAddOrder, onAddProduct, onUpdateOrder, onDeleteOrder, getOrdersByClient, exchangeRate, shippingSettings
}: ClientsSectionProps) {
  const { toast } = useToast();
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<ClientOrder | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    await onAddClient(newClientName.trim(), newClientPhone.trim());
    setNewClientName('');
    setNewClientPhone('');
    setShowAddClient(false);
    toast({ title: '✅ Cliente agregado' });
  };

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">👤 Clientes</h2>
        <Button onClick={() => setShowAddClient(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuevo Cliente
        </Button>
      </div>

      {exchangeRate && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5">
          💱 Tasa BCV: <span className="font-semibold text-foreground">{exchangeRate.toFixed(2)} Bs/€</span>
        </div>
      )}

      {clients.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No hay clientes. ¡Agrega el primero!</CardContent></Card>
      ) : (
        clients.map(client => {
          const orders = getOrdersByClient(client.id);
          const expanded = expandedClient === client.id;
          const totalProducts = orders.reduce((sum, o) => sum + o.products.length, 0);

          // Calculate real totals
          const totalProductCost = orders.reduce((sum, o) => sum + o.products.reduce((s, p) => s + p.pricePaid, 0), 0);
          let totalClientShipping = 0;
          let totalProfit = 0;
          orders.forEach(o => {
            const ship = calcShippingFromProducts(o, shippingSettings);
            totalClientShipping += ship.totalClientPays;
            totalProfit += ship.profit;
          });
          const totalCharged = totalProductCost + totalClientShipping;

          return (
            <Card key={client.id} className="overflow-hidden">
              <CardContent className="p-0">
                <button
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedClient(expanded ? null : client.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{client.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {client.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>}
                      <span>{orders.length} pedido{orders.length !== 1 ? 's' : ''}</span>
                      <span>{totalProducts} producto{totalProducts !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{fmt(totalCharged)} total</p>
                      <p className={`text-xs font-medium ${totalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {fmt(totalProfit)} tu ganancia {totalProfit >= 0 ? '✅' : ''}
                      </p>
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border p-4 space-y-3 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Pedidos</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowAddOrder(client.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Pedido
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDeleteClient(client.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {orders.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">Sin pedidos</p>
                    ) : (
                      orders.map(order => {
                        const ship = calcShippingFromProducts(order, shippingSettings);
                        const isProdPaid = order.productPaymentStatus === 'Pagado';
                        const isShipPaid = order.shippingPaymentStatus === 'Pagado';
                        const productCost = order.products.reduce((s, p) => s + p.pricePaid, 0);
                        const hasShippingData = ship.totalClientPays > 0;

                        return (
                          <Card key={order.id} className="bg-card cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setEditingOrder(order)}>
                            <CardContent className="p-3 space-y-2">
                              {/* Products */}
                              {order.products.length > 0 ? (
                                <div className="space-y-1.5">
                                  {order.products.map(p => (
                                    <div key={p.id} className="flex items-center gap-2 text-sm">
                                      <div className="h-10 w-10 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                                        {p.productPhoto ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 m-3 text-muted-foreground" />}
                                      </div>
                                      <span className={`flex-1 truncate text-foreground text-xs ${p.arrived ? 'line-through opacity-60' : ''}`}>
                                        📦 {p.productName}
                                      </span>
                                      <span className="font-semibold text-xs">{fmt(p.pricePaid)} · {p.store}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Sin productos</p>
                              )}

                              {/* Two-stage summary */}
                              <div className="space-y-1 pt-2 border-t border-border text-xs">
                                {/* Stage 1 */}
                                {isProdPaid ? (
                                  <p className="text-green-600 font-medium">
                                    ✅ Etapa 1  {fmt(order.productPaymentAmount || productCost)} pagado · {order.productPaymentMethod || '—'}
                                  </p>
                                ) : (
                                  <p className="text-amber-600 font-medium">⏳ Etapa 1  Producto pendiente · {fmt(productCost)}</p>
                                )}

                                {/* Stage 2 */}
                                {isShipPaid ? (
                                  <p className="text-green-600 font-medium">
                                    ✅ Etapa 2  {fmt(order.shippingPaymentAmount || ship.totalClientPays)} pagado · {order.shippingPaymentMethod || '—'}
                                  </p>
                                ) : hasShippingData ? (
                                  <p className="text-blue-600 font-medium">
                                    ⏳ Etapa 2  Cobrar {fmt(ship.totalClientPays)} envío · Ganancia {fmt(ship.profit)}
                                    {exchangeRate && <span className="text-muted-foreground"> ≈ {(ship.totalClientPays * exchangeRate).toFixed(0)} Bs</span>}
                                  </p>
                                ) : (
                                  <p className="text-amber-500 font-medium">⚠️ Envío sin calcular · <span className="underline">Calcular</span></p>
                                )}
                              </div>

                              {/* Action row */}
                              <div className="flex items-center justify-between pt-1">
                                <Badge variant="outline" className="text-[10px]">{order.status}</Badge>
                                <div className="flex items-center gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingOrder(order); }}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteOrder(order.id); }}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              {order.notes && <p className="text-[10px] text-muted-foreground">📝 {order.notes}</p>}
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Add Client Dialog */}
      <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre *</Label><Input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre del cliente" /></div>
            <div><Label>Teléfono</Label><Input value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} placeholder="+58..." /></div>
            <Button onClick={handleAddClient} className="w-full" disabled={!newClientName.trim()}>Agregar Cliente</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Order Dialog */}
      <AddClientOrderDialog
        open={!!showAddOrder}
        onOpenChange={(v) => { if (!v) setShowAddOrder(null); }}
        clients={clients}
        onAddOrder={onAddOrder}
        onAddProduct={onAddProduct}
        defaultClientId={showAddOrder || undefined}
      />

      {/* Edit Order Dialog */}
      <EditClientOrderDialog
        open={!!editingOrder}
        onOpenChange={(v) => { if (!v) setEditingOrder(null); }}
        order={editingOrder}
        onUpdateOrder={onUpdateOrder}
        onDeleteOrder={onDeleteOrder}
        exchangeRate={exchangeRate}
        shippingSettings={shippingSettings}
      />
    </div>
  );
}
