import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Check, DollarSign } from 'lucide-react';
import { fmtMoney } from '@/lib/utils';
import type { ClientOrder } from '@/hooks/useClientOrders';

interface PorCobrarSectionProps {
  clientOrders: ClientOrder[];
  onUpdateOrder: (id: string, updates: Record<string, any>) => void;
}

export function PorCobrarSection({ clientOrders, onUpdateOrder }: PorCobrarSectionProps) {
  const pendingItems = useMemo(() => {
    return clientOrders
      .filter(co => {
        const s1Paid = co.productPaymentStatus === 'Pagado';
        const s2Paid = co.shippingPaymentStatus === 'Pagado';
        return !(s1Paid && s2Paid);
      })
      .map(co => {
        const s1Paid = co.productPaymentStatus === 'Pagado';
        const s2Paid = co.shippingPaymentStatus === 'Pagado';
        const productCost = co.products.reduce((s, p) => s + (p.pricePaid || 0), 0);
        const s1Amount = s1Paid ? 0 : productCost;
        const s2Amount = s2Paid ? 0 : (co.shippingChargeToClient ?? 0);
        return {
          orderId: co.id,
          clientName: co.clientName || 'Sin nombre',
          products: co.products.map(p => p.productName).filter(Boolean),
          stage1Paid: s1Paid,
          stage1Amount: s1Amount,
          stage2Paid: s2Paid,
          stage2Amount: s2Amount,
          totalPending: s1Amount + s2Amount,
        };
      })
      .filter(item => item.totalPending > 0 || !item.stage1Paid)
      .sort((a, b) => b.totalPending - a.totalPending);
  }, [clientOrders]);

  const totalPendiente = pendingItems.reduce((s, i) => s + i.totalPending, 0);
  const fmt = fmtMoney;

  const markPaid = (orderId: string, stage: 'product' | 'shipping', amount: number) => {
    if (stage === 'product') {
      onUpdateOrder(orderId, {
        productPaymentStatus: 'Pagado',
        productPaymentAmount: amount,
        productPaymentDate: new Date().toISOString(),
      });
    } else {
      onUpdateOrder(orderId, {
        shippingPaymentStatus: 'Pagado',
        shippingPaymentAmount: amount,
        shippingPaymentDate: new Date().toISOString(),
      });
    }
  };

  const openWhatsApp = (clientName: string, amount: number) => {
    const msg = `Hola ${clientName} 🌸, tienes un pago pendiente de ${fmt(amount)} con Brillitos Store. ¡Gracias!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (pendingItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <DollarSign className="h-10 w-10 mx-auto mb-2 text-green-500" />
          <p className="font-semibold text-green-600 text-lg">¡Todo cobrado! 🎉</p>
          <p className="text-sm mt-1">No tienes pagos pendientes.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Total header */}
      <div className="card-brillitos gradient-pink px-5 py-4 rounded-xl flex items-center justify-between">
        <div>
          <p className="text-sm text-primary-foreground/70 font-medium">Total pendiente</p>
          <p className="text-3xl font-extrabold text-primary-foreground">{fmt(totalPendiente)}</p>
        </div>
        <p className="text-primary-foreground/70 text-sm">{pendingItems.length} pedido{pendingItems.length !== 1 ? 's' : ''}</p>
      </div>

      {pendingItems.map(item => (
        <Card key={item.orderId} className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-foreground text-base">{item.clientName}</p>
                {item.products.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {item.products.join(' · ')}
                  </p>
                )}
              </div>
              <p className="text-xl font-extrabold text-primary flex-shrink-0">{fmt(item.totalPending)}</p>
            </div>

            {/* Stage 1 — Producto */}
            <div className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">📦 Producto</span>
              {item.stage1Paid ? (
                <span className="text-green-600 font-semibold text-xs">✅ Pagado</span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 font-semibold">{fmt(item.stage1Amount)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs border-green-300 text-green-700 hover:bg-green-50 px-2"
                    onClick={() => markPaid(item.orderId, 'product', item.stage1Amount)}
                  >
                    <Check className="h-3 w-3 mr-1" /> Cobrado
                  </Button>
                </div>
              )}
            </div>

            {/* Stage 2 — Envío */}
            <div className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">✈️ Envío</span>
              {item.stage2Paid ? (
                <span className="text-green-600 font-semibold text-xs">✅ Pagado</span>
              ) : item.stage2Amount > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 font-semibold">{fmt(item.stage2Amount)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs border-green-300 text-green-700 hover:bg-green-50 px-2"
                    onClick={() => markPaid(item.orderId, 'shipping', item.stage2Amount)}
                  >
                    <Check className="h-3 w-3 mr-1" /> Cobrado
                  </Button>
                </div>
              ) : (
                <span className="text-muted-foreground text-xs italic">Sin calcular aún</span>
              )}
            </div>

            {/* WhatsApp */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 w-full"
              onClick={() => openWhatsApp(item.clientName, item.totalPending)}
            >
              <MessageCircle className="h-3 w-3" /> Recordar por WhatsApp
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
