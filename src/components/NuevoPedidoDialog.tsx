import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wand2, Camera, Clipboard, Loader2, X, Check, ChevronDown, Package, User, ShoppingBag, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Client } from '@/hooks/useClients';

type ProductType = 'client' | 'personal' | 'merchandise';

interface LineItem {
  id: string;
  name: string;
  photo: string;
  price: string;
  store: string;
  type: ProductType;
  clientId: string;
  clientName: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: Client[];
  onAddClient: (name: string) => Promise<string | null>;
  onSave: (items: LineItem[]) => Promise<void>;
  exchangeRate?: number | null;
}

const TYPE_CONFIG: Record<ProductType, { label: string; color: string; icon: React.ElementType }> = {
  client:      { label: 'Cliente',    color: 'bg-pink-100 text-pink-700 border-pink-300',   icon: User },
  personal:    { label: 'Personal',   color: 'bg-blue-100 text-blue-700 border-blue-300',   icon: ShoppingBag },
  merchandise: { label: 'Mercancía',  color: 'bg-purple-100 text-purple-700 border-purple-300', icon: Tag },
};

const makeId = () => Math.random().toString(36).slice(2);

async function compressImage(dataUrl: string, maxW = 900): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function cropImageFromBbox(imageBase64: string, bbox: [number, number, number, number]): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const [x1, y1, x2, y2] = bbox;
      const x = (x1 / 100) * img.width;
      const y = (y1 / 100) * img.height;
      const w = Math.max(1, ((x2 - x1) / 100) * img.width);
      const h = Math.max(1, ((y2 - y1) / 100) * img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w); canvas.height = Math.round(h);
      canvas.getContext('2d')!.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = imageBase64;
  });
}

