import { useState, useRef, useEffect } from 'react';
import {
  X, Camera, FileText, PenLine, Upload, Loader2,
  ChevronRight, Check, Plus, User, ShoppingBag, Home,
  ArrowLeft, Trash2, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useClients } from '@/hooks/useClients';

// ── Types ──────────────────────────────────────────────────────────────────
interface ScannedProduct {
  id: string;
  name: string;
  price: number;       // precio extraído por IA (referencia)
  store: string;
  imageUrl: string;
  category: 'client' | 'merchandise' | 'personal' | null;
  clientId: string | null;
  newClientName: string;
}

type Step = 'method' | 'upload' | 'scanning' | 'classify' | 'saving' | 'done';
type Method = 'screenshot' | 'invoice' | 'manual';

interface Props { open: boolean; onClose: () => void; }

function uid() { return Math.random().toString(36).slice(2, 10); }

const CATS = [
  { value: 'client'      as const, label: 'Cliente',   Icon: User,        active: 'bg-orange-500 text-white', idle: 'bg-orange-50 text-orange-600 border border-orange-100'  },
  { value: 'merchandise' as const, label: 'Mercancía', Icon: ShoppingBag, active: 'bg-purple-600 text-white', idle: 'bg-purple-50 text-purple-600 border border-purple-100'  },
  { value: 'personal'    as const, label: 'Personal',  Icon: Home,        active: 'bg-green-600 text-white',  idle: 'bg-green-50 text-green-700 border border-green-100'     },
];

