import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Check, Trash2, Users, Pencil } from 'lucide-react';
import type { Collaborator, CollaboratorEarning } from '@/hooks/useCollaborators';
import type { Order } from '@/types/orders';

interface TeamSectionProps {
  collaborators: Collaborator[];
  earnings: CollaboratorEarning[];
  orders: Order[];
  onAdd: (name: string, percentage: number) => void;
  onUpdate: (id: string, updates: Partial<Pick<Collaborator, 'name' | 'percentage'>>) => void;
  onDelete: (id: string) => void;
  onMarkPaid: (earningId: string) => void;
  getEarningsByCollaborator: (id: string) => CollaboratorEarning[];
}

export function TeamSection({
  collaborators, orders, onAdd, onUpdate, onDelete, onMarkPaid, getEarningsByCollaborator,
}: TeamSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [percentage, setPercentage] = useState('30');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), parseFloat(percentage) || 30);
    setName('');
    setPercentage('30');
    setDialogOpen(false);
  };

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const getOrderName = (orderId: string) => {
    const o = orders.find(o => o.id === orderId);
    return o?.productName || 'Pedido';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5" /> Equipo
        </h2>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </div>

      {collaborators.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay colaboradores aún</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar colaborador
            </Button>
          </CardContent>
        </Card>
      )}

      {collaborators.map((collab) => {
        const collabEarnings = getEarningsByCollaborator(collab.id);
        const unpaid = collabEarnings.filter(e => !e.paid);
        const paid = collabEarnings.filter(e => e.paid);
        const totalUnpaid = unpaid.reduce((s, e) => s + e.collaboratorCut, 0);
        const totalPaid = paid.reduce((s, e) => s + e.collaboratorCut, 0);

        return (
          <Card key={collab.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                    👤 {collab.name} — {collab.percentage}%
                  </h3>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => onDelete(collab.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2">
                  <span className="text-muted-foreground text-xs">Le debes ahora</span>
                  <p className="font-bold text-amber-700 dark:text-amber-400 text-lg">{fmt(totalUnpaid)}</p>
                </div>
                <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-2">
                  <span className="text-muted-foreground text-xs">Ya pagado</span>
                  <p className="font-bold text-green-700 dark:text-green-400 text-lg">{fmt(totalPaid)}</p>
                </div>
              </div>

              {collabEarnings.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Historial</h4>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {collabEarnings.map((earning) => (
                      <div key={earning.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span>📦</span>
                          <span className="truncate">{getOrderName(earning.orderId)}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-semibold">{fmt(earning.collaboratorCut)}</span>
                        </span>
                        {earning.paid ? (
                          <span className="text-green-600 font-medium flex-shrink-0">Pagado ✅</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 flex-shrink-0"
                            onClick={() => onMarkPaid(earning.id)}
                          >
                            <Check className="h-3 w-3 mr-0.5" /> Pagar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Mi hermano" />
            </div>
            <div>
              <label className="text-sm font-medium">Porcentaje (%)</label>
              <Input type="number" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="30" />
            </div>
            <Button onClick={handleAdd} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
