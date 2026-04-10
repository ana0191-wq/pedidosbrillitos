import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';
import type { Client } from '@/hooks/useClients';

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onUpdate: (id: string, updates: Partial<Pick<Client, 'name' | 'phone' | 'notes'>>) => void;
}

export function EditClientDialog({ open, onOpenChange, client, onUpdate }: EditClientDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (client && open) {
      setName(client.name);
      setPhone(client.phone || '');
      setNotes(client.notes || '');
    }
  }, [client, open]);

  if (!client) return null;

  const handleSave = () => {
    onUpdate(client.id, { name: name.trim(), phone: phone.trim(), notes: notes.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>✏️ Editar Cliente</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente" />
          </div>
          <div>
            <Label className="text-xs">Teléfono / WhatsApp</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+58..." />
          </div>
          <div>
            <Label className="text-xs">Notas (referencia, dirección, etc.)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Dirección, instrucciones..." />
          </div>
          <Button onClick={handleSave} className="w-full gap-2" disabled={!name.trim()}>
            <Save className="h-4 w-4" /> Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
