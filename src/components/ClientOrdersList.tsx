import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Package, Send, Pencil, Archive, Search, ChevronDown, ChevronUp, Check, Clock, Truck } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import type { ClientOrder } from '@/hooks/useClientOrders';
import type { Client } from '@/hooks/useClients';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import type { Order } from '@/types/orders';
import { AddClientOrderDialog } from '@/components/AddClientOrderDialog';
import { EditClientOrderDialog } from '@/components/EditClientOrderDialog';
import { QuotationGenerator } from '@/components/QuotationGenerator';
import { fmtMoney } from '@/lib/utils';

interface Props {
  clientOrders: ClientOrder[];
  clients: Client[];
  onAddOrder: (clientId: string, data: Partial<ClientOrder>) => Promise<string | null>;
  onAddProduct: (order: Order, clientOrderId?: string) => Promise<void>;
  onUpdateOrder: (id: string, updates: Record<string, any>) => void;
  onDeleteOrder: (id: string) => void;
  onArchiveOrder?: (id: string) => void;
  exchangeRate: number | null;
  shippingSettings?: ShippingSettings;
  collaborators?: { id: string; name: string; percentage: number }[];
  onUpsertEarning?: (collaboratorId: string, orderId: string, anaProfit: number, percentage: number) => void;
}

const FILTERS = [
  { id: 'all',       label: 'Todos' },
  { id: 'pending',   label: 'Pendiente' },
  { id: 'partial',   label: 'Parcial' },
  { id: 'done',      label: 'Completo' },
  { id: 'no-ship',   label: 'Sin envío' },
];

function getFilterKey(order: ClientOrder): string {
  const p1 = order.productPaymentStatus === 'Pagado';
  const p2 = order.shippingPaymentStatus === 'Pagado';
  const hasShip = (order.shippingChargeToClient ?? 0) > 0;
  if (p1 && p2) return 'done';
  if (p1 && !hasShip) return 'no-ship';
  if (p1) return 'partial';
  return 'pending';
}

function calcShipping(order: ClientOrder, settings?: ShippingSettings) {
  const freightRate = settings?.airRatePerLb ?? 6.50;
  const clientRate = settings?.airPricePerLb ?? 10.00;
  let anaPays = 0, clientPays = 0;
  for (const p of order.products) {
    const w = p.weightLb || 0;
    const vol = (p.lengthIn && p.widthIn && p.heightIn) ? (p.lengthIn * p.widthIn * p.heightIn) / 166 : 0;
    const bill = Math.max(w, vol);
    anaPays += bill * freightRate;
    clientPays += bill * clientRate;
  }
  if ((order.shippingChargeToClient ?? 0) > 0) clientPays = order.shippingChargeToClient!;
  if ((order.shippingCostCompany ?? 0) > 0) anaPays = order.shippingCostCompany!;
  return { anaPays, clientPays, profit: clientPays - anaPays };
}

