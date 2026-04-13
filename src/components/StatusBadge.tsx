import type { Store, PersonalStatus, MerchandiseStatus, ClientStatus } from '@/types/orders';
import { Badge } from '@/components/ui/badge';

type AnyStatus = PersonalStatus | MerchandiseStatus | ClientStatus | string;

const statusConfig: Record<string, { class: string }> = {
  'Pendiente': { class: 'bg-primary/15 text-primary font-medium' },
  'En Tránsito': { class: 'bg-status-transit/15 text-status-transit font-medium' },
  'Llegó': { class: 'bg-status-arrived/15 text-status-arrived font-medium' },
  'No Llegó': { class: 'bg-destructive/15 text-destructive font-medium' },
  'En Venezuela': { class: 'bg-status-venezuela/15 text-status-venezuela font-medium' },
  'Entregado': { class: 'bg-status-delivered-dark/15 text-status-delivered-dark font-medium' },
  'Pedido': { class: 'bg-primary/15 text-primary font-medium' },
  'Parcialmente Recibido': { class: 'bg-status-partial/15 text-status-partial font-medium' },
  'Completo': { class: 'bg-status-delivered-dark/15 text-status-delivered-dark font-medium' },
  'Cliente Notificado': { class: 'bg-status-notified/15 text-status-notified font-medium' },
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const config = statusConfig[status] || { class: 'bg-muted text-muted-foreground' };
  return <Badge className={`${config.class} border-0 rounded-full px-3 py-0.5 text-xs`}>{status}</Badge>;
}

const storeConfig: Record<string, string> = {
  'AliExpress': 'store-badge-aliexpress',
  'Shein': 'store-badge-shein',
  'Temu': 'store-badge-temu',
  'Amazon': 'store-badge-amazon',
};

export function StoreBadge({ store }: { store: Store }) {
  const key = Object.keys(storeConfig).find(k => k.toLowerCase() === store.toLowerCase()) || store;
  return <Badge className={`${storeConfig[key] || 'bg-muted text-muted-foreground'} border-0 rounded-full px-3 py-0.5 text-xs`}>{store}</Badge>;
}
