import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Package, Users, Plus, TrendingUp, DollarSign, ClipboardList } from 'lucide-react';
import type { Order, ClientOrder, MerchandiseOrder } from '@/types/orders';
import type { Client } from '@/hooks/useClients';
import type { ClientOrder as ClientOrderType } from '@/hooks/useClientOrders';
import { ScreenshotImport } from '@/components/ScreenshotImport';
import { AddClientOrderDialog } from '@/components/AddClientOrderDialog';

interface DashboardProps {
  counts: { personal: number; merchandise: number; client: number; total: number };
  orders: Order[];
  clients: Client[];
  onAddOrder: () => void;
  onAddClientOrder: (clientId: string, data: Partial<ClientOrderType>) => Promise<string | null>;
  onImportOrders: (orders: Order[]) => void;
  onNavigate: (tab: string) => void;
}

export function Dashboard({ counts, orders, clients, onAddOrder, onAddClientOrder, onImportOrders, onNavigate }: DashboardProps) {
  const [showClientOrderDialog, setShowClientOrderDialog] = useState(false);
  const recentOrders = orders.slice(0, 5);

  const spending = useMemo(() => {
    let personal = 0, merchandise = 0, client = 0, clientRevenue = 0, clientProfit = 0;
    const clientBreakdown: Record<string, { spent: number; charged: number; items: number }> = {};

    for (const o of orders) {
      if (o.category === 'personal') personal += o.pricePaid;
      if (o.category === 'merchandise') {
        merchandise += (o as MerchandiseOrder).pricePerUnit * (o as MerchandiseOrder).unitsOrdered;
      }
      if (o.category === 'client') {
        const co = o as ClientOrder;
        client += o.pricePaid;
        clientRevenue += co.amountCharged;
        clientProfit += co.amountCharged - o.pricePaid - co.shippingCost;
        const name = co.clientName || 'Sin cliente';
        if (!clientBreakdown[name]) clientBreakdown[name] = { spent: 0, charged: 0, items: 0 };
        clientBreakdown[name].spent += o.pricePaid + co.shippingCost;
        clientBreakdown[name].charged += co.amountCharged;
        clientBreakdown[name].items += 1;
      }
    }
    return { personal, merchandise, client, clientRevenue, clientProfit, clientBreakdown, total: personal + merchandise + client };
  }, [orders]);

  const summaryCards = [
    { label: 'Mis Pedidos', count: counts.personal, icon: ShoppingBag, color: 'text-primary', tab: 'personal' },
    { label: 'Mercancía', count: counts.merchandise, icon: Package, color: 'text-secondary', tab: 'merchandise' },
    { label: 'Clientes', count: clients.length, icon: Users, color: 'text-accent', tab: 'clients' },
    { label: 'Total Pendiente', count: counts.total, icon: TrendingUp, color: 'text-foreground', tab: 'client-orders' },
  ];

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">📊 Resumen</h2>
        <div className="flex items-center gap-2">
          <Button onClick={onAddOrder}>
            <Plus className="h-4 w-4 mr-1" /> Agregar Pedido
          </Button>
          <Button variant="outline" onClick={() => setShowClientOrderDialog(true)}>
            <ClipboardList className="h-4 w-4 mr-1" /> Pedido Cliente
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map(card => (
          <Card
            key={card.label}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onNavigate(card.tab)}
          >
            <CardContent className="p-4 text-center">
              <card.icon className={`h-8 w-8 mx-auto mb-2 ${card.color}`} />
              <p className="text-3xl font-bold text-foreground">{card.count}</p>
              <p className="text-sm text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Spending Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" /> Gastos y Compras
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">🛍️ Personal</p>
              <p className="text-lg font-bold text-foreground">{fmt(spending.personal)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">📦 Mercancía</p>
              <p className="text-lg font-bold text-foreground">{fmt(spending.merchandise)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">👤 Clientes (costo)</p>
              <p className="text-lg font-bold text-foreground">{fmt(spending.client)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">💰 Ganancia clientes</p>
              <p className={`text-lg font-bold ${spending.clientProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(spending.clientProfit)}</p>
            </div>
          </div>
          <div className="border-t border-border pt-2 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total invertido</span>
            <span className="text-xl font-bold text-foreground">{fmt(spending.total)}</span>
          </div>

          {/* Client breakdown */}
          {Object.keys(spending.clientBreakdown).length > 0 && (
            <div className="border-t border-border pt-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Desglose por cliente:</p>
              {Object.entries(spending.clientBreakdown).map(([name, data]) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium">{name} <span className="text-muted-foreground">({data.items} art.)</span></span>
                  <span className={`font-semibold ${(data.charged - data.spent) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {fmt(data.charged - data.spent)} ganancia
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Screenshot Import */}
      <ScreenshotImport onImportOrders={onImportOrders} />

      {/* Recent activity */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">🕐 Actividad Reciente</h3>
        {recentOrders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <p>No hay pedidos aún. ¡Agrega tu primero!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentOrders.map(order => (
              <Card key={order.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {order.productPhoto ? (
                      <img src={order.productPhoto} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{order.productName}</p>
                    <p className="text-xs text-muted-foreground">{order.store} · {order.status}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">${order.pricePaid.toFixed(2)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddClientOrderDialog
        open={showClientOrderDialog}
        onOpenChange={setShowClientOrderDialog}
        clients={clients}
        onAddOrder={onAddClientOrder}
      />
    </div>
  );
}
