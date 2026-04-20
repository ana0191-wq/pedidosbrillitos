import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronDown, ChevronUp, Phone, Pencil, Package, Check, X, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fmtMoney } from '@/lib/utils';
import type { Client } from '@/hooks/useClients';
import type { ClientOrder } from '@/hooks/useClientOrders';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import type { Order } from '@/types/orders';
import { AddClientOrderDialog } from '@/components/AddClientOrderDialog';
import { EditClientOrderDialog } from '@/components/EditClientOrderDialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

interface Props {
  clients: Client[];
  clientOrders: ClientOrder[];
  onAddClient: (data: Partial<Client>) => Promise<void>;
  onUpdateClient?: (id: string, data: Partial<Client>) => Promise<void>;
  onDeleteClient?: (id: string) => Promise<void>;
  onAddOrder: (clientId: string, data: Partial<ClientOrder>) => Promise<string | null>;
  onAddProduct: (order: Order, clientOrderId?: string) => Promise<void>;
  collaborators?: { id: string; name: string; percentage: number }[];
  onUpsertEarning?: (collaboratorId: string, orderId: string, anaProfit: number, percentage: number) => void;
  onUpdateOrder: (id: string, updates: Record<string, any>) => void;
  onDeleteOrder: (id: string) => void;
  onArchiveOrder?: (id: string) => void;
  getOrdersByClient: (clientId: string) => ClientOrder[];
  exchangeRate: number | null;
  shippingSettings?: ShippingSettings;
}


const RATE_PER_LB = 10;

function calcShippingFromProducts(order: ClientOrder, settings?: ShippingSettings) {
  const freightRate = settings?.airRatePerLb ?? 6.50;
  const clientRate = settings?.airPricePerLb ?? RATE_PER_LB;
  let totalAnaPays = 0;
  let totalClientPays = 0;
  for (const p of order.products) {
    const w = p.weightLb || 0;
    const l = p.lengthIn || 0, wi = p.widthIn || 0, h = p.heightIn || 0;
    const vol = (l && wi && h) ? (l * wi * h) / 166 : 0;
    const bill = Math.max(w, vol);
    totalAnaPays += bill * freightRate;
    totalClientPays += bill * clientRate;
  }
  if (order.shippingChargeToClient && order.shippingChargeToClient > 0) totalClientPays = order.shippingChargeToClient;
  if (order.shippingCostCompany && order.shippingCostCompany > 0) totalAnaPays = order.shippingCostCompany;
  return { totalAnaPays, totalClientPays, profit: totalClientPays - totalAnaPays };
}

function StatusBadge({ order }: { order: ClientOrder }) {
  const p1 = order.productPaymentStatus === 'Pagado';
  const p2 = order.shippingPaymentStatus === 'Pagado';
  if (p1 && p2) return <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Completo</span>;
  if (p1) return <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Envío pendiente</span>;
  return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pendiente</span>;
}

