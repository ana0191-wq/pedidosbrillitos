import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { fmtMoney } from '@/lib/utils';
import type { Collaborator, CollaboratorEarning } from '@/hooks/useCollaborators';
import type { ClientOrder } from '@/hooks/useClientOrders';

interface TeamSectionProps {
  collaborators: Collaborator[];
  earnings: CollaboratorEarning[];
  clientOrders: ClientOrder[];
  onMarkPaid: (earningId: string) => void;
  getEarningsByCollaborator: (id: string) => CollaboratorEarning[];
}

export function TeamSection({ collaborators, earnings, clientOrders, onMarkPaid, getEarningsByCollaborator }: TeamSectionProps) {
  const [showHistory, setShowHistory] = useState(false);
  const fmt = fmtMoney;

  // Get the brother (first collaborator)
  const brother = collaborators[0] ?? null;

  const brotherEarnings = brother ? getEarningsByCollaborator(brother.id) : [];
  const unpaid = brotherEarnings.filter(e => !e.paid);
  const paid = brotherEarnings.filter(e => e.paid);
  const totalOwed = unpaid.reduce((s, e) => s + e.collaboratorCut, 0);
  const totalPaidAll = paid.reduce((s, e) => s + e.collaboratorCut, 0);

  // Map orderId → client name + product names
  const getOrderLabel = (orderId: string) => {
    // orderId could be a product order id or client_order id
    for (const co of clientOrders) {
      if (co.id === orderId) return co.clientName || 'Cliente';
      const prod = co.products.find(p => p.id === orderId);
      if (prod) return `${co.clientName || 'Cliente'} — ${prod.productName}`;
    }
    return 'Pedido';
  };

  if (!brother) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground space-y-2">
          <p className="text-4xl">🐵</p>
          <p className="font-semibold text-foreground">No hay colaborador configurado</p>
          <p className="text-sm">Contacta al soporte para agregar a tu hermano.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">

      {/* Banner de lo que se le debe */}
      <div className={`rounded-2xl px-5 py-4 ${totalOwed > 0 ? 'gradient-pink card-brillitos' : 'bg-green-50 border border-green-200'}`}>
        <p className={`text-sm font-semibold mb-1 ${totalOwed > 0 ? 'text-primary-foreground/80' : 'text-green-700'}`}>
          {totalOwed > 0 ? `Le debes a ${brother.name}` : `✅ Todo pagado a ${brother.name}`}
        </p>
        <p className={`text-4xl font-black ${totalOwed > 0 ? 'text-primary-foreground' : 'text-green-700'}`}>
          {fmt(totalOwed)}
        </p>
        {totalOwed > 0 && (
          <p className="text-xs text-primary-foreground/60 mt-1">{unpaid.length} pedido{unpaid.length !== 1 ? 's' : ''} sin pagar</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
          <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Pendiente</p>
          <p className="text-2xl font-black text-amber-700">{fmt(totalOwed)}</p>
          <p className="text-[11px] text-amber-500 mt-1">{unpaid.length} pedido{unpaid.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Ya pagado</p>
          <p className="text-2xl font-black text-green-700">{fmt(totalPaidAll)}</p>
          <p className="text-[11px] text-green-500 mt-1">{paid.length} pedido{paid.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Pedidos pendientes de pago */}
      {unpaid.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">💸 Pendientes de pagar</p>
            {unpaid.map(e => (
              <div key={e.id} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{getOrderLabel(e.orderId)}</p>
                  <p className="text-[11px] text-muted-foreground">Ganancia total: {fmt(e.anaProfit)} · Su parte: {brother.percentage}%</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <p className="text-base font-black text-amber-700">{fmt(e.collaboratorCut)}</p>
                  <Button size="sm" className="h-7 text-[11px] px-2 gap-1" onClick={() => onMarkPaid(e.id)}>
                    <Check className="h-3 w-3" /> Pagué
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Historial colapsable */}
      {paid.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setShowHistory(h => !h)}
            >
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">✅ Historial pagado ({paid.length})</p>
              {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showHistory && paid.map(e => (
              <div key={e.id} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{getOrderLabel(e.orderId)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {e.paidAt ? new Date(e.paidAt).toLocaleDateString('es', { day: '2-digit', month: 'short' }) : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-sm font-bold text-green-700">{fmt(e.collaboratorCut)}</p>
                  <p className="text-[10px] text-green-500">✅ Pagado</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {brotherEarnings.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground space-y-1">
            <p className="text-3xl">📦</p>
            <p className="text-sm">Aún no hay ganancias registradas.</p>
            <p className="text-xs">Se calculan automáticamente cuando guardas el envío de un pedido con hermano activo.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