export function NuevoPedidoDialog({ open, onOpenChange, clients, onAddClient, onSave, exchangeRate }: Props) {
  const { toast } = useToast();
  const screenshotRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState<Record<string, string>>({});
  const [showClientList, setShowClientList] = useState<string | null>(null);

  const reset = () => { setItems([]); setClientSearch({}); setShowClientList(null); };

  useEffect(() => { if (!open) reset(); }, [open]);

  // Ctrl+V paste
  useEffect(() => {
    if (!open) return;
    const onPaste = async (e: ClipboardEvent) => {
      for (const item of Array.from(e.clipboardData?.items || [])) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) { const r = new FileReader(); r.onload = async ev => analyzeImage(ev.target?.result as string); r.readAsDataURL(blob); }
          return;
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [open]);

  const analyzeImage = useCallback(async (raw: string) => {
    setAnalyzing(true);
    try {
      const compressed = await compressImage(raw, 1200);
      const { data } = await supabase.functions.invoke('extract-screenshot', { body: { imageBase64: compressed } });
      if (!data?.success || !data.orders?.length) {
        toast({ title: 'No se detectaron productos', description: 'Intenta con una imagen más clara', variant: 'destructive' });
        return;
      }
      const extracted: LineItem[] = [];
      for (const o of data.orders) {
        let photo = '';
        if (o.imageBbox?.length === 4) {
          try { photo = await cropImageFromBbox(compressed, o.imageBbox); } catch {}
        }
        extracted.push({
          id: makeId(),
          name: o.productName || 'Producto',
          photo,
          price: o.pricePaid ? String(o.pricePaid) : '',
          store: o.store || 'Otro',
          type: 'client',
          clientId: '',
          clientName: '',
        });
      }
      setItems(prev => [...prev, ...extracted]);
      toast({ title: `${extracted.length} producto${extracted.length !== 1 ? 's' : ''} detectado${extracted.length !== 1 ? 's' : ''}` });
    } catch {
      toast({ title: 'Error al analizar la imagen', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  }, [toast]);

  const handleFile = (file: File) => {
    const r = new FileReader();
    r.onload = e => analyzeImage(e.target?.result as string);
    r.readAsDataURL(file);
  };

  const addManual = () => {
    setItems(prev => [...prev, { id: makeId(), name: '', photo: '', price: '', store: 'Shein', type: 'client', clientId: '', clientName: '' }]);
  };

  const update = (id: string, patch: Partial<LineItem>) => {
    setItems(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
  };

  const remove = (id: string) => setItems(prev => prev.filter(x => x.id !== id));

  const handleSave = async () => {
    if (!items.length) { toast({ title: 'Agrega al menos un producto', variant: 'destructive' }); return; }
    const bad = items.find(x => x.type === 'client' && !x.clientId && !x.clientName.trim());
    if (bad) { toast({ title: 'Asigna un cliente a cada producto de cliente', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      // Resolve new client names to IDs
      const resolved = await Promise.all(items.map(async item => {
        if (item.type !== 'client') return item;
        if (item.clientId) return item;
        if (item.clientName.trim()) {
          const existing = clients.find(c => c.name.toLowerCase() === item.clientName.trim().toLowerCase());
          if (existing) return { ...item, clientId: existing.id };
          const newId = await onAddClient(item.clientName.trim());
          return { ...item, clientId: newId || '' };
        }
        return item;
      }));
      await onSave(resolved);
      toast({ title: `${items.length} producto${items.length !== 1 ? 's' : ''} guardado${items.length !== 1 ? 's' : ''}` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error al guardar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const rate = exchangeRate || 570;
  const total = items.reduce((s, x) => s + (parseFloat(x.price) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg w-full max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-lg font-bold">Nuevo pedido</DialogTitle>
        </DialogHeader>

        <div className="px-4 py-4 space-y-4">

          {/* AI screenshot zone */}
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-bold text-primary">Analizar screenshot con IA</p>
            </div>
            <p className="text-xs text-muted-foreground">Sube o pega (Ctrl+V) una captura de Shein, Temu, etc. La IA detecta todos los productos.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-xs border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => screenshotRef.current?.click()} disabled={analyzing}>
                {analyzing
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Analizando...</>
                  : <><Camera className="h-3.5 w-3.5 mr-1.5" />Subir screenshot</>}
              </Button>
              <Button variant="outline" className="h-9 px-3 border-primary/40 text-primary hover:bg-primary/10"
                disabled={analyzing} title="Pegar imagen (Ctrl+V)"
                onClick={async () => {
                  try {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                      const t = item.types.find(t => t.startsWith('image/'));
                      if (t) { const blob = await item.getType(t); const r = new FileReader(); r.onload = e => analyzeImage(e.target?.result as string); r.readAsDataURL(blob); return; }
                    }
                    toast({ title: 'No hay imagen en el portapapeles' });
                  } catch { toast({ title: 'Usa Ctrl+V en cualquier parte del diálogo' }); }
                }}>
                <Clipboard className="h-3.5 w-3.5" />
              </Button>
            </div>
            <input ref={screenshotRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {items.length} producto{items.length !== 1 ? 's' : ''} · Total ${total.toFixed(2)}
              </p>
              {items.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  clients={clients}
                  clientSearch={clientSearch[item.id] || item.clientName}
                  showClientList={showClientList === item.id}
                  onUpdate={patch => update(item.id, patch)}
                  onRemove={() => remove(item.id)}
                  onClientSearch={q => setClientSearch(prev => ({ ...prev, [item.id]: q }))}
                  onShowClientList={show => setShowClientList(show ? item.id : null)}
                  rate={rate}
                />
              ))}
            </div>
          )}

          {/* Add manual */}
          <button onClick={addManual} className="w-full h-10 rounded-xl border-2 border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5">
            + Agregar producto manualmente
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl"
            onClick={handleSave} disabled={saving || !items.length}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</> : `Guardar ${items.length} producto${items.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Individual item row ──────────────────────────────────────────────────────
function ItemRow({ item, clients, clientSearch, showClientList, onUpdate, onRemove, onClientSearch, onShowClientList, rate }: {
  item: LineItem;
  clients: Client[];
  clientSearch: string;
  showClientList: boolean;
  onUpdate: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
  onClientSearch: (q: string) => void;
  onShowClientList: (show: boolean) => void;
  rate: number;
}) {
  const TypeIcon = TYPE_CONFIG[item.type].icon;
  const filtered = clients.filter(c => c.name.toLowerCase().includes((clientSearch || '').toLowerCase())).slice(0, 6);
  const priceNum = parseFloat(item.price) || 0;
  const priceBs = priceNum * rate;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Top row: photo + name + price + remove */}
      <div className="flex items-start gap-2.5 p-3">
        {/* Photo */}
        <div className="h-16 w-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden border">
          {item.photo
            ? <img src={item.photo} alt="" className="h-full w-full object-cover" />
            : <Package className="h-6 w-6 m-5 text-muted-foreground" />}
        </div>
        {/* Name + store */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <input
            className="w-full text-sm font-semibold bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none"
            value={item.name}
            onChange={e => onUpdate({ name: e.target.value })}
            placeholder="Nombre del producto"
          />
          <input
            className="w-full text-xs text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none"
            value={item.store}
            onChange={e => onUpdate({ store: e.target.value })}
            placeholder="Tienda"
          />
        </div>
        {/* Price */}
        <div className="flex-shrink-0 text-right">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">$</span>
            <input
              className="w-16 text-sm font-bold text-right bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none"
              value={item.price}
              onChange={e => onUpdate({ price: e.target.value })}
              placeholder="0.00"
              type="number"
              step="0.01"
            />
          </div>
          {priceBs > 0 && <p className="text-[10px] text-muted-foreground">{priceBs.toFixed(0)} Bs</p>}
        </div>
        <button onClick={onRemove} className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0 mt-0.5">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Bottom row: type selector + client picker */}
      <div className="px-3 pb-3 space-y-2">
        {/* Type pills */}
        <div className="flex gap-1.5">
          {(Object.keys(TYPE_CONFIG) as ProductType[]).map(t => {
            const cfg = TYPE_CONFIG[t];
            const Icon = cfg.icon;
            return (
              <button
                key={t}
                onClick={() => onUpdate({ type: t, clientId: t !== 'client' ? '' : item.clientId, clientName: t !== 'client' ? '' : item.clientName })}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold transition-all ${item.type === t ? cfg.color : 'bg-muted/50 text-muted-foreground border-transparent hover:border-border'}`}
              >
                <Icon className="h-3 w-3" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Client picker — only when type === client */}
        {item.type === 'client' && (
          <div className="relative">
            <input
              className="w-full h-8 px-3 text-xs rounded-lg border border-border focus:border-primary focus:outline-none bg-background"
              placeholder="Buscar o escribir cliente..."
              value={clientSearch}
              onChange={e => { onClientSearch(e.target.value); onUpdate({ clientName: e.target.value, clientId: '' }); onShowClientList(true); }}
              onFocus={() => onShowClientList(true)}
            />
            {showClientList && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                {filtered.map(c => (
                  <button key={c.id} className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2"
                    onClick={() => { onUpdate({ clientId: c.id, clientName: c.name }); onClientSearch(c.name); onShowClientList(false); }}>
                    <User className="h-3 w-3 text-muted-foreground" />
                    {c.name}
                  </button>
                ))}
                {clientSearch && !filtered.find(c => c.name.toLowerCase() === clientSearch.toLowerCase()) && (
                  <button className="w-full text-left px-3 py-2 text-xs hover:bg-primary/5 text-primary font-semibold"
                    onClick={() => { onUpdate({ clientName: clientSearch, clientId: '' }); onShowClientList(false); }}>
                    + Crear "{clientSearch}"
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
