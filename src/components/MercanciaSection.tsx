import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, ChevronDown, ChevronUp, Loader2, Trash2, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fmtMoney } from '@/lib/utils';
import type { MerchandiseOrder, Order } from '@/types/orders';

// ── Status config ──────────────────────────────────────────────────────────

const STATUSES = [
  { key: 'Pendiente',    emoji: '⏳', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { key: 'En Tránsito',  emoji: '✈️', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'En Venezuela', emoji: '📍', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'Llegó',        emoji: '📦', color: 'bg-green-50 text-green-700 border-green-200' },
  { key: 'No Llegó',     emoji: '⚠️', color: 'bg-red-50 text-red-700 border-red-200' },
  { key: 'Entregado',    emoji: '✅', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
] as const;

const STORES = ['Shein', 'Temu', 'Amazon', 'AliExpress', 'Otra'];

function StatusPill({ status }: { status: string }) {
  const s = STATUSES.find(x => x.key === status) ?? STATUSES[0];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.color}`}>
      {s.emoji} {s.key}
    </span>
  );
}

// ── AI import ─────────────────────────────────────────────────────────────────

async function extractFromScreenshot(base64: string) {
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
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.75));
    };
    img.src = base64;
  });
}

// ── Add Dialog ────────────────────────────────────────────────────────────────

interface AddDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (data: Partial<MerchandiseOrder>) => Promise<void>;
}

function AddMercanciaDialog({ open, onOpenChange, onAdd }: AddDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiImage, setAiImage] = useState('');
  const [saving, setSaving] = useState(false);

  const [productName, setProductName] = useState('');
  const [store, setStore] = useState('Shein');
  const [units, setUnits] = useState('1');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [link, setLink] = useState('');
  const [sizeColor, setSizeColor] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setProductName(''); setStore('Shein'); setUnits('1'); setCostPerUnit('');
    setSalePrice(''); setLink(''); setSizeColor(''); setOrderNumber('');
    setNotes(''); setAiImage('');
  };

  const handleAiImage = useCallback(async (base64: string) => {
    const compressed = await compressImage(base64);
    setAiImage(compressed);
    setAiLoading(true);
    const result = await extractFromScreenshot(compressed);
    setAiLoading(false);
    if (!result) { toast({ title: '🤔 No detecté productos', description: 'Escribe manualmente' }); return; }
    if (result.productName) setProductName(result.productName);
    if (result.store && STORES.includes(result.store)) setStore(result.store);
    if (result.pricePaid) setCostPerUnit(String(result.pricePaid));
    if (result.orderNumber) setOrderNumber(result.orderNumber);
    toast({ title: '✨ Datos detectados', description: 'Revisa y ajusta' });
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

  const cost = parseFloat(costPerUnit) || 0;
  const sale = parseFloat(salePrice) || 0;
  const qty = parseInt(units) || 1;
  const gananciaUnit = sale - cost;
  const totalCosto = cost * qty;
  const totalGanancia = gananciaUnit * qty;

  const handleSubmit = async () => {
    if (!productName.trim()) { toast({ title: 'Falta el nombre del producto', variant: 'destructive' }); return; }
    setSaving(true);
    await onAdd({
      productName: productName.trim(),
      store,
      pricePaid: totalCosto,
      pricePerUnit: cost,
      unitsOrdered: qty,
      unitsReceived: 0,
      suggestedPrice: sale || null,
      orderNumber,
      notes,
    } as any);
    reset();
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📦 Agregar mercancía</DialogTitle>
        </DialogHeader>

        {/* AI zone */}
        <div
          onPaste={handlePaste}
          className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary transition-colors bg-muted/20"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const f = e.target.files?.[0]; if (!f) return;
            const r = new FileReader(); r.onload = () => handleAiImage(r.result as string); r.readAsDataURL(f);
            e.target.value = '';
          }} />
          {aiLoading ? (
            <div className="flex items-center justify-center gap-2 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Analizando captura...</span>
            </div>
          ) : aiImage ? (
            <div className="flex items-center gap-3">
              <img src={aiImage} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
              <div className="text-left flex-1">
                <p className="text-xs font-semibold text-green-600">✅ Captura cargada</p>
                <p className="text-[11px] text-muted-foreground">Revisa los datos abajo</p>
              </div>
              <button onClick={e => { e.stopPropagation(); setAiImage(''); }}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-2xl">📸</p>
              <p className="text-sm font-medium text-foreground">Pega captura de Shein/Temu/Amazon</p>
              <p className="text-[11px] text-muted-foreground">Ctrl+V · o haz clic para subir</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Producto *</label>
            <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ej: Camiseta básica blanca" className="mt-1" />
          </div>

          {/* Store */}
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

          {/* Units + prices */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unidades</label>
              <Input type="number" min="1" value={units} onChange={e => setUnits(e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Costo c/u $</label>
              <Input type="number" step="0.01" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} placeholder="0.00" className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Venta c/u $</label>
              <Input type="number" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="0.00" className="mt-1 h-8 text-sm" />
            </div>
          </div>

          {/* Live preview */}
          {(cost > 0 || sale > 0) && (
            <div className={`rounded-xl p-3 border ${gananciaUnit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">Total invertido</p>
                  <p className="text-sm font-black text-foreground">{fmtMoney(totalCosto)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">Ganancia/u</p>
                  <p className={`text-sm font-black ${gananciaUnit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(gananciaUnit)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">Total si vendés todo</p>
                  <p className={`text-sm font-black ${totalGanancia >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(totalGanancia)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Talla / Color</label>
              <Input value={sizeColor} onChange={e => setSizeColor(e.target.value)} placeholder="M, Negro..." className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"># Pedido</label>
              <Input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Order #..." className="mt-1 h-8 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link</label>
            <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://shein.com/..." className="mt-1 h-8 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notas</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Color, temporada..." className="mt-1 h-8 text-sm" />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Agregar mercancía
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Merchandise Card ──────────────────────────────────────────────────────────

interface MercCardProps {
  order: MerchandiseOrder;
  onUpdate: (id: string, updates: Partial<Order>) => void;
  onDelete: (id: string) => void;
}

function MercCard({ order, onUpdate, onDelete }: MercCardProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [receivedInput, setReceivedInput] = useState(String(order.unitsReceived));
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const o = order as any;
  const gananciaUnit = (order.suggestedPrice ?? 0) - order.pricePerUnit;
  const gananciaTotal = gananciaUnit * order.unitsReceived;
  const pendiente = order.unitsOrdered - order.unitsReceived;

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/merc_${order.id}_${Date.now()}`;
      const { error } = await supabase.storage.from('order-photos').upload(path, file, { upsert: true });
      if (error) { toast({ title: 'Error subiendo foto', variant: 'destructive' }); return; }
      const { data: urlData } = supabase.storage.from('order-photos').getPublicUrl(path);
      await supabase.from('orders').update({ product_photo: urlData.publicUrl }).eq('id', order.id);
      onUpdate(order.id, { productPhoto: urlData.publicUrl } as any);
      toast({ title: '📸 Foto guardada' });
    } finally { setUploading(false); }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Main row */}
        <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div className="h-12 w-12 rounded-xl flex-shrink-0 overflow-hidden bg-muted flex items-center justify-center">
            {order.productPhoto
              ? <img src={order.productPhoto} alt="" className="h-full w-full object-cover" />
              : <Package className="h-5 w-5 text-muted-foreground" />}
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
            {/* Units received / ordered */}
            <div className="flex items-center gap-1">
              <span className={`text-sm font-black ${order.unitsReceived >= order.unitsOrdered ? 'text-green-700' : 'text-amber-600'}`}>
                {order.unitsReceived}/{order.unitsOrdered}
              </span>
              <span className="text-[10px] text-muted-foreground">u</span>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="border-t border-border px-3 pb-3 pt-3 space-y-3 bg-muted/20">

            {/* Financial summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-background border border-border p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Costo/u</p>
                <p className="text-sm font-black text-foreground">{fmtMoney(order.pricePerUnit)}</p>
              </div>
              <div className="rounded-xl bg-background border border-border p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Precio venta</p>
                <p className="text-sm font-black text-primary">{order.suggestedPrice ? fmtMoney(order.suggestedPrice) : '—'}</p>
              </div>
              <div className={`rounded-xl border p-2.5 text-center ${gananciaUnit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Ganancia/u</p>
                <p className={`text-sm font-black ${gananciaUnit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(gananciaUnit)}</p>
              </div>
            </div>

            {/* Total investment & profit */}
            <div className="rounded-xl bg-background border border-border p-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Total invertido</p>
                <p className="text-base font-black text-foreground">{fmtMoney(order.pricePerUnit * order.unitsOrdered)}</p>
              </div>
              {order.unitsReceived > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">Ganancia si vendés todo</p>
                  <p className={`text-base font-black ${gananciaTotal >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmtMoney(gananciaUnit * order.unitsOrdered)}
                  </p>
                </div>
              )}
            </div>

            {/* Units received editor */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unidades recibidas</p>
              <div className="flex items-center gap-2">
                <button onClick={() => { const v = Math.max(0, (parseInt(receivedInput) || 0) - 1); setReceivedInput(String(v)); onUpdate(order.id, { unitsReceived: v } as any); }}
                  className="h-8 w-8 rounded-full bg-muted font-bold text-lg flex items-center justify-center hover:bg-muted/80">−</button>
                <Input
                  type="number" min="0" max={order.unitsOrdered}
                  value={receivedInput}
                  onChange={e => setReceivedInput(e.target.value)}
                  onBlur={e => { const v = Math.min(order.unitsOrdered, Math.max(0, parseInt(e.target.value) || 0)); setReceivedInput(String(v)); onUpdate(order.id, { unitsReceived: v } as any); }}
                  className="h-8 text-center text-sm w-16"
                />
                <button onClick={() => { const v = Math.min(order.unitsOrdered, (parseInt(receivedInput) || 0) + 1); setReceivedInput(String(v)); onUpdate(order.id, { unitsReceived: v } as any); }}
                  className="h-8 w-8 rounded-full bg-muted font-bold text-lg flex items-center justify-center hover:bg-muted/80">+</button>
                <span className="text-xs text-muted-foreground">de {order.unitsOrdered} pedidas</span>
                {pendiente > 0 && <span className="text-xs text-amber-600 font-semibold ml-auto">⏳ Faltan {pendiente}</span>}
                {pendiente === 0 && <span className="text-xs text-green-600 font-semibold ml-auto">✅ Completo</span>}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map(s => (
                  <button key={s.key} onClick={() => onUpdate(order.id, { status: s.key as any })}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${order.status === s.key ? `${s.color} ring-2 ring-primary/30` : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}>
                    {s.emoji} {s.key}
                  </button>
                ))}
              </div>
            </div>

            {/* Info chips */}
            {(o.trackingNumber || o.estimatedArrivalDate || order.orderNumber || o.sizeColor) && (
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
                {o.sizeColor && (
                  <div className="bg-background rounded-lg px-2.5 py-2 border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium">👗 Talla/Color</p>
                    <p className="text-xs font-semibold">{o.sizeColor}</p>
                  </div>
                )}
              </div>
            )}

            {order.notes && (
              <p className="text-xs text-muted-foreground italic bg-background rounded-lg px-2.5 py-2 border border-border">
                📝 {order.notes}
              </p>
            )}

            {/* Photo */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">📸 Foto del producto</p>
              {order.productPhoto ? (
                <div className="relative w-24 h-24">
                  <img src={order.productPhoto} alt="" className="w-24 h-24 rounded-xl object-cover border border-border" />
                  <button
                    onClick={async () => {
                      await supabase.from('orders').update({ product_photo: '' }).eq('id', order.id);
                      onUpdate(order.id, { productPhoto: '' } as any);
                    }}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center shadow"
                  >✕</button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-xl px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  <input ref={photoRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }} />
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : '📸'} Subir foto
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              {o.productLink && (
                <a href={o.productLink} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline">🔗 Ver en tienda</a>
              )}
              <div className="ml-auto flex gap-1">
                {confirm ? (
                  <>
                    <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => onDelete(order.id)}>Sí, borrar</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setConfirm(false)}>No</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive/60 hover:text-destructive" onClick={() => setConfirm(true)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

interface MercanciaSectionProps {
  orders: Order[];
  onAdd: (data: Partial<MerchandiseOrder>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Order>) => void;
  onDelete: (id: string) => void;
}

export function MercanciaSection({ orders, onAdd, onUpdate, onDelete }: MercanciaSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const merch = orders.filter(o => o.category === 'merchandise') as MerchandiseOrder[];
  const filtered = filter === 'all' ? merch : merch.filter(o => o.status === filter);

  const totalInvertido = merch.reduce((s, o) => s + o.pricePerUnit * o.unitsOrdered, 0);
  const totalGananciaP = merch.reduce((s, o) => s + ((o.suggestedPrice ?? 0) - o.pricePerUnit) * o.unitsOrdered, 0);
  const unidadesEnCamino = merch.filter(o => o.status === 'En Tránsito').reduce((s, o) => s + o.unitsOrdered, 0);
  const unidadesLlegadas = merch.filter(o => ['Llegó','En Venezuela','Entregado'].includes(o.status)).reduce((s, o) => s + o.unitsReceived, 0);

  return (
    <div className="space-y-4">

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">Invertido</p>
          <p className="text-xl font-black text-primary">{fmtMoney(totalInvertido)}</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${totalGananciaP >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ganancia potencial</p>
          <p className={`text-xl font-black ${totalGananciaP >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(totalGananciaP)}</p>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">En camino</p>
          <p className="text-xl font-black text-blue-700">{unidadesEnCamino} <span className="text-xs font-normal">unidades</span></p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Recibidas</p>
          <p className="text-xl font-black text-amber-700">{unidadesLlegadas} <span className="text-xs font-normal">unidades</span></p>
        </div>
      </div>

      {/* Filter + Add */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto flex-1 pb-1">
          {[{ key: 'all', label: `Todos (${merch.length})` }, ...STATUSES.map(s => ({ key: s.key, label: `${s.emoji} ${s.key}` }))].map(f => (
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
          <p className="text-4xl">📦</p>
          <p className="font-semibold text-foreground">
            {filter === 'all' ? 'Aún no tienes mercancía registrada' : `No hay mercancía con estado "${filter}"`}
          </p>
          {filter === 'all' && (
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar primera mercancía
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => (
            <MercCard key={o.id} order={o as MerchandiseOrder} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}

      <AddMercanciaDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={onAdd} />
    </div>
  );
}