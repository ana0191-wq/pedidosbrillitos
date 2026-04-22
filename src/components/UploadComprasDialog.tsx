import { useState, useRef, useEffect } from 'react';
import {
  X, Camera, FileText, PenLine, Upload, Loader2,
  ChevronRight, Check, Plus, User, ShoppingBag, Home, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useClients } from '@/hooks/useClients';

// ── Types ──────────────────────────────────────────────────────────────────
interface ScannedProduct {
  id: string;
  name: string;
  price: number;
  store: string;
  imageUrl: string;
  category: 'client' | 'merchandise' | 'personal' | null;
  clientId: string | null;
  newClientName: string;
}

type Step = 'method' | 'upload' | 'scanning' | 'classify' | 'saving' | 'done';
type Method = 'screenshot' | 'invoice' | 'manual';

interface Props {
  open: boolean;
  onClose: () => void;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

// ── Main component ─────────────────────────────────────────────────────────
export default function UploadComprasDialog({ open, onClose }: Props) {
  const { session } = useAuth();
  const { clients, refetch: refetchClients } = useClients();

  const [step,     setStep]     = useState<Step>('method');
  const [method,   setMethod]   = useState<Method | null>(null);
  const [products, setProducts] = useState<ScannedProduct[]>([]);
  const [saving,   setSaving]   = useState(false);
  const [showNewClient, setShowNewClient] = useState<Record<string, boolean>>({});

  // Manual form
  const [mName,  setMName]  = useState('');
  const [mPrice, setMPrice] = useState('');
  const [mStore, setMStore] = useState('SHEIN');

  const fileRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Attach paste listener when on upload step
  useEffect(() => {
    if (step !== 'upload') return;
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, method]);

  // Ctrl+V paste support
  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        // Simulate file input change
        await processFile(file);
        break;
      }
    }
  };

  // Shared file processor (used by input + paste + drop)
  const processFile = async (file: File) => {
    setStep('scanning');
    try {
      const ext  = file.name?.split('.').pop() ?? 'jpg';
      const path = `scans/${session!.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('order-photos')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('order-photos')
        .getPublicUrl(path);

      const { data, error } = await supabase.functions.invoke('scan-products', {
        body: { imageUrl: publicUrl, mode: method }
      });
      if (error) throw error;

      const scanned: ScannedProduct[] = (data?.products ?? []).map((p: any) => ({
        id: uid(), name: p.name ?? 'Producto', price: parseFloat(p.price) || 0,
        store: p.store ?? 'SHEIN', imageUrl: p.imageUrl ?? publicUrl,
        category: null, clientId: null, newClientName: '',
      }));
      if (scanned.length === 0) {
        scanned.push({ id: uid(), name: 'Producto escaneado', price: 0, store: 'SHEIN', imageUrl: publicUrl, category: null, clientId: null, newClientName: '' });
      }
      setProducts(scanned);
      setStep('classify');
    } catch (err: any) {
      toast.error('Error al escanear: ' + (err.message ?? 'Intenta de nuevo'));
      setStep('upload');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const reset = () => {
    setStep('method'); setMethod(null); setProducts([]); setSaving(false);
    setShowNewClient({}); setMName(''); setMPrice(''); setMStore('SHEIN');
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Method selection ───────────────────────────────────────────────────
  const selectMethod = (m: Method) => {
    setMethod(m);
    setStep(m === 'manual' ? 'classify' : 'upload');
  };

  // ── File scan ─────────────────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  // ── Manual add ────────────────────────────────────────────────────────
  const addManual = () => {
    if (!mName.trim()) return;
    setProducts(prev => [...prev, {
      id: uid(), name: mName.trim(), price: parseFloat(mPrice) || 0,
      store: mStore, imageUrl: '', category: null, clientId: null, newClientName: '',
    }]);
    setMName(''); setMPrice('');
  };

  // ── Classify helpers ──────────────────────────────────────────────────
  const setCategory    = (id: string, cat: ScannedProduct['category']) =>
    setProducts(p => p.map(x => x.id === id ? { ...x, category: cat, clientId: null } : x));
  const setClient      = (id: string, cid: string) =>
    setProducts(p => p.map(x => x.id === id ? { ...x, clientId: cid } : x));
  const setNewName     = (id: string, name: string) =>
    setProducts(p => p.map(x => x.id === id ? { ...x, newClientName: name } : x));
  const removeProduct  = (id: string) =>
    setProducts(p => p.filter(x => x.id !== id));

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (products.some(p => !p.category)) {
      toast.error('Clasifica todos los productos antes de guardar');
      return;
    }
    setSaving(true);
    setStep('saving');

    try {
      const userId = session!.user.id;
      // Group client products by clientId (resolve new clients first)
      const clientGroups: Record<string, ScannedProduct[]> = {};

      for (const p of products) {
        if (p.category !== 'client') {
          await supabase.from('orders').insert({
            user_id: userId, product_name: p.name, price_paid: p.price,
            store: p.store, product_photo: p.imageUrl || null,
            category: p.category, status: 'Pendiente',
          });
          continue;
        }

        // Resolve client
        let clientId = p.clientId;
        if (!clientId && p.newClientName.trim()) {
          const { data: nc, error } = await supabase
            .from('clients')
            .insert({ name: p.newClientName.trim(), user_id: userId })
            .select()
            .single();
          if (error) throw error;
          clientId = nc.id;
        }
        if (!clientId) {
          toast.error(`Selecciona o crea un cliente para "${p.name}"`);
          setSaving(false); setStep('classify'); return;
        }
        if (!clientGroups[clientId]) clientGroups[clientId] = [];
        clientGroups[clientId].push({ ...p, clientId });
      }

      // Create client_order per client group
      for (const [clientId, cps] of Object.entries(clientGroups)) {
        const { data: co, error: coErr } = await supabase
          .from('client_orders')
          .insert({
            user_id: userId, client_id: clientId,
            product_payment_status: 'Pendiente',
            shipping_payment_status: 'Pendiente',
            brother_involved: false, status: 'Pendiente',
          })
          .select().single();
        if (coErr) throw coErr;

        for (const p of cps) {
          await supabase.from('orders').insert({
            user_id: userId, product_name: p.name, price_paid: p.price,
            store: p.store, product_photo: p.imageUrl || null,
            category: 'client', client_order_id: co.id, status: 'Pendiente',
          });
        }
      }

      await refetchClients();
      setStep('done');
    } catch (err: any) {
      toast.error('Error al guardar: ' + (err.message ?? 'Intenta de nuevo'));
      setSaving(false); setStep('classify');
    }
  };

  if (!open) return null;

  const activeClients = (clients ?? []).filter(c => !c.deleted_at);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[92vh] shadow-2xl">
        {/* Mobile drag handle */}
        <div className="sm:hidden w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {step !== 'method' && step !== 'done' && (
              <button
                onClick={() => {
                  if (step === 'classify') setStep(method === 'manual' ? 'method' : 'upload');
                  else setStep('method');
                }}
                className="p-1.5 rounded-xl hover:bg-gray-100 transition"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
            )}
            <h2 className="font-bold text-gray-900 text-base">
              {step === 'method'   && 'Subir compras'}
              {step === 'upload'   && 'Seleccionar archivo'}
              {step === 'scanning' && 'Escaneando...'}
              {step === 'classify' && `Clasificar${products.length > 0 ? ` (${products.length})` : ''}`}
              {step === 'saving'   && 'Guardando...'}
              {step === 'done'     && '¡Listo!'}
            </h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* METHOD */}
          {step === 'method' && (
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-500 mb-2">¿Cómo quieres subir tus compras?</p>
              {[
                { m: 'screenshot' as Method, icon: Camera,   title: 'Captura de pantalla', desc: 'Foto o screenshot del carrito / producto',    iconCls: 'text-orange-500', bgCls: 'bg-orange-50' },
                { m: 'invoice'    as Method, icon: FileText,  title: 'Factura SHEIN / Temu', desc: 'PDF o imagen de la orden completa',           iconCls: 'text-blue-500',   bgCls: 'bg-blue-50'   },
                { m: 'manual'     as Method, icon: PenLine,   title: 'Manual',               desc: 'Escribe los productos uno por uno',           iconCls: 'text-green-600',  bgCls: 'bg-green-50'  },
              ].map(({ m, icon: Icon, title, desc, iconCls, bgCls }) => (
                <button
                  key={m}
                  onClick={() => selectMethod(m)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-orange-200 hover:bg-orange-50/40 transition text-left group"
                >
                  <div className={`w-11 h-11 rounded-xl ${bgCls} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${iconCls}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition" />
                </button>
              ))}
            </div>
          )}

          {/* UPLOAD */}
          {step === 'upload' && (
            <div className="p-5 space-y-3">
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />

              {/* Paste zone — highlighted when on this step */}
              <div
                className="w-full border-2 border-dashed border-orange-200 rounded-2xl py-10 flex flex-col items-center gap-3 bg-orange-50/40 cursor-pointer hover:border-orange-400 hover:bg-orange-50/70 transition"
                onClick={() => fileRef.current?.click()}
              >
                <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                  <Upload className="w-6 h-6 text-orange-500" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">
                    {method === 'invoice' ? 'Sube la factura' : 'Sube la captura'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {method === 'invoice' ? 'PDF o imagen de la orden' : 'Foto o screenshot del producto'}
                  </p>
                </div>
                <span className="text-xs font-medium bg-orange-100 text-orange-600 px-3 py-1 rounded-full">
                  Seleccionar archivo
                </span>
              </div>

              {/* Ctrl+V hint */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">o</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 border border-gray-100">
                <kbd className="px-2 py-1 rounded-md bg-white border border-gray-200 text-xs font-mono text-gray-600 shadow-sm">Ctrl</kbd>
                <span className="text-gray-400 text-xs">+</span>
                <kbd className="px-2 py-1 rounded-md bg-white border border-gray-200 text-xs font-mono text-gray-600 shadow-sm">V</kbd>
                <span className="text-xs text-gray-500 ml-1">para pegar imagen del portapapeles</span>
              </div>
            </div>
          )}

          {/* SCANNING */}
          {step === 'scanning' && (
            <div className="py-20 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
              <p className="font-semibold text-gray-900">Analizando imagen...</p>
              <p className="text-sm text-gray-400">Extrayendo productos automáticamente</p>
            </div>
          )}

          {/* CLASSIFY */}
          {step === 'classify' && (
            <div className="p-5 space-y-4">

              {/* Manual form */}
              {method === 'manual' && (
                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Agregar producto</p>
                  <input
                    value={mName} onChange={e => setMName(e.target.value)}
                    placeholder="Nombre del producto"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                  <div className="flex gap-2">
                    <input
                      value={mPrice} onChange={e => setMPrice(e.target.value)}
                      placeholder="Precio $" type="number" step="0.01"
                      className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                    />
                    <select
                      value={mStore} onChange={e => setMStore(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                    >
                      {['SHEIN','Temu','AliExpress','Amazon','Otro'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={addManual} disabled={!mName.trim()}
                    className="w-full h-10 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: 'hsl(14 90% 58%)' }}
                  >
                    <Plus className="w-4 h-4" /> Agregar
                  </button>
                </div>
              )}

              {products.length === 0 && method === 'manual' && (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-400">Agrega al menos un producto para continuar</p>
                </div>
              )}

              {/* Product cards */}
              {products.map(p => (
                <ClassifyCard
                  key={p.id}
                  product={p}
                  clients={activeClients}
                  showNewClient={showNewClient[p.id] ?? false}
                  onSetCategory={cat => setCategory(p.id, cat)}
                  onSetClient={cid => setClient(p.id, cid)}
                  onSetNewName={name => setNewName(p.id, name)}
                  onToggleNew={v => setShowNewClient(prev => ({ ...prev, [p.id]: v }))}
                  onRemove={() => removeProduct(p.id)}
                />
              ))}

              {/* Save */}
              {products.length > 0 && (
                <button
                  onClick={handleSave}
                  className="w-full h-12 rounded-xl text-white font-semibold hover:opacity-90 transition flex items-center justify-center gap-2"
                  style={{ background: 'hsl(14 90% 58%)' }}
                >
                  <Check className="w-4 h-4" />
                  Guardar {products.length} producto{products.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {/* SAVING */}
          {step === 'saving' && (
            <div className="py-20 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              <p className="text-sm text-gray-500">Guardando productos...</p>
            </div>
          )}

          {/* DONE */}
          {step === 'done' && (
            <div className="py-16 flex flex-col items-center gap-4 px-5">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900 text-lg">¡Productos guardados!</p>
                <p className="text-sm text-gray-500 mt-1">
                  {products.length} producto{products.length !== 1 ? 's' : ''} registrado{products.length !== 1 ? 's' : ''}.
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={reset} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  Subir más
                </button>
                <button onClick={handleClose} className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition" style={{ background: 'hsl(14 90% 58%)' }}>
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ClassifyCard ───────────────────────────────────────────────────────────
interface CardProps {
  product: ScannedProduct;
  clients: any[];
  showNewClient: boolean;
  onSetCategory: (cat: ScannedProduct['category']) => void;
  onSetClient: (id: string) => void;
  onSetNewName: (name: string) => void;
  onToggleNew: (show: boolean) => void;
  onRemove: () => void;
}

const CATS = [
  { value: 'client'      as const, label: 'Cliente',   Icon: User,        active: 'bg-orange-500 text-white', idle: 'bg-orange-50 text-orange-600'  },
  { value: 'merchandise' as const, label: 'Mercancía', Icon: ShoppingBag, active: 'bg-purple-600 text-white', idle: 'bg-purple-50 text-purple-600'  },
  { value: 'personal'    as const, label: 'Personal',  Icon: Home,        active: 'bg-green-600 text-white',  idle: 'bg-green-50 text-green-700'    },
];

function ClassifyCard({ product, clients, showNewClient, onSetCategory, onSetClient, onSetNewName, onToggleNew, onRemove }: CardProps) {
  return (
    <div className={`rounded-2xl border-2 p-4 space-y-3 transition bg-white ${
      product.category ? 'border-gray-100' : 'border-orange-100'
    }`}>
      {/* Product info */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-gray-300" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">{product.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400">{product.store}</span>
            <span className="text-xs font-semibold text-gray-700">${product.price.toFixed(2)}</span>
          </div>
        </div>
        <button onClick={onRemove} className="p-1 rounded-lg hover:bg-gray-100 transition flex-shrink-0">
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {/* Category */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">¿Para quién es?</p>
        <div className="flex gap-2">
          {CATS.map(({ value, label, Icon, active, idle }) => (
            <button
              key={value}
              onClick={() => onSetCategory(value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition ${
                product.category === value ? active : idle
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Client selector */}
      {product.category === 'client' && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">¿Qué cliente?</p>
          {!showNewClient ? (
            <div className="flex gap-2">
              <select
                value={product.clientId ?? ''}
                onChange={e => onSetClient(e.target.value)}
                className="flex-1 h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                <option value="">Seleccionar cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                onClick={() => onToggleNew(true)}
                className="px-3 h-9 rounded-xl border border-dashed border-orange-300 text-orange-500 text-xs font-medium hover:bg-orange-50 transition flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Nuevo
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={product.newClientName}
                onChange={e => onSetNewName(e.target.value)}
                placeholder="Nombre del cliente"
                autoFocus
                className="flex-1 h-9 px-3 rounded-xl border border-orange-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <button
                onClick={() => onToggleNew(false)}
                className="px-3 h-9 rounded-xl border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}