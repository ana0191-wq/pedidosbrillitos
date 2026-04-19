import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronDown, ChevronUp, Trash2, Package, Phone, Pencil, Send, Calendar, Archive } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import type { Client } from '@/hooks/useClients';
import type { ClientOrder } from '@/hooks/useClientOrders';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import { AddClientOrderDialog } from '@/components/AddClientOrderDialog';
import { EditClientOrderDialog } from '@/components/EditClientOrderDialog';
import { EditClientDialog } from '@/components/EditClientDialog';
import { QuotationGenerator } from '@/components/QuotationGenerator';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STORAGE_KEY = 'brillitos_expanded_clients';

function loadExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function saveExpanded(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

interface ClientsSectionProps {
  clients: Client[];
  clientOrders: ClientOrder[];
  onAddClient: (name: string, phone?: string, notes?: string) => Promise<string | null>;
  onUpdateClient?: (id: string, updates: Partial<Pick<Client, 'name' | 'phone' | 'notes'>>) => void;
  onDeleteClient: (id: string) => void;
  onAddOrder: (clientId: string, data: Partial<ClientOrder>) => Promise<string | null>;
  onAddProduct: (order: any, clientOrderId?: string) => Promise<void>;
  onUpdateOrder: (id: string, updates: Record<string, any>) => void;
  onDeleteOrder: (id: string) => void;
  onArchiveOrder?: (id: string) => void;
  getOrdersByClient: (clientId: string) => ClientOrder[];
  exchangeRate: number | null;
  shippingSettings?: ShippingSettings;
}

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

  if (order.shippingChargeToClient && order.shippingChargeToClient > 0) {
    totalClientPays = order.shippingChargeToClient;
  }
  if (order.shippingCostCompany && order.shippingCostCompany > 0) {
    totalAnaPays = order.shippingCostCompany;
  }

  return { totalAnaPays, totalClientPays, profit: totalClientPays - totalAnaPays };
}

