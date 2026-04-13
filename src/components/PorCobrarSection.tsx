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

interface PendingItem {
  orderId: string;
  clientName: string;
  products: string[];
  stage1Paid: boolean;
  stage1Amount: number;
  stage2Paid: boolean;
  stage2Amount: number;
  totalPending: number;
  clientPhone?: string;
}

export function PorCobrarSection({ clientOrders, onUpdateOrder }: PorCobrarSectionProps) {
  const pendingItems = useMemo(() => {
    const items: PendingItem[] = [];

    for (const co of clientOrders) {
      const s1Paid = co.productPaymentStatus === 'Pagado';
      const s2Paid = co.shippingPaymentStatus === 'Pagado';

      if (s1Paid && s2Paid) continue;

      // Stage 1: client owes product price
      const productCost = co.products.reduce((s, p) => s + p.pricePaid, 0);
      const s1Amount = s1Paid ? 0 : productCost;

      // Stage 2: client owes shipping_charge_client (what Ana charges, NOT what company charges Ana)
      const shippingChargeClient = co.shippingChargeToClient;
      const s2Amount = s2Paid ? 0 : (shippingChargeClient ?? 0);

      const totalPending = s1Amount + s2Amount;
      if (totalPending <= 0 && s1Paid) continue; // skip if nothing owed (stage2 might be uncalculated)

      items.push({
        orderId: co.id,
        clientName: co.clientName || 'Sin nombre',
        products: co.products.map(p => p.productName),
        stage1Paid: s1Paid,
        stage1Amount: s1Paid ? 0 : productCost,
        stage2Paid: s2Paid,
        stage2Amount: s2Paid ? 0 : (shippingChargeClient ?? 0),
        totalPending,
      });
    }

    items.sort((a, b) => b.totalPending - a.totalPending);
    return items;
  }, [clientOrders]);

  const totalPendiente = pendingItems.reduce((s, i) => s + i.totalPending, 0);

  const markStagePaid = (orderId: string, stage: 'product' | 'shipping', amount: number) => {
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

  const openWhatsApp = (clientName: string, amount: number, phone?: string) => {
    const msg = `Hola ${clientName}, tienes pendiente $${amount.toFixed(2)} con Brillitos Store 🌸`;
    const url = phone
      ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const fmt = fmtMoney;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">💰 Por Cobrar</h2>
        <div className="card-brillitos gradient-pink px-4 py-2 rounded-xl">
          <p className="text-xs text-primary-foreground/70 font-medium">Total pendiente</p>
          <p className="text-2xl font-extrabold text-primary-foreground">{fmt(totalPendiente)}</p>
        </div>
      </div>

      {pendingItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <DollarSign className="h-10 w-10 mx-auto mb-2 text-green-500" />
            <p className="font-semibold text-green-600">¡Todo cobrado! 🎉</p>
            <p className="text-sm">No tienes pagos pendientes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingItems.map(item => (
            <Card key={item.orderId} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-foreground">{item.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                      {item.products.join(', ')}
                    </p>
                  </div>
                  <p className="text-lg font-extrabold text-primary">{fmt(item.totalPending)}</p>
                </div>

                {/* Stage 1 */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Etapa 1 — Producto:</span>
                  {item.stage1Paid ? (
                    <span className="text-green-600 font-semibold">✅ Pagado</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600 font-semibold">⏳ Debe → {fmt(item.stage1Amount)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => markStagePaid(item.orderId, 'product', item.stage1Amount)}
                      >
                        <Check className="h-3 w-3 mr-1" /> Pagado
                      </Button>
                    </div>
                  )}
                </div>

                {/* Stage 2 */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Etapa 2 — Envío:</span>
                  {item.stage2Paid ? (
                    <span className="text-green-600 font-semibold">✅ Pagado</span>
                  ) : item.stage2Amount > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600 font-semibold">⏳ Debe → {fmt(item.stage2Amount)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => markStagePaid(item.orderId, 'shipping', item.stage2Amount)}
                      >
                        <Check className="h-3 w-3 mr-1" /> Pagado
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">⚠️ Sin calcular</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => openWhatsApp(item.clientName, item.totalPending)}
                  >
                    <MessageCircle className="h-3 w-3" /> 💬 WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
