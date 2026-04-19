import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, ExternalLink, ChevronDown, ChevronUp, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fmtMoney } from '@/lib/utils';
import type { Order } from '@/types/orders';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUSES = [
  { key: 'Pendiente',    emoji: '⏳', label: 'Pendiente',     color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { key: 'En Tránsito',  emoji: '✈️', label: 'En tránsito',   color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'En Venezuela', emoji: '📍', label: 'En Venezuela',  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'Llegó',        emoji: '📦', label: 'Llegó',         color: 'bg-green-50 text-green-700 border-green-200' },
  { key: 'No Llegó',     emoji: '⚠️', label: 'No llegó',      color: 'bg-red-50 text-red-700 border-red-200' },
  { key: 'Entregado',    emoji: '✅', label: 'Entregado',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
] as const;

const STORES = ['Shein', 'Temu', 'Amazon', 'AliExpress', 'Otra'];

function StatusPill({ status }: { status: string }) {
  const s = STATUSES.find(x => x.key === status) ?? STATUSES[0];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.color}`}>
      {s.emoji} {s.label}
    </span>
  );
}

// ── AI screenshot helper (reuses same edge function) ─────────────────────────

async function extractFromScreenshot(base64: string): Promise<{ productName?: string; store?: string; pricePaid?: number; orderNumber?: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('extract-screenshot', {
      body: { imageBase64: base64, mode: 'single' },
    });
    if (error || !data?.products?.length) return null;
    const p = data.products[0];
    return {
      productName: p.productName || p.name,
      store: p.store,
      pricePaid: p.pricePaid || p.price,
      orderNumber: p.orderNumber,
    };
  } catch { return null; }
}

function compressImage(base64: string, maxWidth = 1200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = base64;
  });
}

// ── Add Dialog ────────────────────────────────────────────────────────────────

interface AddDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (order: Partial<Order> & { productName: string }) => Promise<void>;
}

function AddCompraDialog({ open, onOpenChange, onAdd }: AddDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiImage, setAiImage] = useState('');

  const [productName, setProductName] = useState('');
  const [store, setStore] = useState('Shein');
  const [price, setPrice] = useState('');
  const [link, setLink] = useState('');
  const [sizeColor, setSizeColor] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setProductName(''); setStore('Shein'); setPrice(''); setLink('');
    setSizeColor(''); setOrderNumber(''); setNotes(''); setAiImage('');
  };

  const handleAiImage = useCallback(async (base64: string) => {
    const compressed = await compressImage(base64);
    setAiImage(compressed);
    setAiLoading(true);
    const result = await extractFromScreenshot(compressed);
    setAiLoading(false);
    if (!result) { toast({ title: '🤔 No detecté productos', description: 'Intenta con otra captura o escribe manualmente' }); return; }
    if (result.productName) setProductName(result.productName);
    if (result.store && STORES.includes(result.store)) setStore(result.store);
    if (result.pricePaid) setPrice(String(result.pricePaid));
    if (result.orderNumber) setOrderNumber(result.orderNumber);
    toast({ title: '✨ Datos detectados', description: 'Revisa y ajusta si es necesario' });
  }, [toast]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleAiImage(reader.result as string);
    reader.readAsDataURL(file);
  }, [handleAiImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleAiImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!productName.trim()) { toast({ title: 'Falta el nombre del producto', variant: 'destructive' }); return; }
    setSaving(true);
    await onAdd({
      productName: productName.trim(),
      store,
      pricePaid: parseFloat(price) || 0,
      notes,
      orderNumber,
    } as any);
    // Save link + size if entered
    reset();
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🛍️ Nueva compra personal</DialogTitle>
        </DialogHeader>

        {/* AI import zone */}
        <div
          onPaste={handlePaste}
          className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary transition-colors bg-muted/20"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          {aiLoading ? (
            <div className="flex items-center justify-center gap-2 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Analizando captura...</span>
            </div>
          ) : aiImage ? (
            <div className="flex items-center gap-3">
              <img src={aiImage} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-green-600">✅ Captura cargada</p>
                <p className="text-[11px] text-muted-foreground">Revisa los datos abajo</p>
              </div>
              <button onClick={e => { e.stopPropagation(); setAiImage(''); }} className="ml-auto text-muted-foreground hover:text-foreground">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-2xl">📸</p>
              <p className="text-sm font-medium text-foreground">Pega captura de Shein/Temu/Amazon</p>
              <p className="text-[11px] text-muted-foreground">Ctrl+V · o haz clic para subir · la IA detecta los datos</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Producto *</label>
            <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ej: Vestido floral manga larga" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tienda</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {STORES.map(s => (
                  <button key={s} type="button" onClick={() => setStore(s)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${store === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Precio $</label>
              <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="mt-1 h-8 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Talla / Color</label>
              <Input value={sizeColor} onChange={e => setSizeColor(e.target.value)} placeholder="M, Rojo..." className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"># Pedido</label>
              <Input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Order #..." className="mt-1 h-8 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link del producto</label>
            <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://shein.com/..." className="mt-1 h-8 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notas</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Para regalo, urgente..." className="mt-1 h-8 text-sm" />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Agregar compra
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────

interface PersonalCardProps {
  order: Order;
  onUpdate: (id: string, updates: Partial<Order>) => void;
  onDelete: (id: string) => void;
}

function PersonalCard({ order, onUpdate, onDelete }: PersonalCardProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const arrivalFileRef = useRef<HTMLInputElement>(null);

  const o = order as any;
  const arrived = order.status === 'Llegó' || order.status === 'En Venezuela' || order.status === 'Entregado';

  const nextStatus = () => {
    const idx = STATUSES.findIndex(s => s.key === order.status);
    const next = STATUSES[Math.min(idx + 1, STATUSES.length - 1)];
    if (next.key !== order.status) onUpdate(order.id, { status: next.key as any });
  };

  const uploadArrivalPhoto = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/arrival_${order.id}_${Date.now()}`;
      const { error } = await supabase.storage.from('order-photos').upload(path, file, { upsert: true });
      if (error) { toast({ title: 'Error subiendo foto', variant: 'destructive' }); return; }
      const { data: urlData } = supabase.storage.from('order-photos').getPublicUrl(path);
      await supabase.from('orders').update({ arrival_photo: urlData.publicUrl }).eq('id', order.id);
      onUpdate(order.id, { productPhoto: urlData.publicUrl } as any);
      toast({ title: '📸 Foto guardada' });
    } finally { setUploading(false); }
  };

  return (
    <Card className={`overflow-hidden transition-all ${arrived ? 'border-green-200 dark:border-green-800' : ''}`}>
      <CardContent className="p-0">
        {/* Main row */}
        <div className="flex items-center gap-3 p-3" onClick={() => setExpanded(e => !e)}>
          {/* Photo / store icon */}
          <div className="h-12 w-12 rounded-xl flex-shrink-0 overflow-hidden bg-muted flex items-center justify-center text-xl">
            {order.productPhoto
              ? <img src={order.productPhoto} alt="" className="h-full w-full object-cover" />
              : <span>{STORES.find(s => s === order.store) ? '🛍️' : '📦'}</span>}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{order.productName}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">{order.store}</span>
              {o.sizeColor && <span className="text-xs text-muted-foreground">· {o.sizeColor}</span>}
              <StatusPill status={order.status} />
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-sm font-bold text-foreground">{fmtMoney(order.pricePaid)}</span>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-border px-3 pb-3 space-y-3 pt-3 bg-muted/20">

            {/* Status stepper */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map(s => (
                  <button key={s.key} onClick={() => onUpdate(order.id, { status: s.key as any })}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${order.status === s.key ? `${s.color} ring-2 ring-primary/30` : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}>
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info fields */}
            <div className="grid grid-cols-2 gap-2">
              {o.trackingNumber && (
                <div className="bg-background rounded-lg px-2.5 py-2 border border-border">
                  <p className="text-[10px] text-muted-foreground font-medium">📦 Tracking</p>
                  <p className="text-xs font-semibold truncate">{o.trackingNumber}</p>
                </div>
              )}
              {o.estimatedArrivalDate && (
                <div className="bg-background rounded-lg px-2.5 py-2 border border-border">
                  <p className="text-[10px] text-muted-foreground font-medium">📅 Llegada</p>
                  <p className="text-xs font-semibold">{new Date(o.estimatedArrivalDate + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })}</p>
                </div>
              )}
              {order.orderNumber && (
                <div className="bg-background rounded-lg px-2.5 py-2 border border-border">
                  <p className="text-[10px] text-muted-foreground font-medium"># Pedido</p>
                  <p className="text-xs font-semibold truncate">{order.orderNumber}</p>
                </div>
              )}
              {order.pricePaid > 0 && (
                <div className="bg-background rounded-lg px-2.5 py-2 border border-border">
                  <p className="text-[10px] text-muted-foreground font-medium">💰 Pagué</p>
                  <p className="text-xs font-semibold">{fmtMoney(order.pricePaid)}</p>
                </div>
              )}
            </div>

            {order.notes && (
              <p className="text-xs text-muted-foreground italic bg-background rounded-lg px-2.5 py-2 border border-border">
                📝 {order.notes}
              </p>
            )}

            {/* Arrival photo */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">📸 Foto de llegada</p>
              {o.arrivalPhoto ? (
                <div className="relative w-24 h-24">
                  <img src={o.arrivalPhoto} alt="Llegada" className="w-24 h-24 rounded-xl object-cover border border-border" />
                  <button
                    onClick={async () => {
                      await supabase.from('orders').update({ arrival_photo: null }).eq('id', order.id);
                      onUpdate(order.id, { productPhoto: '' } as any);
                    }}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center shadow"
                  >✕</button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-xl px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  <input ref={arrivalFileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadArrivalPhoto(f); e.target.value = ''; }} />
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : '📸'} Subir cuando llegue
                </label>
              )}
            </div>

            {/* Links and actions */}
            <div className="flex items-center gap-2 pt-1 border-t border-border flex-wrap">
              {o.productLink && (
                <a href={o.productLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Ver en tienda
                </a>
              )}
              <button onClick={nextStatus}
                className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1 hover:bg-muted transition-colors ml-auto">
                Avanzar estado →
              </button>
              {confirm ? (
                <div className="flex gap-1">
                  <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => onDelete(order.id)}>Sí, borrar</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setConfirm(false)}>No</Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive/60 hover:text-destructive" onClick={() => setConfirm(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

interface ComprasPersonalesSectionProps {
  orders: Order[];
  onAdd: (order: Partial<Order> & { productName: string }) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Order>) => void;
  onDelete: (id: string) => void;
}

export function ComprasPersonalesSection({ orders, onAdd, onUpdate, onDelete }: ComprasPersonalesSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const totalSpent = orders.reduce((s, o) => s + (o.pricePaid || 0), 0);
  const arrived = orders.filter(o => ['Llegó', 'En Venezuela', 'Entregado'].includes(o.status)).length;
  const inTransit = orders.filter(o => o.status === 'En Tránsito').length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">Total gastado</p>
          <p className="text-lg font-black text-primary">{fmtMoney(totalSpent)}</p>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">En camino</p>
          <p className="text-lg font-black text-blue-700">{inTransit}</p>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">Llegaron</p>
          <p className="text-lg font-black text-green-700">{arrived}</p>
        </div>
      </div>

      {/* Filter + Add */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto flex-1 pb-1">
          {[{ key: 'all', label: `Todas (${orders.length})` }, ...STATUSES.map(s => ({ key: s.key, label: `${s.emoji} ${s.label}` }))].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <Button size="sm" className="flex-shrink-0 gap-1" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl">🛍️</p>
          <p className="font-semibold text-foreground">
            {filter === 'all' ? 'Aún no tienes compras registradas' : `No hay compras con estado "${filter}"`}
          </p>
          {filter === 'all' && (
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar primera compra
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => (
            <PersonalCard key={o.id} order={o} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}

      <AddCompraDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={onAdd} />
    </div>
  );
}