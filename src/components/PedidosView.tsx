import { useState, useMemo } from 'react';
import { Package, User, ShoppingBag, Tag, Check, Pencil, Trash2, Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import type { Order } from '@/types/orders';
import type { Client } from '@/hooks/useClients';

interface Props {
  orders: Order[];
  clients: Client[];
  exchangeRate?: number | null;
  onUpdate: (id: string, patch: Partial<Order>) => void;
  onDelete: (id: string) => void;
  onToggleDelivered: (id: string, delivered: boolean) => void;
}

const CAT_CONFIG = {
  client:      { label: 'Cliente',   color: 'bg-pink-100 text-pink-700',   icon: User },
  personal:    { label: 'Personal',  color: 'bg-blue-100 text-blue-700',   icon: ShoppingBag },
  merchandise: { label: 'Mercancía', color: 'bg-purple-100 text-purple-700', icon: Tag },
};

const FILTERS = [
  { id: 'all',          label: 'Todos' },
  { id: 'pending',      label: 'Pendiente entregar' },
  { id: 'client',       label: 'Clientes' },
  { id: 'personal',     label: 'Personal' },
  { id: 'merchandise',  label: 'Mercancía' },
];

export function PedidosView({ orders, clients, exchangeRate, onUpdate, onDelete, onToggleDelivered }: Props) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const rate = exchangeRate || 570;

  const filtered = useMemo(() => {
    let list = orders;
    if (filter === 'pending') list = list.filter(o => !(o as any).delivered);
    else if (filter !== 'all') list = list.filter(o => o.category === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.productName.toLowerCase().includes(q) ||
        (o as any).clientName?.toLowerCase().includes(q) ||
        o.store.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, filter, search]);

  const stats = useMemo(() => {
    const clientOrders = orders.filter(o => o.category === 'client');
    const totalOwed = clientOrders.filter(o => !(o as any).paid).reduce((s, o) => s + (o.amountCharged || o.pricePaid || 0), 0);
    const pendingDelivery = orders.filter(o => !(o as any).delivered).length;
    return { totalOwed, pendingDelivery, total: orders.length };
  }, [orders]);

  return (
    <div className="space-y-4 pb-20">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Productos</p>
          <p className="text-xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-[10px] text-amber-600 uppercase font-semibold">Por entregar</p>
          <p className="text-xl font-bold text-amber-600">{stats.pendingDelivery}</p>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-[10px] text-pink-600 uppercase font-semibold">Por cobrar</p>
          <p className="text-lg font-bold text-pink-600">${stats.totalOwed.toFixed(0)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 h-9 text-sm bg-white"
          placeholder="Buscar producto, cliente, tienda..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === f.id ? 'bg-primary text-white' : 'bg-white border border-border text-muted-foreground hover:border-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay productos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => (
            <ProductRow
              key={order.id}
              order={order}
              clients={clients}
              rate={rate}
              isEditing={editingId === order.id}
              onToggleEdit={() => setEditingId(editingId === order.id ? null : order.id)}
              onUpdate={patch => onUpdate(order.id, patch)}
              onDelete={() => onDelete(order.id)}
              onToggleDelivered={() => onToggleDelivered(order.id, !(order as any).delivered)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single product row ───────────────────────────────────────────────────────
function ProductRow({ order, clients, rate, isEditing, onToggleEdit, onUpdate, onDelete, onToggleDelivered }: {
  order: Order;
  clients: Client[];
  rate: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdate: (patch: Partial<Order>) => void;
  onDelete: () => void;
  onToggleDelivered: () => void;
}) {
  const cat = (order.category as keyof typeof CAT_CONFIG) in CAT_CONFIG ? order.category as keyof typeof CAT_CONFIG : 'personal';
  const cfg = CAT_CONFIG[cat];
  const CatIcon = cfg.icon;
  const delivered = !!(order as any).delivered;
  const price = order.pricePaid || 0;
  const clientName = (order as any).clientName || '';

  return (
    <div className={`rounded-xl border-2 transition-all bg-white overflow-hidden ${delivered ? 'border-green-300/60' : 'border-border'}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        {/* Delivered toggle */}
        <button
          onClick={onToggleDelivered}
          className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
            delivered ? 'bg-green-500 border-green-500 text-white' : 'border-muted-foreground/40 hover:border-primary'
          }`}
        >
          {delivered && <Check className="h-4 w-4" />}
        </button>

        {/* Photo */}
        <div className="h-16 w-16 rounded-xl bg-muted flex-shrink-0 overflow-hidden border">
          {(order as any).productPhoto
            ? <img src={(order as any).productPhoto} alt="" className="h-full w-full object-cover" />
            : <CatIcon className="h-6 w-6 m-5 text-muted-foreground" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm leading-tight ${delivered ? 'line-through text-muted-foreground' : ''}`}>
            {order.productName}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.color}`}>
              {cfg.label}
            </span>
            {clientName && (
              <span className="text-[10px] text-muted-foreground">{clientName}</span>
            )}
            <span className="text-[10px] text-muted-foreground">{order.store}</span>
          </div>
        </div>

        {/* Price */}
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-bold">${price.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">{(price * rate).toFixed(0)} Bs</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={onToggleEdit} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            {isEditing ? <ChevronUp className="h-4 w-4" /> : <Pencil className="h-3.5 w-3.5" />}
          </button>
          <ConfirmDeleteDialog
            title="¿Eliminar este producto?"
            description="Esta acción no se puede deshacer."
            onConfirm={onDelete}
            trigger={
              <button className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            }
          />
        </div>
      </div>

      {/* Edit panel */}
      {isEditing && (
        <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 block">Nombre</label>
              <Input defaultValue={order.productName} className="h-8 text-xs"
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== order.productName) onUpdate({ productName: v } as any); }} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 block">Precio ($)</label>
              <Input defaultValue={price} type="number" step="0.01" className="h-8 text-xs"
                onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onUpdate({ pricePaid: v }); }} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 block">Tienda</label>
              <Input defaultValue={order.store} className="h-8 text-xs"
                onBlur={e => { const v = e.target.value.trim(); if (v !== order.store) onUpdate({ store: v } as any); }} />
            </div>
            {cat === 'client' && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 block">Cliente</label>
                <Input defaultValue={clientName} className="h-8 text-xs"
                  list={`clients-${order.id}`}
                  onBlur={e => { const v = e.target.value.trim(); if (v !== clientName) onUpdate({ clientName: v } as any); }} />
                <datalist id={`clients-${order.id}`}>
                  {clients.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
            )}
          </div>
          {/* Type change */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 block">Tipo</label>
            <div className="flex gap-1.5">
              {(Object.entries(CAT_CONFIG) as [keyof typeof CAT_CONFIG, typeof CAT_CONFIG[keyof typeof CAT_CONFIG]][]).map(([key, c]) => (
                <button key={key} onClick={() => onUpdate({ category: key } as any)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${cat === key ? c.color + ' border-transparent' : 'bg-muted text-muted-foreground border-transparent'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}