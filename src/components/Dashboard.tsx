import { useMemo } from 'react';
import { Package, Clock, TrendingUp, Truck, ArrowUpRight, AlertTriangle } from 'lucide-react';
import type { Order, ClientOrder, MerchandiseOrder } from '@/types/orders';
import { fmtMoney } from '@/lib/utils';
import type { Client } from '@/hooks/useClients';
import type { ClientOrder as ClientOrderType } from '@/hooks/useClientOrders';
import type { Collaborator, CollaboratorEarning } from '@/hooks/useCollaborators';
import { StatusBadge, StoreBadge } from '@/components/StatusBadge';

interface DashboardProps {
  orders: Order[];
  clients: Client[];
  clientOrders: ClientOrderType[];
  collaborators: Collaborator[];
  earnings: CollaboratorEarning[];
  onNavigate: (tab: string) => void;
  onMarkPaid: (earningId: string) => void;
  onOrderClick?: (order: Order, parentClientOrder: ClientOrderType | null) => void;
}

export function Dashboard({ orders, clients, clientOrders, collaborators, earnings, onNavigate, onMarkPaid, onOrderClick }: DashboardProps) {
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const inTransit = orders.filter(o => o.status === 'En Tránsito').length;

    let totalShippingRevenue = 0; // SUM of shipping_charge_client (NOT product price)
    let totalAnaProfit = 0;
    let netProfitAccum = 0; // Net profit honoring brother_involved per-order
    let pendingCollection = 0;
    let ordersWithInvoice = 0;
    let totalClientOrders = 0;

    for (const co of clientOrders) {
      totalClientOrders++;
      const productCost = co.products.reduce((s, p) => s + p.pricePaid, 0);
      const shippingChargeClient = co.shippingChargeToClient;
      const companyInvoiceAmount = co.shippingCostCompany;

      // Revenue = only shipping charged to clients (product is passthrough)
      if (shippingChargeClient != null) {
        totalShippingRevenue += shippingChargeClient;
      }

      // PROFIT: only from shipping, only when both values are known
      if (companyInvoiceAmount != null && shippingChargeClient != null) {
        const anaProfit = shippingChargeClient - companyInvoiceAmount;
        totalAnaProfit += anaProfit;
        ordersWithInvoice++;
        // If brother NOT involved on this order, all profit is hers; otherwise 30% goes to brother
        if (co.brotherInvolved === false) {
          netProfitAccum += anaProfit;
        } else {
          netProfitAccum += anaProfit * 0.70;
        }
      }

      // POR COBRAR: what client still owes
      const stage1Pending = co.productPaymentStatus !== 'Pagado' ? productCost : 0;
      const stage2Pending = co.shippingPaymentStatus !== 'Pagado' ? (shippingChargeClient ?? 0) : 0;
      pendingCollection += stage1Pending + stage2Pending;
    }

    // Brother cut = SUM of unpaid collaborator_earnings
    const collabTotal = earnings.filter(e => !e.paid).reduce((s, e) => s + e.collaboratorCut, 0);
    // Net profit respects per-order brother_involved flag
    const netProfit = netProfitAccum;

    return { totalOrders, inTransit, pendingCollection, netProfit, totalAnaProfit, collabTotal, totalShippingRevenue, ordersWithInvoice, totalClientOrders };
  }, [orders, clientOrders, earnings]);

  // Monthly shipping revenue data for chart (last 6 months)
  const chartData = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const data: { label: string; value: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.getMonth();
      const year = d.getFullYear();

      let revenue = 0;
      for (const co of clientOrders) {
        const created = new Date(co.createdAt);
        if (created.getMonth() === month && created.getFullYear() === year) {
          // Only count shipping revenue, NOT product passthrough
          if (co.shippingChargeToClient != null) {
            revenue += co.shippingChargeToClient;
          }
        }
      }
      data.push({ label: months[month], value: revenue });
    }
    return data;
  }, [clientOrders]);

  const maxChart = Math.max(...chartData.map(d => d.value), 1);
  const recentOrders = orders.slice(0, 8);
  const trackingOrders = orders
    .filter(o => ['En Tránsito', 'Llegó', 'En Venezuela'].includes(o.status))
    .slice(0, 5);

  const primaryCollab = collaborators[0] || null;
  const collabUnpaid = primaryCollab
    ? earnings.filter(e => e.collaboratorId === primaryCollab.id && !e.paid)
    : [];
  const collabUnpaidTotal = collabUnpaid.reduce((s, e) => s + e.collaboratorCut, 0);

  const fmt = fmtMoney;
  const getOrderName = (orderId: string) => orders.find(o => o.id === orderId)?.productName || 'Pedido';

  // Data confidence: show warning if some orders are missing invoice data
  const hasPartialData = stats.ordersWithInvoice < stats.totalClientOrders && stats.totalClientOrders > 0;
  const confidenceLabel = hasPartialData
    ? `⚠️ basado en ${stats.ordersWithInvoice} de ${stats.totalClientOrders} pedidos con factura`
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-[18px] h-full">
      {/* Row 1: 4 stat cards */}
      <StatCard
        icon={<Package className="h-5 w-5" />}
        label="Total Pedidos"
        value={String(stats.totalOrders)}
        onClick={() => onNavigate('personal')}
      />
      <StatCard
        icon={<Clock className="h-5 w-5" />}
        label="Pendiente de cobro"
        value={fmt(stats.pendingCollection)}
        onClick={() => onNavigate('por-cobrar')}
      />
      <div className="card-brillitos gradient-pink p-5 flex flex-col justify-between cursor-pointer hover:shadow-brillitos-lg transition-shadow" onClick={() => onNavigate('client-orders')}>
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <ArrowUpRight className="h-4 w-4 text-primary-foreground/60" />
        </div>
        <div className="mt-3">
          <p className="text-2xl lg:text-3xl font-extrabold text-primary-foreground">{fmt(stats.netProfit)}</p>
          <p className="text-xs text-primary-foreground/70 font-medium mt-0.5">Tu ganancia neta</p>
          {confidenceLabel && (
            <p className="text-[10px] text-primary-foreground/50 mt-0.5">{confidenceLabel}</p>
          )}
        </div>
      </div>
      <StatCard
        icon={<Truck className="h-5 w-5" />}
        label="En Tránsito"
        value={String(stats.inTransit)}
        onClick={() => onNavigate('personal')}
      />

      {/* Row 2: Revenue chart (2 cols) + Ganancias (1 col) + Tracking (1 col, spans 2 rows) */}
      <div className="card-brillitos p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Total cobrado en envíos</h3>
            <p className="text-2xl font-extrabold text-foreground mt-1">{fmt(stats.totalShippingRevenue)}</p>
            {hasPartialData && (
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                {confidenceLabel}
              </p>
            )}
          </div>
          <span className="text-xs font-semibold text-profit bg-profit/10 px-2 py-1 rounded-full">↑ Activo</span>
        </div>
        <div className="flex items-end gap-2 h-32">
          {chartData.map((d, i) => {
            const height = maxChart > 0 ? (d.value / maxChart) * 100 : 0;
            const isLast = i === chartData.length - 1;
            return (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t-lg transition-all ${isLast ? 'bg-primary' : 'bg-pink-soft'}`}
                  style={{ height: `${Math.max(height, 4)}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ganancias breakdown — profit is ONLY from shipping */}
      <div className="card-brillitos p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Ganancias</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Por envíos</span>
              <span className="font-semibold text-foreground">{stats.ordersWithInvoice > 0 ? fmt(stats.totalAnaProfit) : '—'}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${stats.totalAnaProfit > 0 ? 70 : 0}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Le toca al equipo (30%)</span>
              <span className="font-semibold text-primary">-{stats.ordersWithInvoice > 0 ? fmt(stats.totalAnaProfit * 0.30) : '—'}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-pink-soft rounded-full" style={{ width: `${stats.totalAnaProfit > 0 ? 30 : 0}%` }} />
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground font-medium">Total neto</span>
              <span className="text-lg font-extrabold text-foreground">{stats.ordersWithInvoice > 0 ? fmt(stats.netProfit) : '—'}</span>
            </div>
            {confidenceLabel && (
              <p className="text-[10px] text-amber-500 mt-1">{confidenceLabel}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tracking card */}
      <div className="card-brillitos p-5 lg:row-span-2">
        <h3 className="text-sm font-semibold text-foreground mb-4">📦 Tracking</h3>
        {trackingOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Sin envíos activos</p>
        ) : (
          <div className="space-y-4">
            {trackingOrders.map((order, idx) => (
              <div key={order.id} className="relative">
                {idx < trackingOrders.length - 1 && (
                  <div className="absolute left-[11px] top-8 w-0.5 h-full bg-primary/20" />
                )}
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{order.productName}</p>
                    {order.orderNumber && (
                      <p className="text-[10px] text-primary font-medium bg-primary/10 inline-block px-1.5 py-0.5 rounded mt-0.5">#{order.orderNumber}</p>
                    )}
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 3: Orders table (3 cols) */}
      <div className="card-brillitos p-5 lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Pedidos Recientes</h3>
          <button onClick={() => onNavigate('personal')} className="text-xs text-primary font-medium hover:underline">Ver todos →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 font-medium">Producto</th>
                <th className="text-left py-2 font-medium hidden sm:table-cell">Cliente</th>
                <th className="text-left py-2 font-medium hidden md:table-cell">Tienda</th>
                <th className="text-left py-2 font-medium">Estado</th>
                <th className="text-right py-2 font-medium">Precio</th>
                <th className="text-right py-2 font-medium hidden sm:table-cell">Cobro envío</th>
                <th className="text-right py-2 font-medium hidden md:table-cell">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => {
                const parentCO = clientOrders.find(co => co.products.some(p => p.id === order.id));
                const shippingChargeClient = parentCO?.shippingChargeToClient;
                const companyInvoice = parentCO?.shippingCostCompany;
                const anaProfit = (shippingChargeClient != null && companyInvoice != null)
                  ? shippingChargeClient - companyInvoice
                  : null;

                return (
                  <tr
                    key={order.id}
                    onClick={() => onOrderClick ? onOrderClick(order, parentCO || null) : onNavigate(parentCO ? 'client-orders' : 'personal')}
                    className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer"
                    title="Click para editar"
                  >
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                          {order.productPhoto ? (
                            <img src={order.productPhoto} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <span className="font-medium text-foreground truncate max-w-[120px]">{order.productName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 hidden sm:table-cell text-muted-foreground">
                      {parentCO?.clientName || '—'}
                    </td>
                    <td className="py-2.5 hidden md:table-cell">
                      <StoreBadge store={order.store} />
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-2.5 text-right font-bold text-foreground">{fmt(order.pricePaid)}</td>
                    <td className="py-2.5 text-right font-semibold text-primary hidden sm:table-cell">
                      {shippingChargeClient != null ? fmt(shippingChargeClient) : '—'}
                    </td>
                    <td className="py-2.5 text-right font-bold text-profit hidden md:table-cell">
                      {anaProfit != null ? fmt(anaProfit) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equipo card */}
      {primaryCollab && (
        <div className="card-brillitos p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">👤 {primaryCollab.name}</h3>
          <p className="text-2xl font-extrabold text-primary">{fmt(collabUnpaidTotal)}</p>
          <p className="text-[10px] text-muted-foreground mb-3">Le debes ahora</p>
          {collabUnpaid.length > 0 && (
            <>
              <button
                className="w-full rounded-full bg-primary text-primary-foreground text-xs font-medium py-2 hover:bg-primary/90 transition-colors mb-3"
                onClick={() => onNavigate('team')}
              >
                Marcar pagado
              </button>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {collabUnpaid.slice(0, 5).map(e => (
                  <div key={e.id} className="flex justify-between text-[11px]">
                    <span className="truncate text-muted-foreground">{getOrderName(e.orderId)}</span>
                    <span className="font-semibold text-primary flex-shrink-0 ml-2">{fmt(e.collaboratorCut)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <div className="card-brillitos p-5 flex flex-col justify-between cursor-pointer hover:shadow-brillitos-lg transition-shadow" onClick={onClick}>
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-primary">
          {icon}
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/40" />
      </div>
      <div className="mt-3">
        <p className="text-2xl lg:text-3xl font-extrabold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}
