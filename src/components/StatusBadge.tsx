import type { Store, PersonalStatus, MerchandiseStatus, ClientStatus } from '@/types/orders';
import { Badge } from '@/components/ui/badge';

type AnyStatus = PersonalStatus | MerchandiseStatus | ClientStatus;

const statusConfig: Record<string, { class: string }> = {
  'Pedido': { class: 'bg-status-ordered text-primary-foreground' },
  'En Tránsito': { class: 'bg-status-transit text-primary-foreground' },
  'Entregado': { class: 'bg-status-delivered text-primary-foreground' },
  'Parcialmente Recibido': { class: 'bg-status-partial text-primary-foreground' },
  'Completo': { class: 'bg-status-delivered text-primary-foreground' },
  'Cliente Notificado': { class: 'bg-status-notified text-primary-foreground' },
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const config = statusConfig[status] || { class: 'bg-muted text-muted-foreground' };
  return <Badge className={config.class}>{status}</Badge>;
}

const storeConfig: Record<Store, string> = {
  'AliExpress': 'store-badge-aliexpress',
  'Shein': 'store-badge-shein',
  'Temu': 'store-badge-temu',
  'Amazon': 'store-badge-amazon',
};

export function StoreBadge({ store }: { store: Store }) {
  return <Badge className={storeConfig[store]}>{store}</Badge>;
}