export function ClientOrdersList({
  clientOrders, clients, onAddOrder, onAddProduct,
  onUpdateOrder, onDeleteOrder, onArchiveOrder,
  exchangeRate, shippingSettings, collaborators, onUpsertEarning,
}: Props) {
  const fmt = fmtMoney;
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ClientOrder | null>(null);
  const [quotationData, setQuotationData] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const clientPhoneMap = useMemo(() => {
    const m: Record<string, string> = {};
    clients.forEach(c => { m[c.id] = c.phone || ''; });
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    let list = [...clientOrders];
    if (filter !== 'all') list = list.filter(o => getFilterKey(o) === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.clientName || '').toLowerCase().includes(q) ||
        o.products.some(p => p.productName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [clientOrders, filter, search]);

  // Summary counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: clientOrders.length, pending: 0, partial: 0, done: 0, 'no-ship': 0 };
    clientOrders.forEach(o => { c[getFilterKey(o)] = (c[getFilterKey(o)] || 0) + 1; });
    return c;
  }, [clientOrders]);

  const toggle = (id: string) => setExpanded(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Pedidos de clientes</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Nuevo pedido
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente o producto..."
          className="pl-9 h-9"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:border-primary'
            }`}
          >
            {f.label}
            {counts[f.id] > 0 && (
              <span className={`ml-1.5 ${filter === f.id ? 'opacity-75' : 'text-muted-foreground'}`}>
                {counts[f.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="text-center py-10">
          <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search || filter !== 'all' ? 'Sin resultados' : 'No hay pedidos todavía'}
          </p>
        </div>
      )}

      {/* Orders */}
      <div className="space-y-2">
        {filtered.map(order => {
          const isOpen = expanded.has(order.id);
          const productCost = order.products.reduce((s, p) => s + p.pricePaid, 0);
          const ship = calcShipping(order, shippingSettings);
          const p1 = order.productPaymentStatus === 'Pagado';
          const p2 = order.shippingPaymentStatus === 'Pagado';
          const hasShip = ship.clientPays > 0;
          const fk = getFilterKey(order);

          // Status badge config
          const badge =
            fk === 'done'    ? { label: 'Completo',         cls: 'bg-green-100 text-green-700' } :
            fk === 'partial' ? { label: 'Envío pendiente',  cls: 'bg-blue-100 text-blue-700' } :
            fk === 'no-ship' ? { label: 'Sin envío',        cls: 'bg-orange-100 text-orange-700' } :
                               { label: 'Pendiente',        cls: 'bg-amber-100 text-amber-700' };

          return (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-0">

                {/* Main row — always visible */}
                <button
                  className="w-full p-3.5 text-left hover:bg-muted/20 transition-colors"
                  onClick={() => toggle(order.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Product thumbnails */}
                    <div className="flex -space-x-2 flex-shrink-0">
                      {order.products.slice(0, 3).map((p, i) => (
                        <div
                          key={p.id}
                          className="h-10 w-10 rounded-xl border-2 border-white bg-muted overflow-hidden"
                          style={{ zIndex: 3 - i }}
                        >
                          {p.productPhoto
                            ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" />
                            : <Package className="h-4 w-4 m-3 text-muted-foreground" />
                          }
                        </div>
                      ))}
                      {order.products.length > 3 && (
                        <div className="h-10 w-10 rounded-xl border-2 border-white bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground" style={{ zIndex: 0 }}>
                          +{order.products.length - 3}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{order.clientName || 'Sin cliente'}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.products.length} prod · {fmt(productCost)}
                        {hasShip ? ` + ${fmt(ship.clientPays)} envío` : ''}
                      </p>
                    </div>

                    {/* Right: totals */}
                    <div className="flex-shrink-0 text-right">
                      {ship.profit > 0 && (
                        <p className="text-xs font-semibold text-green-600">{fmt(ship.profit)}</p>
                      )}
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto mt-1" />}
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-border">

                    {/* Products */}
                    <div className="px-3.5 py-2 space-y-1.5">
                      {order.products.map(p => (
                        <div key={p.id} className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                            {p.productPhoto
                              ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" />
                              : <Package className="h-4 w-4 m-2.5 text-muted-foreground" />
                            }
                          </div>
                          <p className="text-xs flex-1 truncate text-foreground">{p.productName}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            p.status === 'Entregado' ? 'bg-green-100 text-green-700' :
                            p.status === 'Llegó' || p.status === 'En Venezuela' ? 'bg-purple-100 text-purple-700' :
                            p.status === 'En Tránsito' ? 'bg-blue-100 text-blue-700' :
                            'bg-muted text-muted-foreground'
                          }`}>{p.status}</span>
                          <span className="text-xs font-semibold flex-shrink-0">{fmt(p.pricePaid)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Payment status */}
                    <div className="px-3.5 pb-2 pt-1 space-y-1 border-t border-border">
                      <div className="flex items-center gap-2">
                        {p1 ? <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" /> : <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                        <span className={`text-xs font-semibold ${p1 ? 'text-green-600' : 'text-amber-600'}`}>
                          Productos: {p1 ? `${fmt(order.productPaymentAmount || productCost)} · ${order.productPaymentMethod || ''}` : `${fmt(productCost)} pendiente`}
                        </span>
                      </div>
                      {hasShip && (
                        <div className="flex items-center gap-2">
                          {p2 ? <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" /> : <Truck className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />}
                          <span className={`text-xs font-semibold ${p2 ? 'text-green-600' : 'text-blue-600'}`}>
                            Envío: {p2 ? `${fmt(order.shippingPaymentAmount || ship.clientPays)} · ${order.shippingPaymentMethod || ''}` : `${fmt(ship.clientPays)} pendiente`}
                          </span>
                        </div>
                      )}
                      {!hasShip && (
                        <p className="text-xs text-orange-500 font-medium">Envío sin calcular aún</p>
                      )}
                      {ship.profit > 0 && order.brotherInvolved && (
                        <p className="text-[10px] text-muted-foreground">
                          Tú: {fmt(ship.profit * 0.70)} · Hermano: {fmt(ship.profit * 0.30)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 px-3.5 pb-3">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={e => { e.stopPropagation(); setEditing(order); }}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={e => {
                          e.stopPropagation();
                          const prods = order.products.map(p => ({ name: p.productName, price: p.pricePaid }));
                          setQuotationData({
                            clientName: order.clientName || '',
                            clientPhone: clientPhoneMap[order.clientId],
                            products: prods,
                            shippingCharge: order.shippingChargeToClient || 0,
                            exchangeRate,
                          });
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" /> Cotizar
                      </Button>
                      {onArchiveOrder && (
                        <ConfirmDeleteDialog
                          title="¿Archivar pedido?"
                          description="El pedido se archiva y deja de aparecer en la lista activa."
                          onConfirm={() => onArchiveOrder(order.id)}
                          trigger={
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-500">
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      )}
                      <ConfirmDeleteDialog
                        title="¿Eliminar este pedido?"
                        onConfirm={() => { onDeleteOrder(order.id); setExpanded(prev => { const s = new Set(prev); s.delete(order.id); return s; }); }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AddClientOrderDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        clients={clients}
        onAddOrder={onAddOrder}
        onAddProduct={onAddProduct}
        exchangeRate={exchangeRate}
        shippingSettings={shippingSettings}
      />

      <EditClientOrderDialog
        open={!!editing}
        onOpenChange={v => { if (!v) setEditing(null); }}
        order={editing}
        onUpdateOrder={onUpdateOrder}
        onDeleteOrder={onDeleteOrder}
        exchangeRate={exchangeRate}
        shippingSettings={shippingSettings}
        collaborators={collaborators}
        onUpsertEarning={onUpsertEarning}
      />

      <QuotationGenerator
        open={!!quotationData}
        onOpenChange={v => { if (!v) setQuotationData(null); }}
        data={quotationData}
      />
    </div>
  );
}
