import { useState, useRef, useCallback } from 'react';
import { X, Camera, FileText, PenLine, Upload, Loader2, ChevronRight, Check, Plus, User, ShoppingBag, Home, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useClients } from '@/hooks/useClients';
import { useOrders } from '@/hooks/useOrders';
import { useClientOrders } from '@/hooks/useClientOrders';

// ── Types ──────────────────────────────────────────────────────────────────
interface ScannedProduct {
  id: string;
  name: string;
  price: number;
  store: string;
  imageUrl: string;
  // classification
  category: 'client' | 'merchandise' | 'personal' | null;
  clientId: string | null;
  newClientName: string;
}

type Step = 'method' | 'upload' | 'scanning' | 'classify' | 'saving' | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Component ──────────────────────────────────────────────────────────────
export default function UploadComprasDialog({ open, onClose }: Props) {
  const { session } = useAuth();
  const { clients, refetch: refetchClients } = useClients();
  const { refetch: refetchOrders } = useOrders();
  const { refetch: refetchClientOrders } = useClientOrders();

  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<'screenshot' | 'invoice' | 'manual' | null>(null);
  const [products, setProducts] = useState<ScannedProduct[]>([]);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [showNewClientInput, setShowNewClientInput] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual form state
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualStore, setManualStore] = useState('SHEIN');
  const [manualImage, setManualImage] = useState('');

  const reset = () => {
    setStep('method');
    setMethod(null);
    setProducts([]);
    setScanning(false);
    setSaving(false);
    setActiveProductId(null);
    setShowNewClientInput({});
    setManualName('');
    setManualPrice('');
    setManualStore('SHEIN');
    setManualImage('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Method selection ──────────────────────────────────────────────────
  const selectMethod = (m: 'screenshot' | 'invoice' | 'manual') => {
    setMethod(m);
    if (m === 'manual') {
      setStep('classify'); // go straight to manual form
    } else {
      setStep('upload');
    }
  };

  // ── File upload + AI scan ─────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep('scanning');
    setScanning(true);

    try {
      // Upload image to Supabase storage for vision
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `scans/${session!.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('order-photos')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('order-photos')
        .getPublicUrl(path);

      // Call AI via edge function
      const { data, error } = await supabase.functions.invoke('scan-products', {
        body: { imageUrl: publicUrl, mode: method }
      });

      if (error) throw error;

      const scanned: ScannedProduct[] = (data.products ?? []).map((p: any) => ({
        id: uid(),
        name: p.name ?? 'Producto sin nombre',
        price: parseFloat(p.price) || 0,
        store: p.store ?? 'SHEIN',
        imageUrl: p.imageUrl ?? publicUrl,
        category: null,
        clientId: null,
        newClientName: '',
      }));

      if (scanned.length === 0) {
        // Fallback: create one product from image
        scanned.push({
          id: uid(),
          name: 'Producto escaneado',
          price: 0,
          store: 'SHEIN',
          imageUrl: publicUrl,
          category: null,
          clientId: null,
          newClientName: '',
        });
      }

      setProducts(scanned);
      setStep('classify');
    } catch (err: any) {
      toast.error('Error al escanear: ' + err.message);
      setStep('upload');
    } finally {
      setScanning(false);
    }
  };

  // ── Manual product add ─────────────────────────────────────────────────
  const addManualProduct = () => {
    if (!manualName.trim()) return;
    const p: ScannedProduct = {
      id: uid(),
      name: manualName.trim(),
      price: parseFloat(manualPrice) || 0,
      store: manualStore,
      imageUrl: manualImage,
      category: null,
      clientId: null,
      newClientName: '',
    };
    setProducts(prev => [...prev, p]);
    setManualName('');
    setManualPrice('');
    setManualImage('');
  };

  // ── Classify a product ─────────────────────────────────────────────────
  const setCategory = (id: string, cat: ScannedProduct['category']) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, category: cat, clientId: null } : p));
  };

  const setClient = (id: string, clientId: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, clientId } : p));
  };

  const setNewClientName = (id: string, name: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, newClientName: name } : p));
  };

  // ── Save all ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    const unclassified = products.filter(p => !p.category);
    if (unclassified.length > 0) {
      toast.error('Clasifica todos los productos antes de guardar');
      return;
    }

    setSaving(true);
    setStep('saving');

    try {
      const userId = session!.user.id;

      // Group client products by client
      const clientProducts: Record<string, ScannedProduct[]> = {};

      for (const p of products) {
        if (p.category === 'client') {
          // Create new client if needed
          let clientId = p.clientId;
          if (!clientId && p.newClientName.trim()) {
            const { data: newClient, error } = await supabase
              .from('clients')
              .insert({ name: p.newClientName.trim(), user_id: userId })
              .select()
              .single();
            if (error) throw error;
            clientId = newClient.id;
          }
          if (!clientId) {
            toast.error(`Selecciona o crea un cliente para "${p.name}"`);
            setSaving(false);
            setStep('classify');
            return;
          }
          if (!clientProducts[clientId]) clientProducts[clientId] = [];
          clientProducts[clientId].push({ ...p, clientId });
        } else {
          // Insert as order directly
          await supabase.from('orders').insert({
            user_id: userId,
            product_name: p.name,
            price_paid: p.price,
            store: p.store,
            product_photo: p.imageUrl || null,
            category: p.category,
            status: 'Pendiente',
          });
        }
      }

      // For each client group, create a client_order + order items
      for (const [clientId, cps] of Object.entries(clientProducts)) {
        // Create client_order
        const { data: co, error: coErr } = await supabase
          .from('client_orders')
          .insert({
            user_id: userId,
            client_id: clientId,
            product_payment_status: 'Pendiente',
            shipping_payment_status: 'Pendiente',
            brother_involved: false,
            status: 'Pendiente',
          })
          .select()
          .single();
        if (coErr) throw coErr;

        // Insert each product as an order linked to this client_order
        for (const p of cps) {
          await supabase.from('orders').insert({
            user_id: userId,
            product_name: p.name,
            price_paid: p.price,
            store: p.store,
            product_photo: p.imageUrl || null,
            category: 'client',
            client_order_id: co.id,
            status: 'Pendiente',
          });
        }
      }

      await refetchOrders();
      await refetchClientOrders();
      await refetchClients();
      setStep('done');
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
      setSaving(false);
      setStep('classify');
    }
  };

  if (!open) return null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Sheet */}
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Handle (mobile) */}
        <div className="sm:hidden w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'method' && step !== 'done' && (
              <button
                onClick={() => setStep(step === 'classify' ? (method === 'manual' ? 'method' : 'upload') : 'method')}
                className="p-1.5 rounded-xl hover:bg-gray-100 transition"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
            )}
            <h2 className="font-bold text-gray-900">
              {step === 'method' && 'Subir compras'}
              {step === 'upload' && 'Seleccionar archivo'}
              {step === 'scanning' && 'Escaneando...'}
              {step === 'classify' && `Clasificar productos (${products.length})`}
              {step === 'saving' && 'Guardando...'}
              {step === 'done' && '¡Listo!'}
            </h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP: METHOD ── */}
          {step === 'method' && (
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-500 mb-4">¿Cómo quieres subir tus compras?</p>

              <button
                onClick={() => selectMethod('screenshot')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-coral/40 hover:bg-coral-soft transition text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-coral/10 flex items-center justify-center flex-shrink-0 group-hover:bg-coral/20 transition">
                  <Camera className="w-5 h-5 text-coral" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Captura de pantalla</p>
                  <p className="text-xs text-gray-500 mt-0.5">Foto o screenshot del carrito / producto</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-coral transition" />
              </button>

              <button
                onClick={() => selectMethod('invoice')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-coral/40 hover:bg-coral-soft transition text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Factura de SHEIN / Temu</p>
                  <p className="text-xs text-gray-500 mt-0.5">PDF o imagen de la orden completa</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition" />
              </button>

              <button
                onClick={() => selectMethod('manual')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-coral/40 hover:bg-coral-soft transition text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0 group-hover:bg-green-100 transition">
                  <PenLine className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Manual</p>
                  <p className="text-xs text-gray-500 mt-0.5">Escribe los productos uno por uno</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition" />
              </button>
            </div>
          )}

          {/* ── STEP: UPLOAD ── */}
          {step === 'upload' && (
            <div className="p-5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-14 flex flex-col items-center gap-3 hover:border-coral/50 hover:bg-coral-soft/50 transition"
              >
                <div className="w-14 h-14 rounded-2xl bg-coral/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-coral" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">
                    {method === 'invoice' ? 'Sube la factura' : 'Sube la captura'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {method === 'invoice' ? 'PDF o imagen de la orden' : 'Foto o screenshot del producto'}
                  </p>
                </div>
                <span className="text-xs text-coral font-medium bg-coral/10 px-3 py-1 rounded-full">
                  Seleccionar archivo
                </span>
              </button>
            </div>
          )}

          {/* ── STEP: SCANNING ── */}
          {step === 'scanning' && (
            <div className="py-20 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-coral/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-coral animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900">Analizando imagen...</p>
                <p className="text-sm text-gray-400 mt-1">Extrayendo productos automáticamente</p>
              </div>
            </div>
          )}

          {/* ── STEP: CLASSIFY ── */}
          {step === 'classify' && (
            <div className="p-5 space-y-4">

              {/* Manual form */}
              {method === 'manual' && (
                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Agregar producto</p>
                  <input
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder="Nombre del producto"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                  <div className="flex gap-2">
                    <input
                      value={manualPrice}
                      onChange={e => setManualPrice(e.target.value)}
                      placeholder="Precio $"
                      type="number"
                      step="0.01"
                      className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                    />
                    <select
                      value={manualStore}
                      onChange={e => setManualStore(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                    >
                      {['SHEIN','Temu','AliExpress','Amazon','Otro'].map(s => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={addManualProduct}
                    disabled={!manualName.trim()}
                    className="w-full h-10 rounded-xl bg-coral text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Agregar
                  </button>
                </div>
              )}

              {/* Product list */}
              {products.length === 0 && method === 'manual' && (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-400">Agrega al menos un producto</p>
                </div>
              )}

              {products.map(p => (
                <ProductClassifyCard
                  key={p.id}
                  product={p}
                  clients={clients?.filter(c => !c.deleted_at) ?? []}
                  showNewClient={showNewClientInput[p.id] ?? false}
                  onSetCategory={cat => setCategory(p.id, cat)}
                  onSetClient={cid => setClient(p.id, cid)}
                  onSetNewClientName={name => setNewClientName(p.id, name)}
                  onToggleNewClient={show => setShowNewClientInput(prev => ({ ...prev, [p.id]: show }))}
                  onRemove={() => setProducts(prev => prev.filter(x => x.id !== p.id))}
                />
              ))}

              {/* Save button */}
              {products.length > 0 && (
                <button
                  onClick={handleSave}
                  className="w-full h-12 rounded-xl bg-coral text-white font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 mt-2"
                >
                  <Check className="w-4 h-4" />
                  Guardar {products.length} producto{products.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {/* ── STEP: SAVING ── */}
          {step === 'saving' && (
            <div className="py-20 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-coral animate-spin" />
              <p className="text-sm text-gray-500">Guardando productos...</p>
            </div>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && (
            <div className="py-16 flex flex-col items-center gap-4 px-5">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900 text-lg">¡Productos guardados!</p>
                <p className="text-sm text-gray-500 mt-1">
                  {products.length} producto{products.length !== 1 ? 's' : ''} registrado{products.length !== 1 ? 's' : ''} correctamente.
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => { reset(); }}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Subir más
                </button>
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl bg-coral text-white text-sm font-semibold hover:opacity-90 transition"
                >
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

// ── Sub-component: ProductClassifyCard ─────────────────────────────────────
interface CardProps {
  product: ScannedProduct;
  clients: any[];
  showNewClient: boolean;
  onSetCategory: (cat: ScannedProduct['category']) => void;
  onSetClient: (id: string) => void;
  onSetNewClientName: (name: string) => void;
  onToggleNewClient: (show: boolean) => void;
  onRemove: () => void;
}

function ProductClassifyCard({
  product, clients, showNewClient,
  onSetCategory, onSetClient, onSetNewClientName, onToggleNewClient, onRemove
}: CardProps) {
  const CATS = [
    { value: 'client' as const, label: 'Cliente', icon: User, color: 'text-coral', bg: 'bg-coral/10', active: 'bg-coral text-white' },
    { value: 'merchandise' as const, label: 'Mercancía', icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50', active: 'bg-purple-600 text-white' },
    { value: 'personal' as const, label: 'Personal', icon: Home, color: 'text-green-600', bg: 'bg-green-50', active: 'bg-green-600 text-white' },
  ];

  return (
    <div className={`rounded-2xl border-2 p-4 space-y-3 transition ${
      product.category ? 'border-gray-100 bg-white' : 'border-orange-100 bg-orange-50/30'
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

      {/* Category buttons */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">¿Para quién es?</p>
        <div className="flex gap-2">
          {CATS.map(({ value, label, icon: Icon, color, bg, active }) => (
            <button
              key={value}
              onClick={() => onSetCategory(value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition ${
                product.category === value ? active : `${bg} ${color} hover:opacity-80`
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
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={() => onToggleNewClient(true)}
                className="px-3 h-9 rounded-xl border border-dashed border-coral/50 text-coral text-xs font-medium hover:bg-coral/5 transition flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Nuevo
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={product.newClientName}
                onChange={e => onSetNewClientName(e.target.value)}
                placeholder="Nombre del cliente"
                className="flex-1 h-9 px-3 rounded-xl border border-coral/40 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                autoFocus
              />
              <button
                onClick={() => onToggleNewClient(false)}
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