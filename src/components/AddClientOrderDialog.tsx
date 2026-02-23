import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Client } from '@/hooks/useClients';
import type { ClientOrder } from '@/hooks/useClientOrders';

const PAYMENT_METHODS = ['Bolívares (tasa euro)', 'PayPal', 'Binance', 'Efectivo'];

interface AddClientOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onAddOrder: (clientId: string, data: Partial<ClientOrder>) => Promise<string | null>;
  /** If provided, pre-selects the client */
  defaultClientId?: string;
}

export function AddClientOrderDialog({ open, onOpenChange, clients, onAddOrder, defaultClientId }: AddClientOrderDialogProps) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState(defaultClientId || '');
  const [payment, setPayment] = useState('');
  const [payRef, setPayRef] = useState('');
  const [shipping, setShipping] = useState('');
  const [charged, setCharged] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setClientId(defaultClientId || '');
    setPayment('');
    setPayRef('');
    setShipping('');
    setCharged('');
    setNotes('');
  };

  const handleSubmit = async () => {
    const selectedClient = clientId || defaultClientId;
    if (!selectedClient) {
      toast({ title: 'Selecciona un cliente', variant: 'destructive' });
      return;
    }
    await onAddOrder(selectedClient, {
      paymentMethod: payment,
      paymentReference: payRef,
      shippingCost: parseFloat(shipping) || 0,
      amountCharged: parseFloat(charged) || 0,
      notes,
    });
    reset();
    onOpenChange(false);
    toast({ title: '✅ Pedido de cliente creado' });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo Pedido de Cliente</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!defaultClientId && (
            <div>
              <Label>Cliente *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {clients.length === 0 && <p className="text-xs text-muted-foreground mt-1">Primero agrega un cliente en la pestaña Clientes</p>}
            </div>
          )}
          <div>
            <Label>Método de pago</Label>
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Referencia de pago</Label><Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="N° de transacción..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Costo envío ($)</Label><Input type="number" step="0.01" value={shipping} onChange={e => setShipping(e.target.value)} /></div>
            <div><Label>Cobrado ($)</Label><Input type="number" step="0.01" value={charged} onChange={e => setCharged(e.target.value)} /></div>
          </div>
          <div><Label>Notas</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
          <Button onClick={handleSubmit} className="w-full" disabled={!clientId && !defaultClientId}>Crear Pedido</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
