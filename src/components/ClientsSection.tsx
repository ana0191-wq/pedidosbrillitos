import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronDown, ChevronUp, Trash2, Package, DollarSign, Phone, Pencil } from 'lucide-react';
import type { Client } from '@/hooks/useClients';
import type { ClientOrder } from '@/hooks/useClientOrders';
import { AddClientOrderDialog } from '@/components/AddClientOrderDialog';
import { EditClientOrderDialog } from '@/components/EditClientOrderDialog';
import { useToast } from '@/hooks/use-toast';

const ORDER_STATUSES = ['Pendiente', 'Pagado', 'En Tránsito', 'Entregado', 'Notificado'];

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
}

export function ClientsSection({
  clients, clientOrders, onAddClient, onDeleteClient,
  onAddOrder, onAddProduct, onUpdateOrder, onDeleteOrder, getOrdersByClient, exchangeRate
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
          const totalCharged = orders.reduce((sum, o) => sum + o.amountCharged, 0);
          const totalCost = orders.reduce((sum, o) => sum + o.products.reduce((s, p) => s + p.pricePaid, 0) + o.shippingCost, 0);

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
                      <p className="text-sm font-semibold text-foreground">{fmt(totalCharged)}</p>
                      <p className={`text-xs font-medium ${(totalCharged - totalCost) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {fmt(totalCharged - totalCost)} ganancia
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
                      orders.map(order => (
                        <Card key={order.id} className="bg-card cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setEditingOrder(order)}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{order.status}</Badge>
                                {order.paymentMethod && <Badge variant="secondary" className="text-xs">{order.paymentMethod}</Badge>}
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

                            {order.products.length > 0 ? (
                              <div className="space-y-1">
                                {order.products.map(p => (
                                  <div key={p.id} className="flex items-center gap-2 text-xs">
                                    <div className="h-6 w-6 rounded bg-muted flex-shrink-0 overflow-hidden">
                                      {p.productPhoto ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" /> : <Package className="h-3 w-3 m-1.5 text-muted-foreground" />}
                                    </div>
                                    <span className="flex-1 truncate text-foreground">{p.productName}</span>
                                    <Badge variant="outline" className="text-[10px] h-4">{p.status}</Badge>
                                    <span className="text-muted-foreground">{p.store}</span>
                                    <span className="font-medium text-foreground">{fmt(p.pricePaid)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Sin productos asignados aún</p>
                            )}

                            <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                              <span className="text-muted-foreground">
                                <DollarSign className="h-3 w-3 inline" /> Envío: {fmt(order.shippingCost)} · Cobrado: {fmt(order.amountCharged)}
                              </span>
                              {exchangeRate && order.amountCharged > 0 && (
                                <span className="text-muted-foreground">
                                  ≈ {(order.amountCharged * exchangeRate).toFixed(2)} Bs
                                </span>
                              )}
                            </div>
                            {order.notes && <p className="text-xs text-muted-foreground">📝 {order.notes}</p>}
                          </CardContent>
                        </Card>
                      ))
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
      />
    </div>
  );
}