function formatDateShort(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    return format(new Date(dateStr), "d MMM yyyy", { locale: es });
  } catch {
    return null;
  }
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function ClientsSection({
  clients, clientOrders, onAddClient, onUpdateClient, onDeleteClient,
  onAddOrder, onAddProduct, onUpdateOrder, onDeleteOrder, onArchiveOrder, getOrdersByClient, exchangeRate, shippingSettings
}: ClientsSectionProps) {
  const { toast } = useToast();
  const [expandedClients, setExpandedClients] = useState<Set<string>>(loadExpanded);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<ClientOrder | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [quotationData, setQuotationData] = useState<any>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      saveExpanded(next);
      return next;
    });
  };

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    await onAddClient(newClientName.trim(), newClientPhone.trim());
    setNewClientName('');
    setNewClientPhone('');
    setShowAddClient(false);
    toast({ title: '✅ Cliente agregado' });
  };

  const handleQuotation = (client: Client, orders: ClientOrder[]) => {
    const products: { name: string; price: number }[] = [];
    let totalShip = 0;

    orders.forEach(o => {
      o.products.forEach(p => products.push({ name: p.productName, price: p.pricePaid }));
      totalShip += o.shippingChargeToClient || 0;
    });

    setQuotationData({
      clientName: client.name,
      clientPhone: client.phone,
      products,
      shippingCharge: totalShip,
      exchangeRate,
    });
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
          const expanded = expandedClients.has(client.id);
          const totalProducts = orders.reduce((sum, o) => sum + o.products.length, 0);

          let totalProdPaid = 0;
          let totalProdAmount = 0;
          let totalShipCharge = 0;
          let totalProfit = 0;
          let allProdPaid = orders.length > 0;
          let allShipPaid = orders.length > 0;
          let anyShipMissing = false;
          let prodMethods: string[] = [];

          orders.forEach(o => {
            const productCost = o.products.reduce((s, p) => s + p.pricePaid, 0);
            totalProdAmount += productCost;

            if (o.productPaymentStatus === 'Pagado') {
              totalProdPaid += o.productPaymentAmount || productCost;
              if (o.productPaymentMethod && !prodMethods.includes(o.productPaymentMethod)) {
                prodMethods.push(o.productPaymentMethod);
              }
            } else {
              allProdPaid = false;
            }

            const ship = calcShippingFromProducts(o, shippingSettings);
            if (o.shippingPaymentStatus === 'Pagado') {
              totalShipCharge += o.shippingPaymentAmount || ship.totalClientPays;
              totalProfit += ship.profit;
            } else if (ship.totalClientPays > 0) {
              allShipPaid = false;
              totalShipCharge += ship.totalClientPays;
              totalProfit += ship.profit;
            } else {
              allShipPaid = false;
              anyShipMissing = true;
            }
          });

          const bothFullyPaid = allProdPaid && allShipPaid && !anyShipMissing;

          return (
            <Card key={client.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Client header — clickable to expand/collapse */}
                <button
                  className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => toggleClient(client.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground text-base">{client.name}</p>
                        {onUpdateClient && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingClient(client); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {client.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>}
                        <span>{orders.length} pedido{orders.length !== 1 ? 's' : ''} · {totalProducts} producto{totalProducts !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {orders.length > 0 && (
                      <div className="text-right text-xs space-y-0.5 flex-shrink-0">
                        {allProdPaid ? (
                          <p className="text-green-600 font-medium">✅ {fmt(totalProdPaid)} pagado · {prodMethods.join(', ') || '—'}</p>
                        ) : (
                          <p className="text-amber-600 font-medium">⏳ Producto: {fmt(totalProdAmount)}</p>
                        )}

                        {bothFullyPaid ? (
                          <>
                            <p className="text-green-600 font-medium">✅ Todo cobrado · Ganancia: {fmt(totalProfit)}</p>
                            {totalProfit > 0 && (
                              <p className="text-[11px] text-muted-foreground">🌸 Tú: {fmt(totalProfit * 0.7)} · 🐒 Hermano: {fmt(totalProfit * 0.3)}</p>
                            )}
                          </>
                        ) : anyShipMissing && totalShipCharge === 0 ? (
                          <p className="text-amber-500 font-medium">⚠️ Envío sin calcular</p>
                        ) : (
                          <>
                            <p className="text-blue-600 font-medium">⏳ Cobrar: {fmt(totalShipCharge)} · Ganancia: {fmt(totalProfit)}</p>
                            {totalProfit > 0 && (
                              <p className="text-[11px] text-muted-foreground">🌸 Tú: {fmt(totalProfit * 0.7)} · 🐒 Hermano: {fmt(totalProfit * 0.3)}</p>
                            )}
                            {exchangeRate && totalShipCharge > 0 && (
                              <p className="text-muted-foreground">≈ {(totalShipCharge * exchangeRate).toLocaleString('es', { maximumFractionDigits: 0 })} Bs</p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t border-border p-4 space-y-2 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Pedidos</span>
                      <div className="flex gap-2">
                        {orders.length > 0 && (
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleQuotation(client, orders); }}>
                            <Send className="h-3 w-3 mr-1" /> Cotización
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setShowAddOrder(client.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Pedido
                        </Button>
                        <ConfirmDeleteDialog
                          onConfirm={() => onDeleteClient(client.id)}
                          title="¿Segura que quieres eliminar este cliente?"
                          trigger={
                            <Button size="sm" variant="ghost" className="text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          }
                        />
                      </div>
                    </div>

                    {orders.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">Sin pedidos</p>
                    ) : (
                      orders.map(order => (
                        <div key={order.id} className="flex items-center gap-2 p-2 rounded-md bg-card border border-border cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setEditingOrder(order)}>
                          <div className="flex-1 min-w-0 space-y-1">
                            {order.products.map(p => {
                              const dateLabel = formatDateShort(p.createdAt);
                              const backfilled = p.createdAt && isToday(p.createdAt) && new Date(p.createdAt).getTime() > Date.now() - 60000;
                              return (
                                <div key={p.id} className="flex items-center gap-2 text-xs">
                                  <div className="h-7 w-7 rounded bg-muted flex-shrink-0 overflow-hidden">
                                    {p.productPhoto ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" /> : <Package className="h-3.5 w-3.5 m-1.5 text-muted-foreground" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className={`truncate text-foreground block ${p.arrived ? 'line-through opacity-60' : ''}`}>
                                      📦 {p.productName}
                                    </span>
                                    <span className="flex items-center gap-1 text-muted-foreground text-[10px]">
                                      <Calendar className="h-2.5 w-2.5" />
                                      {dateLabel ? `📅 ${dateLabel}` : '—'}
                                      {' · '}
                                      {p.status}
                                      {' · '}
                                      {p.store}
                                    </span>
                                  </div>
                                  <span className="text-muted-foreground flex-shrink-0">{fmt(p.pricePaid)}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Badge variant="outline" className="text-[10px]">{order.status}</Badge>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingOrder(order); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {onArchiveOrder && (
                              <ConfirmDeleteDialog
                                onConfirm={() => onArchiveOrder(order.id)}
                                title="¿Archivar este pedido?"
                                description="Se archiva y desaparece de la lista activa."
                                trigger={
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-500" title="Archivar">
                                    <Archive className="h-3 w-3" />
                                  </Button>
                                }
                              />
                            )}
                            <ConfirmDeleteDialog
                              onConfirm={() => onDeleteOrder(order.id)}
                              title="¿Segura que quieres eliminar este pedido?"
                            />
                          </div>
                        </div>
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

      {/* Edit Client Dialog */}
      {onUpdateClient && (
        <EditClientDialog
          open={!!editingClient}
          onOpenChange={(v) => { if (!v) setEditingClient(null); }}
          client={editingClient}
          onUpdate={onUpdateClient}
        />
      )}

      {/* Quotation Generator */}
      <QuotationGenerator
        open={!!quotationData}
        onOpenChange={(v) => { if (!v) setQuotationData(null); }}
        data={quotationData}
      />

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
