import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Package, Search, MessageCircle, ChevronRight, CheckCircle2, Clock, Truck, X, Trash2, Check, Pencil } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { AddClientOrderDialog } from '@/components/AddClientOrderDialog';
import { EditClientOrderDialog } from '@/components/EditClientOrderDialog';
import { QuotationGenerator } from '@/components/QuotationGenerator';
import { fmtMoney } from '@/lib/utils';
import type { ClientOrder } from '@/hooks/useClientOrders';
import type { Client } from '@/hooks/useClients';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import type { Order } from '@/types/orders';

interface Props {
  clientOrders: ClientOrder[];
  clients: Client[];
  onAddClient?: (name: string, phone?: string) => Promise<string | null>;
  onAddOrder: (clientId: string, data: Partial<ClientOrder>) => Promise<string | null>;
  onAddProduct: (order: Order, clientOrderId?: string) => Promise<void>;
  onUpdateOrder: (id: string, updates: Record<string, any>) => void;
  onDeleteOrder: (id: string) => void;
  onToggleDelivered?: (productId: string, delivered: boolean) => Promise<void>;
  onArchiveOrder?: (id: string) => void;
  exchangeRate: number | null;
  shippingSettings?: ShippingSettings;
  collaborators?: { id: string; name: string; percentage: number }[];
  onUpsertEarning?: (collaboratorId: string, orderId: string, anaProfit: number, percentage: number) => void;
}

const FILTERS = [
  { id: 'all',     label: 'Todos' },
  { id: 'pending', label: 'Pendiente' },
  { id: 'partial', label: 'Envío pendiente' },
  { id: 'done',    label: 'Completo' },
];

const STORE_COLORS: Record<string, string> = {
  Shein:      'bg-black text-white',
  Temu:       'bg-orange-500 text-white',
  Amazon:     'bg-amber-400 text-black',
  AliExpress: 'bg-red-500 text-white',
  Otro:       'bg-muted text-muted-foreground',
};

function getFilterKey(o: ClientOrder) {
  const p1 = o.productPaymentStatus === 'Pagado';
  const p2 = o.shippingPaymentStatus === 'Pagado';
  const hasShip = (o.shippingChargeToClient ?? 0) > 0;
  if (p1 && (p2 || !hasShip)) return 'done';
  if (p1) return 'partial';
  return 'pending';
}

function calcShipping(o: ClientOrder, s?: ShippingSettings) {
  const fr = s?.airRatePerLb ?? 6.50;
  const cr = s?.airPricePerLb ?? 10.00;
  let anaPays = 0, clientPays = 0;
  for (const p of o.products) {
    const w = p.weightLb || 0;
    const vol = (p.lengthIn && p.widthIn && p.heightIn) ? (p.lengthIn * p.widthIn * p.heightIn) / 166 : 0;
    const bill = Math.max(w, vol);
    anaPays += bill * fr;
    clientPays += bill * cr;
  }
  if ((o.shippingChargeToClient ?? 0) > 0) clientPays = o.shippingChargeToClient!;
  if ((o.shippingCostCompany ?? 0) > 0) anaPays = o.shippingCostCompany!;
  return { anaPays, clientPays, profit: clientPays - anaPays };
}

