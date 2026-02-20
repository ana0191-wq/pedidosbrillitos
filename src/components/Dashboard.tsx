import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Package, Users, Plus, TrendingUp } from 'lucide-react';
import type { Order } from '@/types/orders';

interface DashboardProps {
  counts: { personal: number; merchandise: number; client: number; total: number };
  orders: Order[];
  onAddOrder: () => void;
}

export function Dashboard({ counts, orders, onAddOrder }: DashboardProps) {
  const recentOrders = orders.slice(0, 5);

  const summaryCards = [
    { label: 'Mis Pedidos', count: counts.personal, icon: ShoppingBag, color: 'text-primary' },
    { label: 'Mercancía', count: counts.merchandise, icon: Package, color: 'text-secondary' },
    { label: 'Clientes', count: counts.client, icon: Users, color: 'text-accent' },
    { label: 'Total Pendiente', count: counts.total, icon: TrendingUp, color: 'text-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">📊 Resumen</h2>
        <Button onClick={onAddOrder}>
          <Plus className="h-4 w-4 mr-1" /> Agregar Pedido
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map(card => (
          <Card key={card.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <card.icon className={`h-8 w-8 mx-auto mb-2 ${card.color}`} />
              <p className="text-3xl font-bold text-foreground">{card.count}</p>
              <p className="text-sm text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
    </div>
  );
}
