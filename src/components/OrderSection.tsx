import { useState, useMemo } from 'react';
import type { Order, OrderCategory } from '@/types/orders';
import { OrderCard } from '@/components/OrderCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Filter } from 'lucide-react';

interface CollabInfo {
  name: string;
  percentage: number;
  cut: number;
}

interface OrderSectionProps {
  title: string;
  emoji: string;
  category: OrderCategory;
  orders: Order[];
  statusOptions: string[];
  onUpdate: (id: string, updates: Partial<Order>) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  getCollabInfo?: (order: Order) => CollabInfo | null;
}

export function OrderSection({ title, emoji, orders, statusOptions, onUpdate, onDelete, onAdd }: OrderSectionProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter(o => o.status === statusFilter);
  }, [orders, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground">{emoji} {title}</h2>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({orders.length})</SelectItem>
              {statusOptions.map(s => (
                <SelectItem key={s} value={s}>{s} ({orders.filter(o => o.status === s).length})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">No hay pedidos{statusFilter !== 'all' ? ` con estado "${statusFilter}"` : ''}</p>
          <Button variant="link" onClick={onAdd} className="mt-2">Agregar primer pedido</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <OrderCard key={order.id} order={order} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