const STATUS_CONFIG = {
  done:    { label: 'Completo',        icon: CheckCircle2, cls: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
  partial: { label: 'Envío pendiente', icon: Truck,        cls: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  pending: { label: 'Pendiente',       icon: Clock,        cls: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200' },
};

export function ClientOrdersList({
  clientOrders, clients, onAddClient, onAddOrder, onAddProduct,
  onUpdateOrder, onDeleteOrder, onArchiveOrder,
  exchangeRate, shippingSettings, collaborators, onUpsertEarning, onToggleDelivered,
}: Props) {
  const fmt = fmtMoney;
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ClientOrder | null>(null);
  const [quotationData, setQuotationData] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: clientOrders.length, pending: 0, partial: 0, done: 0 };
    clientOrders.forEach(o => { const k = getFilterKey(o); c[k] = (c[k] || 0) + 1; });
    return c;
  }, [clientOrders]);

  const filtered = useMemo(() => {
    let list = [...clientOrders].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
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

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Pedidos</h2>
          <p className="text-xs text-muted-foreground">{clientOrders.length} pedido{clientOrders.length !== 1 ? 's' : ''} en total</p>
        </div>
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
        {search && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
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
              <span className={`ml-1.5 ${filter === f.id ? 'opacity-70' : ''}`}>{counts[f.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">
            {search || filter !== 'all' ? 'Sin resultados' : 'No hay pedidos todavía'}
          </p>
          {!search && filter === 'all' && (
            <Button className="mt-4" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Crear primer pedido
            </Button>
          )}
        </div>
      )}

      {/* Orders grid */}
      <div className="space-y-3">
        {filtered.map(order => {
          const fk = getFilterKey(order);
          const status = STATUS_CONFIG[fk as keyof typeof STATUS_CONFIG];
          const StatusIcon = status.icon;
          const productCost = order.products.reduce((s, p) => s + p.pricePaid, 0);
          const ship = calcShipping(order, shippingSettings);
          const totalOwed = productCost + (order.shippingPaymentStatus !== 'Pagado' ? ship.clientPays : 0);
          const productsWithPhotos = order.products.filter(p => p.productPhoto);
          const productsNoPhoto = order.products.filter(p => !p.productPhoto);
          const date = new Date(order.createdAt).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >


              {/* ── Info section ── */}
              <div className="p-3.5 space-y-2.5">

                {/* Client + date */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-foreground text-base leading-tight">{order.clientName || 'Cliente'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{date} · {order.products.length} producto{order.products.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {order.brotherInvolved && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
                        + hermano
                      </span>
                    )}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold ${status.bg} ${status.cls}`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </div>
                  </div>
                </div>

                {/* Product checklist */}
                {order.products.length > 0 && (
                  <div className="space-y-1.5">
                    {order.products.map(p => (
                      <div key={p.id} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 border transition-all ${
                        p.delivered ? 'bg-green-50 border-green-200 dark:bg-green-950/20' : 'bg-card border-border'
                      }`}>
                        {/* Toggle delivered */}
                        <button
                          onClick={e => { e.stopPropagation(); onToggleDelivered?.(p.id, !p.delivered); }}
                          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            p.delivered ? 'bg-green-500 border-green-500 text-white' : 'border-muted-foreground/40 hover:border-primary'
                          }`}
                        >
                          {p.delivered && <Check className="h-3.5 w-3.5" />}
                        </button>
                        {/* Photo */}
                        {p.productPhoto
                          ? <img src={p.productPhoto} alt="" className="h-8 w-8 rounded-md object-cover flex-shrink-0 border" />
                          : <div className="h-8 w-8 rounded-md bg-muted flex-shrink-0 flex items-center justify-center border"><Package className="h-3.5 w-3.5 text-muted-foreground" /></div>
                        }
                        {/* Name + store */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium leading-tight truncate ${p.delivered ? 'line-through text-muted-foreground' : ''}`}>{p.productName}</p>
                          <p className="text-[10px] text-muted-foreground">{p.store}</p>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0">${p.pricePaid.toFixed(2)}</span>
                        {/* Edit shortcut */}
                        <button
                          onClick={e => { e.stopPropagation(); setEditing(order); }}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground flex-shrink-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Financials */}
                <div className="flex items-center gap-3 pt-1 border-t border-border/50">
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Carrito</p>
                    <p className="text-sm font-bold text-foreground">{fmt(productCost)}</p>
                  </div>
                  {ship.clientPays > 0 && (
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Envío</p>
                      <p className={`text-sm font-bold ${order.shippingPaymentStatus === 'Pagado' ? 'text-green-600' : 'text-foreground'}`}>
                        {fmt(ship.clientPays)}
                      </p>
                    </div>
                  )}
                  {ship.profit > 0 && (
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Ganancia</p>
                      <p className="text-sm font-bold text-green-600">{fmt(ship.profit)}</p>
                    </div>
                  )}
                  {fk !== 'done' && totalOwed > 0 && (
                    <div className="flex-1">
                      <p className="text-[10px] text-amber-600 uppercase font-semibold">Por cobrar</p>
                      <p className="text-sm font-bold text-amber-600">{fmt(totalOwed)}</p>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-0.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs"
                    onClick={() => setEditing(order)}
                  >
                    Ver detalle
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                  <ConfirmDeleteDialog
                    title="¿Eliminar este pedido?"
                    description="Se eliminarán todos los productos del pedido. Esta acción no se puede deshacer."
                    onConfirm={() => onDeleteOrder(order.id)}
                    trigger={
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      const prods = order.products.map(p => ({
                        name: p.productName,
                        price: p.pricePaid,
                        store: p.store,
                        photo: p.productPhoto,
                        weightLb: p.weightLb,
                      }));
                      setQuotationData({
                        clientName: order.clientName || '',
                        products: prods,
                        shippingCharge: ship.clientPays,
                        exchangeRate,
                      });
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1" />
                    Cotización
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialogs */}
      <AddClientOrderDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        clients={clients}
        onAddClient={onAddClient}
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

      {quotationData && (
        <QuotationGenerator
          open={!!quotationData}
          onOpenChange={v => { if (!v) setQuotationData(null); }}
          data={quotationData}
        />
      )}
    </div>
  );
}