// ── Main ───────────────────────────────────────────────────────────────────
export default function UploadComprasDialog({ open, onClose }: Props) {
  const { session } = useAuth();
  const { clients, refetch: refetchClients } = useClients();

  const [step,       setStep]       = useState<Step>('method');
  const [method,     setMethod]     = useState<Method | null>(null);
  const [products,   setProducts]   = useState<ScannedProduct[]>([]);
  const [totalPaid,  setTotalPaid]  = useState('');      // total real pagado por el pedido
  const [payMethod,  setPayMethod]  = useState('PayPal');
  const [showNewClient, setShowNewClient] = useState<Record<string, boolean>>({});

  // Manual form
  const [mName,  setMName]  = useState('');
  const [mPrice, setMPrice] = useState('');
  const [mStore, setMStore] = useState('SHEIN');

  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('method'); setMethod(null); setProducts([]);
    setTotalPaid(''); setPayMethod('PayPal');
    setShowNewClient({});
    setMName(''); setMPrice(''); setMStore('SHEIN');
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Paste (Ctrl+V) ────────────────────────────────────────────────────
  const toDataUrl = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const processFile = async (file: File) => {
    setStep('scanning');
    try {
      const base64 = await toDataUrl(file);
      const { data, error } = await supabase.functions.invoke('extract-screenshot', {
        body: { imageBase64: base64 }
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error ?? 'Error al escanear');

      const orders: any[] = data.orders ?? [];
      const scanned: ScannedProduct[] = orders.map((o: any) => ({
        id: uid(),
        name:  o.productName ?? 'Producto',
        price: parseFloat(o.pricePaid) || 0,
        store: o.store ?? 'SHEIN',
        imageUrl: base64,
        category: null, clientId: null, newClientName: '',
      }));

      if (scanned.length === 0) {
        scanned.push({ id: uid(), name: 'Producto escaneado', price: 0, store: 'SHEIN', imageUrl: base64, category: null, clientId: null, newClientName: '' });
      }

      // Pre-fill total with sum of extracted prices
      const sum = scanned.reduce((a, p) => a + p.price, 0);
      if (sum > 0) setTotalPaid(sum.toFixed(2));

      setProducts(scanned);
      setStep('classify');
    } catch (err: any) {
      toast.error('Error al escanear: ' + (err.message ?? 'Intenta de nuevo'));
      setStep('upload');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { await processFile(file); break; }
      }
    }
  };

  useEffect(() => {
    if (step !== 'upload') return;
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, method]);

  // ── Method ────────────────────────────────────────────────────────────
  const selectMethod = (m: Method) => {
    setMethod(m);
    setStep(m === 'manual' ? 'classify' : 'upload');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  // ── Manual add ────────────────────────────────────────────────────────
  const addManual = () => {
    if (!mName.trim()) return;
    const p: ScannedProduct = {
      id: uid(), name: mName.trim(), price: parseFloat(mPrice) || 0,
      store: mStore, imageUrl: '', category: null, clientId: null, newClientName: '',
    };
    setProducts(prev => [...prev, p]);
    setMName(''); setMPrice('');
  };

  // ── Classify helpers ──────────────────────────────────────────────────
  const setCategory   = (id: string, cat: ScannedProduct['category']) =>
    setProducts(p => p.map(x => x.id === id ? { ...x, category: cat, clientId: null } : x));
  const setClient     = (id: string, cid: string) =>
    setProducts(p => p.map(x => x.id === id ? { ...x, clientId: cid } : x));
  const setNewName    = (id: string, name: string) =>
    setProducts(p => p.map(x => x.id === id ? { ...x, newClientName: name } : x));
  const removeProduct = (id: string) =>
    setProducts(p => p.filter(x => x.id !== id));

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (products.some(p => !p.category)) {
      toast.error('Clasifica todos los productos antes de guardar');
      return;
    }
    if (!totalPaid || parseFloat(totalPaid) <= 0) {
      toast.error('Ingresa el total que pagaste por este pedido');
      return;
    }

    setStep('saving');
    try {
      const userId  = session!.user.id;
      const total   = parseFloat(totalPaid);

      // Distribute total proportionally among products (by extracted price ratio)
      const sumExtracted = products.reduce((a, p) => a + (p.price || 1), 0);
      const getPricePaid = (p: ScannedProduct) => {
        if (products.length === 1) return total;
        const ratio = (p.price || 1) / sumExtracted;
        return parseFloat((total * ratio).toFixed(2));
      };

      // Group client products by client
      const clientGroups: Record<string, ScannedProduct[]> = {};

      for (const p of products) {
        if (p.category !== 'client') {
          await supabase.from('orders').insert({
            user_id: userId,
            product_name: p.name,
            price_paid: getPricePaid(p),
            store: p.store,
            product_photo: p.imageUrl?.startsWith('data:') ? null : p.imageUrl,
            category: p.category,
            status: 'Pendiente',
            amount_paid: p.category === 'personal' ? getPricePaid(p) : null,
            payment_method: p.category === 'personal' ? payMethod : null,
          });
          continue;
        }

        // Resolve client
        let clientId = p.clientId;
        if (!clientId && p.newClientName.trim()) {
          const { data: nc, error } = await supabase
            .from('clients')
            .insert({ name: p.newClientName.trim(), user_id: userId })
            .select().single();
          if (error) throw error;
          clientId = nc.id;
        }
        if (!clientId) {
          toast.error(`Selecciona un cliente para "${p.name}"`);
          setStep('classify'); return;
        }
        if (!clientGroups[clientId]) clientGroups[clientId] = [];
        clientGroups[clientId].push({ ...p, clientId });
      }

      // Create client_order per client group
      for (const [clientId, cps] of Object.entries(clientGroups)) {
        const groupTotal = cps.reduce((a, p) => a + getPricePaid(p), 0);
        const { data: co, error: coErr } = await supabase
          .from('client_orders')
          .insert({
            user_id: userId,
            client_id: clientId,
            product_payment_status: 'Pendiente',
            shipping_payment_status: 'Pendiente',
            brother_involved: false,
            status: 'Pendiente',
            amount_charged: groupTotal,
          })
          .select().single();
        if (coErr) throw coErr;

        for (const p of cps) {
          await supabase.from('orders').insert({
            user_id: userId,
            product_name: p.name,
            price_paid: getPricePaid(p),
            store: p.store,
            product_photo: p.imageUrl?.startsWith('data:') ? null : p.imageUrl,
            category: 'client',
            client_order_id: co.id,
            status: 'Pendiente',
          });
        }
      }

      await refetchClients();
      setStep('done');
    } catch (err: any) {
      toast.error('Error al guardar: ' + (err.message ?? 'Intenta de nuevo'));
      setStep('classify');
    }
  };

  if (!open) return null;

  const activeClients  = (clients ?? []).filter(c => !c.deleted_at);
  const allClassified  = products.length > 0 && products.every(p => p.category);
  const extractedTotal = products.reduce((a, p) => a + p.price, 0);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[92vh] shadow-2xl">
        {/* Drag handle */}
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
              {step === 'classify' && `Clasificar productos${products.length > 0 ? ` (${products.length})` : ''}`}
              {step === 'saving'   && 'Guardando...'}
              {step === 'done'     && '¡Guardado!'}
            </h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── METHOD ── */}
          {step === 'method' && (
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-500">¿Cómo quieres subir tus compras?</p>
              {[
                { m: 'screenshot' as Method, icon: Camera,   title: 'Captura de pantalla', desc: 'Foto o screenshot del carrito / producto',  iconCls: 'text-orange-500', bgCls: 'bg-orange-50' },
                { m: 'invoice'    as Method, icon: FileText,  title: 'Factura / Orden',     desc: 'PDF o imagen de la orden completa',         iconCls: 'text-blue-500',   bgCls: 'bg-blue-50'   },
                { m: 'manual'     as Method, icon: PenLine,   title: 'Manual',              desc: 'Escribe los productos uno por uno',         iconCls: 'text-green-600',  bgCls: 'bg-green-50'  },
              ].map(({ m, icon: Icon, title, desc, iconCls, bgCls }) => (
                <button key={m} onClick={() => selectMethod(m)}
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

          {/* ── UPLOAD ── */}
          {step === 'upload' && (
            <div className="p-5 space-y-3">
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
              <div
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-orange-200 rounded-2xl py-10 flex flex-col items-center gap-3 bg-orange-50/40 cursor-pointer hover:border-orange-400 hover:bg-orange-50/70 transition"
              >
                <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                  <Upload className="w-6 h-6 text-orange-500" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">
                    {method === 'invoice' ? 'Sube la factura' : 'Sube la captura'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {method === 'invoice' ? 'PDF o imagen de la orden' : 'Foto o screenshot del carrito'}
                  </p>
                </div>
                <span className="text-xs font-medium bg-orange-100 text-orange-600 px-3 py-1 rounded-full">
                  Seleccionar archivo
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">o</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 border border-gray-100">
                <kbd className="px-2 py-1 rounded-md bg-white border border-gray-200 text-xs font-mono text-gray-600 shadow-sm">Ctrl</kbd>
                <span className="text-gray-400 text-xs">+</span>
                <kbd className="px-2 py-1 rounded-md bg-white border border-gray-200 text-xs font-mono text-gray-600 shadow-sm">V</kbd>
                <span className="text-xs text-gray-500 ml-1">para pegar del portapapeles</span>
              </div>
            </div>
          )}

          {/* ── SCANNING ── */}
          {step === 'scanning' && (
            <div className="py-20 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
              <p className="font-semibold text-gray-900">Analizando imagen...</p>
              <p className="text-sm text-gray-400">Extrayendo todos los productos</p>
            </div>
          )}

          {/* ── CLASSIFY ── */}
          {step === 'classify' && (
            <div className="p-5 space-y-5">

              {/* Manual add form */}
              {method === 'manual' && (
                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Agregar producto</p>
                  <input value={mName} onChange={e => setMName(e.target.value)}
                    placeholder="Nombre del producto"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                  <div className="flex gap-2">
                    <input value={mPrice} onChange={e => setMPrice(e.target.value)}
                      placeholder="Precio $" type="number" step="0.01"
                      className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                    />
                    <select value={mStore} onChange={e => setMStore(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none"
                    >
                      {['SHEIN','Temu','AliExpress','Amazon','Otro'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <button onClick={addManual} disabled={!mName.trim()}
                    className="w-full h-10 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: 'hsl(14 90% 58%)' }}
                  >
                    <Plus className="w-4 h-4" /> Agregar producto
                  </button>
                </div>
              )}

              {/* Product list */}
              {products.length === 0 && method === 'manual' ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-400">Agrega al menos un producto para continuar</p>
                </div>
              ) : (
                <>
                  {/* Header row */}
                  {products.length > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                        {products.length} producto{products.length !== 1 ? 's' : ''} detectado{products.length !== 1 ? 's' : ''}
                      </p>
                      {extractedTotal > 0 && (
                        <span className="text-xs text-gray-400">
                          Suma IA: <span className="font-semibold text-gray-600">${extractedTotal.toFixed(2)}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Cards */}
                  <div className="space-y-3">
                    {products.map((p, idx) => (
                      <ProductRow
                        key={p.id}
                        product={p}
                        index={idx + 1}
                        clients={activeClients}
                        showNewClient={showNewClient[p.id] ?? false}
                        onSetCategory={cat => setCategory(p.id, cat)}
                        onSetClient={cid => setClient(p.id, cid)}
                        onSetNewName={name => setNewName(p.id, name)}
                        onToggleNew={v => setShowNewClient(prev => ({ ...prev, [p.id]: v }))}
                        onRemove={() => removeProduct(p.id)}
                      />
                    ))}
                  </div>

                  {/* ── TOTAL PAID SECTION ── */}
                  {products.length > 0 && (
                    <div className="rounded-2xl border-2 border-orange-100 bg-orange-50/40 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-orange-500" />
                        <p className="font-semibold text-gray-900 text-sm">Total que pagaste por este pedido</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        Ingresa el total real que pagaste (incluyendo todos los productos de esta factura).
                        {extractedTotal > 0 && ` La IA detectó $${extractedTotal.toFixed(2)} — corrígelo si es diferente.`}
                      </p>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">$</span>
                          <input
                            value={totalPaid}
                            onChange={e => setTotalPaid(e.target.value)}
                            placeholder="0.00"
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full h-11 pl-7 pr-3 rounded-xl border-2 border-orange-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300 transition"
                          />
                        </div>
                        <select
                          value={payMethod}
                          onChange={e => setPayMethod(e.target.value)}
                          className="h-11 px-3 rounded-xl border-2 border-orange-200 bg-white text-sm focus:outline-none"
                        >
                          {['PayPal','Binance','PagoMóvil','Zelle','Efectivo','Otro'].map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Save button */}
                  {products.length > 0 && (
                    <button
                      onClick={handleSave}
                      disabled={!allClassified || !totalPaid || parseFloat(totalPaid) <= 0}
                      className="w-full h-12 rounded-xl text-white font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-40"
                      style={{ background: 'hsl(14 90% 58%)' }}
                    >
                      <Check className="w-4 h-4" />
                      Guardar {products.length} producto{products.length !== 1 ? 's' : ''}
                      {totalPaid && parseFloat(totalPaid) > 0 ? ` · $${parseFloat(totalPaid).toFixed(2)}` : ''}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── SAVING ── */}
          {step === 'saving' && (
            <div className="py-20 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              <p className="text-sm text-gray-500">Guardando productos...</p>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div className="py-16 flex flex-col items-center gap-4 px-5">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900 text-lg">¡Productos guardados!</p>
                <p className="text-sm text-gray-500 mt-1">
                  {products.length} producto{products.length !== 1 ? 's' : ''} · ${parseFloat(totalPaid || '0').toFixed(2)} registrado{products.length !== 1 ? 's' : ''}.
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

// ── ProductRow ─────────────────────────────────────────────────────────────
interface RowProps {
  product: ScannedProduct;
  index: number;
  clients: any[];
  showNewClient: boolean;
  onSetCategory: (cat: ScannedProduct['category']) => void;
  onSetClient: (id: string) => void;
  onSetNewName: (name: string) => void;
  onToggleNew: (show: boolean) => void;
  onRemove: () => void;
}

function ProductRow({ product, index, clients, showNewClient, onSetCategory, onSetClient, onSetNewName, onToggleNew, onRemove }: RowProps) {
  return (
    <div className={`rounded-2xl border-2 bg-white transition ${product.category ? 'border-gray-100' : 'border-orange-100'}`}>
      {/* Product info row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">{product.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">{product.store}</span>
            {product.price > 0 && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-xs font-semibold text-gray-600">${product.price.toFixed(2)}</span>
              </>
            )}
          </div>
        </div>
        <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-red-50 transition flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5 text-gray-300 hover:text-red-400" />
        </button>
      </div>

      {/* Category selector */}
      <div className="px-4 pb-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">¿Para quién es?</p>
        <div className="flex gap-2">
          {CATS.map(({ value, label, Icon, active, idle }) => (
            <button
              key={value}
              onClick={() => onSetCategory(value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-semibold transition ${product.category === value ? active : idle}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Client selector */}
      {product.category === 'client' && (
        <div className="px-4 pb-4 space-y-2">
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
              <button onClick={() => onToggleNew(false)} className="px-3 h-9 rounded-xl border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition">
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
