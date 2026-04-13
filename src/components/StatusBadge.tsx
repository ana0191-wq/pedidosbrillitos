import type { Store, PersonalStatus, MerchandiseStatus, ClientStatus } from '@/types/orders';
import { Badge } from '@/components/ui/badge';

type AnyStatus = PersonalStatus | MerchandiseStatus | ClientStatus | string;

const statusConfig: Record<string, { class: string }> = {
  'Pendiente': { class: 'bg-muted text-muted-foreground' },
  'En Tránsito': { class: 'bg-status-transit text-primary-foreground' },
  'Llegó': { class: 'bg-status-arrived text-primary-foreground' },
  'No Llegó': { class: 'bg-destructive text-destructive-foreground' },
  'En Venezuela': { class: 'bg-status-venezuela text-primary-foreground' },
  'Entregado': { class: 'bg-status-delivered-dark text-primary-foreground' },
  // Legacy statuses for backwards compat
  'Pedido': { class: 'bg-muted text-muted-foreground' },
  'Parcialmente Recibido': { class: 'bg-status-partial text-primary-foreground' },
  'Completo': { class: 'bg-status-delivered-dark text-primary-foreground' },
  'Cliente Notificado': { class: 'bg-status-notified text-primary-foreground' },
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const config = statusConfig[status] || { class: 'bg-muted text-muted-foreground' };
  return <Badge className={config.class}>{status}</Badge>;
}

const storeConfig: Record<string, string> = {
  'AliExpress': 'store-badge-aliexpress',
  'Shein': 'store-badge-shein',
  'Temu': 'store-badge-temu',
  'Amazon': 'store-badge-amazon',
};

export function StoreBadge({ store }: { store: Store }) {
  // Normalize store name for matching
  const key = Object.keys(storeConfig).find(k => k.toLowerCase() === store.toLowerCase()) || store;
  return <Badge className={storeConfig[key] || 'bg-muted text-muted-foreground'}>{store}</Badge>;
}
