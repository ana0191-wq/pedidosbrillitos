import { useMemo } from 'react';
import { Package, Clock, TrendingUp, Truck, ArrowUpRight, DollarSign, Users, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Order } from '@/types/orders';
import { fmtMoney } from '@/lib/utils';
import type { Client } from '@/hooks/useClients';
import type { ClientOrder as ClientOrderType } from '@/hooks/useClientOrders';
import type { Collaborator, CollaboratorEarning } from '@/hooks/useCollaborators';

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

const STATUS_COLORS: Record<string, string> = {
  'Pendiente':    'bg-amber-100 text-amber-700',
  'En Tránsito':  'bg-blue-100 text-blue-700',
  'Llegó':        'bg-purple-100 text-purple-700',
  'En Venezuela': 'bg-indigo-100 text-indigo-700',
  'Entregado':    'bg-green-100 text-green-700',
  'No Llegó':     'bg-red-100 text-red-700',
};

export function Dashboard({ orders, clients, clientOrders, collaborators, earnings, onNavigate, onMarkPaid, onOrderClick }: DashboardProps) {
  const fmt = fmtMoney;

  const stats = useMemo(() => {
    let totalAnaProfit = 0;
    let brotherCutTotal = 0;
    let netProfitAccum = 0;
    let pendingCollection = 0;
    let ordersWithInvoice = 0;
    let totalShipCharged = 0;
    let totalShipCost = 0;

    for (const co of clientOrders) {
      const productCost = co.products.reduce((s, p) => s + p.pricePaid, 0);
      const charge = co.shippingChargeToClient;
      const cost = co.shippingCostCompany;

      if (charge != null && cost != null) {
        const profit = charge - cost;
        totalAnaProfit += profit;
        totalShipCharged += charge;
        totalShipCost += cost;
        ordersWithInvoice++;
        if (co.brotherInvolved) {
          netProfitAccum += profit * 0.70;
          brotherCutTotal += profit * 0.30;
        } else {
          netProfitAccum += profit;
        }
      }
      const s1 = co.productPaymentStatus !== 'Pagado' ? productCost : 0;
      const s2 = co.shippingPaymentStatus !== 'Pagado' ? (charge ?? 0) : 0;
      pendingCollection += s1 + s2;
    }

    const inTransit = orders.filter(o => ['En Tránsito', 'Llegó', 'En Venezuela'].includes(o.status)).length;
    const totalClientOrders = clientOrders.length;
    const hasPartialData = ordersWithInvoice < totalClientOrders && totalClientOrders > 0;

    return {
      totalOrders: orders.length,
      inTransit,
      pendingCollection,
      netProfit: netProfitAccum,
      totalAnaProfit,
      brotherCutTotal,
      ordersWithInvoice,
      totalClientOrders,
      hasPartialData,
      totalShipCharged,
      totalShipCost,
    };
  }, [orders, clientOrders]);

  // Monthly chart data
  const chartData = useMemo(() => {
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const m = d.getMonth(), y = d.getFullYear();
      const value = clientOrders
        .filter(co => { const c = new Date(co.createdAt); return c.getMonth() === m && c.getFullYear() === y; })
        .reduce((s, co) => s + (co.shippingChargeToClient ?? 0), 0);
      return { label: months[m], value };
    });
  }, [clientOrders]);

  const maxChart = Math.max(...chartData.map(d => d.value), 1);

  const activeOrders = orders
    .filter(o => ['En Tránsito', 'Llegó', 'En Venezuela'].includes(o.status))
    .slice(0, 5);

  const recentClientOrders = clientOrders.slice(0, 6);

  const primaryCollab = collaborators[0] || null;
  const collabUnpaidTotal = primaryCollab
    ? earnings.filter(e => e.collaboratorId === primaryCollab.id && !e.paid).reduce((s, e) => s + e.collaboratorCut, 0)
    : 0;

  return (
    <div className="space-y-5">

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('clients')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-extrabold text-foreground">{stats.totalOrders}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total pedidos</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('por-cobrar')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-amber-600" />
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-extrabold text-foreground">{fmt(stats.pendingCollection)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Por cobrar</p>
          </CardContent>
        </Card>

        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold">{fmt(stats.netProfit)}</p>
            <p className="text-xs opacity-80 mt-0.5">Tu ganancia neta</p>
            {stats.hasPartialData && (
              <p className="text-[10px] opacity-60 mt-1">{stats.ordersWithInvoice}/{stats.totalClientOrders} pedidos con factura</p>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('clients')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Truck className="h-4 w-4 text-blue-600" />
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-extrabold text-foreground">{stats.inTransit}</p>
            <p className="text-xs text-muted-foreground mt-0.5">En tránsito</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Chart + Profit split ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-foreground">Cobrado en envíos</p>
              <button className="text-xs text-primary font-semibold" onClick={() => onNavigate('clients')}>
                Ver todo →
              </button>
            </div>
            <div className="flex items-end gap-2 h-28">
              {chartData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary/20 rounded-t-sm transition-all"
                    style={{ height: `${(d.value / maxChart) * 96}px`, minHeight: d.value > 0 ? '4px' : '0' }}
                  >
                    <div
                      className="w-full bg-primary rounded-t-sm h-full"
                      style={{ opacity: i === chartData.length - 1 ? 1 : 0.6 }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-bold text-foreground">Desglose de ganancias</p>
            <div className="space-y-1.5 text-xs">

              {/* Ingresos */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ingresos</p>
              <div className="flex justify-between pl-2">
                <span className="text-muted-foreground">Envíos cobrados a clientes</span>
                <span className="font-semibold">{stats.ordersWithInvoice > 0 ? fmt(stats.totalShipCharged) : '—'}</span>
              </div>

              {/* Costos */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">Costos</p>
              <div className="flex justify-between pl-2">
                <span className="text-muted-foreground">Pagado a empresa de carga</span>
                <span className="font-semibold text-red-500">{stats.ordersWithInvoice > 0 ? `−${fmt(stats.totalShipCost)}` : '—'}</span>
              </div>

              {/* Bruta */}
              <div className="flex justify-between border-t border-border pt-1.5 font-bold">
                <span>Ganancia bruta</span>
                <span className="text-green-600">{stats.ordersWithInvoice > 0 ? fmt(stats.totalAnaProfit) : '—'}</span>
              </div>

              {/* Hermano */}
              {stats.brotherCutTotal > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Parte del hermano (30%)</span>
                  <span className="font-semibold">−{fmt(stats.brotherCutTotal)}</span>
                </div>
              )}

              {/* Neta */}
              <div className={`flex justify-between font-bold text-sm rounded-lg px-2 py-1.5 mt-1 ${
                stats.netProfit > 0 ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'
              }`}>
                <span>Tu ganancia neta</span>
                <span>{stats.ordersWithInvoice > 0 ? fmt(stats.netProfit) : '—'}</span>
              </div>

              {stats.hasPartialData && (
                <p className="text-[10px] text-muted-foreground">{stats.ordersWithInvoice}/{stats.totalClientOrders} pedidos con factura de envío</p>
              )}
            </div>

            {/* Brother owed */}
            {primaryCollab && collabUnpaidTotal > 0 && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-semibold text-amber-700">Le debes a {primaryCollab.name}</p>
                <p className="text-base font-bold text-amber-700">{fmt(collabUnpaidTotal)}</p>
                <button className="text-[10px] text-amber-600 underline mt-0.5" onClick={() => onNavigate('team')}>
                  Ver detalle →
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── In transit ── */}
      {activeOrders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-foreground">En tránsito</p>
              <button className="text-xs text-primary font-semibold" onClick={() => onNavigate('clients')}>Ver todo →</button>
            </div>
            <div className="space-y-2">
              {activeOrders.map(order => (
                <button
                  key={order.id}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => onOrderClick?.(order, null)}
                >
                  <div className="h-9 w-9 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                    {order.productPhoto
                      ? <img src={order.productPhoto} alt="" className="h-full w-full object-cover" />
                      : <Package className="h-4 w-4 m-2.5 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{order.productName}</p>
                    <p className="text-xs text-muted-foreground">{order.store}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground'}`}>
                    {order.status}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent client orders ── */}
      {recentClientOrders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-foreground">Pedidos recientes</p>
              <button className="text-xs text-primary font-semibold" onClick={() => onNavigate('clients')}>Ver todos →</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-2 font-medium">Cliente</th>
                    <th className="text-left pb-2 font-medium">Productos</th>
                    <th className="text-right pb-2 font-medium">Carrito</th>
                    <th className="text-right pb-2 font-medium">Envío</th>
                    <th className="text-right pb-2 font-medium">Ganancia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentClientOrders.map(co => {
                    const cart = co.products.reduce((s, p) => s + p.pricePaid, 0);
                    const ship = co.shippingChargeToClient ?? 0;
                    const profit = co.shippingCostCompany != null && ship > 0
                      ? ship - co.shippingCostCompany
                      : null;
                    return (
                      <tr key={co.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2 font-semibold">{co.clientName}</td>
                        <td className="py-2 text-muted-foreground">{co.products.length} prod</td>
                        <td className="py-2 text-right">{fmt(cart)}</td>
                        <td className="py-2 text-right">{ship > 0 ? fmt(ship) : '—'}</td>
                        <td className="py-2 text-right font-semibold text-green-600">
                          {profit != null ? fmt(profit) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick links ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { id: 'personal', label: 'Compras personales', icon: ShoppingBag },
          { id: 'merchandise', label: 'Mercancía', icon: Package },
          { id: 'team', label: 'Equipo', icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <Card key={id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate(id)}>
            <CardContent className="p-3 text-center">
              <Icon className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold text-muted-foreground leading-tight">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}