export function ClientsSection({
  clients, clientOrders, onAddClient, onUpdateClient, onDeleteClient,
  onAddOrder, onAddProduct, onUpdateOrder, onDeleteOrder, onArchiveOrder,
  getOrdersByClient, exchangeRate, shippingSettings, collaborators, onUpsertEarning,
}: Props) {
  const { toast } = useToast();
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [addOrderForClient, setAddOrderForClient] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<ClientOrder | null>(null);
  const fmt = fmtMoney;

  const toggleClient = (id: string) => {
    setExpandedClients(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const saveNewClient = async () => {
    if (!newClientName.trim()) return;
    await onAddClient({ name: newClientName.trim(), phone: newClientPhone.trim() || undefined });
    setNewClientName(''); setNewClientPhone(''); setShowAddClient(false);
    toast({ title: 'Cliente agregado' });
  };

  const activeClients = useMemo(() =>
    clients.filter(c => !c.deletedAt).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  if (activeClients.length === 0 && !showAddClient) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">No hay clientes aún</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Agrega tu primer cliente para empezar</p>
          <Button onClick={() => setShowAddClient(true)}>
            <Plus className="h-4 w-4 mr-2" /> Agregar cliente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Clientes</h2>
        <Button size="sm" onClick={() => setShowAddClient(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Nuevo cliente
        </Button>
      </div>

      {/* Add client inline form */}
      {showAddClient && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">Nuevo cliente</p>
            <Input
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              placeholder="Nombre"
              className="h-9"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveNewClient()}
            />
            <Input
              value={newClientPhone}
              onChange={e => setNewClientPhone(e.target.value)}
              placeholder="WhatsApp (opcional)"
              className="h-9"
              type="tel"
            />
            <div className="flex gap-2">
              <Button className="flex-1 h-9" onClick={saveNewClient} disabled={!newClientName.trim()}>
                Guardar
              </Button>
              <Button variant="ghost" className="h-9" onClick={() => { setShowAddClient(false); setNewClientName(''); setNewClientPhone(''); }}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients list */}
      {activeClients.map(client => {
        const orders = getOrdersByClient(client.id);
        const expanded = expandedClients.has(client.id);
        const isEditing = editingClient?.id === client.id;

        // Summary calculations
        let totalProdPaid = 0;
        let totalProdPending = 0;
        let totalShipPending = 0;
        let totalProfit = 0;
        let brotherProfit = 0;
        let anyBrotherInvolved = false;
        let allPaid = orders.length > 0;

        orders.forEach(o => {
          const productCost = o.products.reduce((s, p) => s + p.pricePaid, 0);
          const ship = calcShippingFromProducts(o, shippingSettings);

          if (o.productPaymentStatus === 'Pagado') {
            totalProdPaid += o.productPaymentAmount || productCost;
          } else {
            totalProdPending += productCost;
            allPaid = false;
          }

          if (o.shippingPaymentStatus === 'Pagado') {
            totalProfit += ship.profit;
            if (o.brotherInvolved) { brotherProfit += ship.profit; anyBrotherInvolved = true; }
          } else if (ship.totalClientPays > 0) {
            totalShipPending += ship.totalClientPays;
            totalProfit += ship.profit;
            if (o.brotherInvolved) { brotherProfit += ship.profit; anyBrotherInvolved = true; }
            allPaid = false;
          } else {
            allPaid = false;
          }
        });

        const totalPending = totalProdPending + totalShipPending;

        return (
          <Card key={client.id} className="overflow-hidden">
            <CardContent className="p-0">
              {/* Client row */}
              {isEditing ? (
                <div className="p-4 space-y-2 bg-muted/20">
                  <Input
                    defaultValue={client.name}
                    id={`edit-name-${client.id}`}
                    placeholder="Nombre"
                    className="h-9"
                  />
                  <Input
                    defaultValue={client.phone || ''}
                    id={`edit-phone-${client.id}`}
                    placeholder="WhatsApp"
                    className="h-9"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        const name = (document.getElementById(`edit-name-${client.id}`) as HTMLInputElement)?.value?.trim();
                        const phone = (document.getElementById(`edit-phone-${client.id}`) as HTMLInputElement)?.value?.trim();
                        if (name && onUpdateClient) onUpdateClient(client.id, { name, phone: phone || undefined });
                        setEditingClient(null);
                      }}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Guardar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingClient(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  className="w-full p-4 text-left hover:bg-muted/20 transition-colors"
                  onClick={() => toggleClient(client.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-foreground">{client.name}</p>
                        {orders.length > 0 && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {orders.length} pedido{orders.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Phone className="h-3 w-3" />
                          {client.phone}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      {totalPending > 0 && (
                        <p className="text-sm font-bold text-amber-600">{fmt(totalPending)} pendiente</p>
                      )}
                      {totalProfit > 0 && (
                        <p className="text-xs text-green-600 font-semibold">Ganancia: {fmt(totalProfit)}</p>
                      )}
                      {anyBrotherInvolved && brotherProfit > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          Tú: {fmt(totalProfit - brotherProfit * 0.3)} · Hermano: {fmt(brotherProfit * 0.3)}
                        </p>
                      )}
                      {allPaid && orders.length > 0 && (
                        <p className="text-xs text-green-600 font-semibold">Todo pagado</p>
                      )}
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                  </div>
                </button>
              )}

              {/* Expanded: orders + actions */}
              {expanded && !isEditing && (
                <div className="border-t border-border">
                  {/* Action bar */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted/10">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={() => setAddOrderForClient(client.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Nuevo pedido
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setEditingClient(client); }}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    {onDeleteClient && (
                      <ConfirmDeleteDialog
                        title={`¿Eliminar a ${client.name}?`}
                        description="Se eliminarán también todos sus pedidos."
                        onConfirm={() => onDeleteClient(client.id)}
                        trigger={
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                    )}
                  </div>

                  {/* Orders */}
                  {orders.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">Sin pedidos todavía</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {orders.map(order => {
                        const productCost = order.products.reduce((s, p) => s + p.pricePaid, 0);
                        const ship = calcShippingFromProducts(order, shippingSettings);
                        return (
                          <button
                            key={order.id}
                            className="w-full px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                            onClick={() => setEditingOrder(order)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                {/* Product thumbnails */}
                                {order.products.length > 0 && (
                                  <div className="flex gap-1 mb-1.5">
                                    {order.products.slice(0, 4).map(p => (
                                      <div key={p.id} className="h-8 w-8 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                                        {p.productPhoto
                                          ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" />
                                          : <Package className="h-4 w-4 m-2 text-muted-foreground" />
                                        }
                                      </div>
                                    ))}
                                    {order.products.length > 4 && (
                                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                        +{order.products.length - 4}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <StatusBadge order={order} />
                                  <span className="text-xs text-muted-foreground">
                                    {order.products.length} prod · {fmt(productCost)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {ship.totalClientPays > 0 && order.shippingPaymentStatus !== 'Pagado' && (
                                  <p className="text-xs font-semibold text-blue-600">+ {fmt(ship.totalClientPays)} envío</p>
                                )}
                                {ship.profit > 0 && (
                                  <p className="text-[10px] text-green-600">Gan: {fmt(ship.profit)}</p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Dialogs */}
      <AddClientOrderDialog
        open={!!addOrderForClient}
        onOpenChange={v => { if (!v) setAddOrderForClient(null); }}
        clients={clients}
        onAddClient={async (name, phone) => {
          // ClientsSection's onAddClient has a different signature — wrap it
          let newId: string | null = null;
          await onAddClient({ name, phone: phone || undefined });
          // Re-find the client by name after creation
          return null; // Index will handle ID resolution via onAddOrder
        }}
        onAddOrder={onAddOrder}
        onAddProduct={onAddProduct}
        defaultClientId={addOrderForClient || undefined}
        exchangeRate={exchangeRate}
        shippingSettings={shippingSettings}
      />

      <EditClientOrderDialog
        open={!!editingOrder}
        onOpenChange={v => { if (!v) setEditingOrder(null); }}
        order={editingOrder}
        onUpdateOrder={onUpdateOrder}
        onDeleteOrder={onDeleteOrder}
        exchangeRate={exchangeRate}
        shippingSettings={shippingSettings}
        collaborators={collaborators}
        onUpsertEarning={onUpsertEarning}
      />
    </div>
  );
}