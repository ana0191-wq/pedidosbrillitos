import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Link, X, Plus, ChevronDown, ChevronUp, Loader2, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Client } from '@/hooks/useClients';
import type { ClientOrder } from '@/hooks/useClientOrders';
import type { Order } from '@/types/orders';
import type { ShippingSettings } from '@/hooks/useShippingSettings';

// Product weight estimates by category
const WEIGHT_ESTIMATES: Record<string, number> = {
  'Ropa ligera': 0.3,
  'Ropa pesada': 0.8,
  'Zapatos': 1.2,
  'Accesorios': 0.2,
  'Electrónica': 0.5,
  'Cosméticos': 0.3,
  'Juguetes': 0.6,
  'Hogar': 0.7,
  'Otro': 0.5,
};

const STORES = ['Shein', 'Temu', 'Amazon', 'AliExpress', 'Otro'];
const PAYMENT_METHODS = ['Binance', 'PayPal', 'Zelle', 'PagoMóvil', 'Efectivo', 'Otro'];

interface ProductEntry {
  id: string;
  name: string;
  photo: string;
  link: string;
  price: string;
  store: string;
  category: string;
  estimatedWeight: number;
}

function makeId() { return Math.random().toString(36).slice(2, 10); }

async function compressImage(dataUrl: string, maxW = 800): Promise<string> {
  return new Promise(res => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      res(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = dataUrl;
  });
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: Client[];
  onAddOrder: (clientId: string, data: Partial<ClientOrder>) => Promise<string | null>;
  onAddProduct: (order: Order, clientOrderId?: string) => Promise<void>;
  defaultClientId?: string;
  exchangeRate?: number | null;
  shippingSettings?: ShippingSettings;
}

export function AddClientOrderDialog({ open, onOpenChange, clients, onAddOrder, onAddProduct, defaultClientId, exchangeRate }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'client' | 'products' | 'payment'>('client');

  // Client
  const [clientId, setClientId] = useState(defaultClientId || '');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);

  // Products
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductEntry | null>(null);

  // New product form
  const [newName, setNewName] = useState('');
  const [newPhoto, setNewPhoto] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStore, setNewStore] = useState('Shein');
  const [newCategory, setNewCategory] = useState('Ropa ligera');
  const [processingPhoto, setProcessingPhoto] = useState(false);

  // Payment
  const [payMethod, setPayMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [brotherInvolved, setBrotherInvolved] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const RATE = 10; // $10/lb

  const reset = () => {
    setStep('client');
    setClientId(defaultClientId || '');
    setClientSearch('');
    setProducts([]);
    setShowAddProduct(false);
    setEditingProduct(null);
    setNewName(''); setNewPhoto(''); setNewLink(''); setNewPrice('');
    setNewStore('Shein'); setNewCategory('Ropa ligera');
    setPayMethod(''); setNotes(''); setBrotherInvolved(false);
  };

  useEffect(() => {
    if (!open) return;
    reset();
    if (defaultClientId) {
      const c = clients.find(x => x.id === defaultClientId);
      if (c) setClientSearch(c.name);
    }
  }, [open, defaultClientId]);

  // Photo handling
  const handlePhotoFile = useCallback(async (file: File) => {
    setProcessingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async e => {
        const raw = e.target?.result as string;
        const compressed = await compressImage(raw);
        // Try AI extraction
        try {
          const { data } = await supabase.functions.invoke('extract-screenshot', {
            body: { imageBase64: compressed },
          });
          if (data?.success && data.orders?.[0]) {
            const o = data.orders[0];
            if (o.productName) setNewName(o.productName);
            if (o.pricePaid) setNewPrice(String(o.pricePaid));
            if (o.store) setNewStore(o.store);
          }
        } catch {}
        setNewPhoto(compressed);
        setProcessingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setProcessingPhoto(false);
    }
  }, []);

  const addProduct = () => {
    if (!newName.trim() && !newPhoto) return;
    const est = WEIGHT_ESTIMATES[newCategory] ?? 0.5;
    const p: ProductEntry = {
      id: makeId(),
      name: newName.trim() || 'Producto',
      photo: newPhoto,
      link: newLink.trim(),
      price: newPrice,
      store: newStore,
      category: newCategory,
      estimatedWeight: est,
    };
    if (editingProduct) {
      setProducts(prev => prev.map(x => x.id === editingProduct.id ? p : x));
      setEditingProduct(null);
    } else {
      setProducts(prev => [...prev, p]);
    }
    setNewName(''); setNewPhoto(''); setNewLink('');
    setNewPrice(''); setNewStore('Shein'); setNewCategory('Ropa ligera');
    setShowAddProduct(false);
  };

  const editProduct = (p: ProductEntry) => {
    setEditingProduct(p);
    setNewName(p.name); setNewPhoto(p.photo); setNewLink(p.link);
    setNewPrice(p.price); setNewStore(p.store); setNewCategory(p.category);
    setShowAddProduct(true);
  };

  const totalCart = products.reduce((s, p) => s + (parseFloat(p.price) || 0), 0);
  const totalEstWeight = products.reduce((s, p) => s + p.estimatedWeight, 0);
  const estShipping = totalEstWeight * RATE;
  const estTotal = totalCart + estShipping;

  const selectedClient = clients.find(c => c.id === clientId);
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!clientId) { toast({ title: 'Selecciona un cliente', variant: 'destructive' }); return; }
    if (products.length === 0) { toast({ title: 'Agrega al menos un producto', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const orderId = await onAddOrder(clientId, {
        status: 'Pendiente',
        notes,
        brotherInvolved,
        shippingCost: 0,
        amountCharged: 0,
        paymentMethod: payMethod,
      });
      if (!orderId) throw new Error('No se pudo crear el pedido');

      for (const p of products) {
        const order: Order = {
          id: makeId(),
          category: 'client' as const,
          productName: p.name,
          productPhoto: p.photo,
          store: p.store,
          pricePaid: parseFloat(p.price) || 0,
          orderDate: new Date().toISOString().split('T')[0],
          estimatedArrival: '',
          orderNumber: '',
          notes: p.link ? `link:${p.link}` : '',
          createdAt: new Date().toISOString(),
          status: 'Pendiente' as const,
          clientName: selectedClient?.name || '',
          shippingCost: 0,
          amountCharged: 0,
        };
        await onAddProduct(order, orderId);
      }

      toast({ title: `Pedido creado con ${products.length} producto(s)` });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg w-full max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base font-bold">Nuevo pedido de cliente</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-5">

          {/* ── CLIENTE ── */}
          <section>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</label>
            <div className="relative mt-1.5">
              <Input
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientList(true); setClientId(''); }}
                onFocus={() => setShowClientList(true)}
                placeholder="Buscar cliente..."
                className="h-10"
              />
              {selectedClient && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  <span>✓</span> {selectedClient.name}
                </div>
              )}
              {showClientList && clientSearch && filteredClients.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 bg-white border border-border rounded-xl shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {filteredClients.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors"
                      onClick={() => {
                        setClientId(c.id);
                        setClientSearch(c.name);
                        setShowClientList(false);
                      }}
                    >
                      <p className="text-sm font-semibold">{c.name}</p>
                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── PRODUCTOS ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Productos {products.length > 0 && <span className="text-primary">({products.length})</span>}
              </label>
              {products.length > 0 && (
                <button
                  className="text-xs text-primary font-semibold"
                  onClick={() => { setEditingProduct(null); setShowAddProduct(v => !v); }}
                >
                  + Agregar otro
                </button>
              )}
            </div>

            {/* Product list */}
            {products.length > 0 && (
              <div className="space-y-2 mb-3">
                {products.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-xl border border-border">
                    {p.photo ? (
                      <img src={p.photo} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.store} · {p.category} · ~{p.estimatedWeight}lb</p>
                      {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary truncate block">Ver link</a>}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-bold">${parseFloat(p.price || '0').toFixed(2)}</p>
                      <button className="text-xs text-muted-foreground underline" onClick={() => editProduct(p)}>Editar</button>
                    </div>
                    <button onClick={() => setProducts(prev => prev.filter(x => x.id !== p.id))} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add product form */}
            {(showAddProduct || products.length === 0) && (
              <div className="border-2 border-dashed border-border rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {editingProduct ? 'Editando producto' : 'Nuevo producto'}
                </p>

                {/* Photo — biggest element */}
                <div
                  className="relative w-full h-32 rounded-xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden"
                  onClick={() => fileRef.current?.click()}
                >
                  {processingPhoto ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-xs">Analizando foto...</span>
                    </div>
                  ) : newPhoto ? (
                    <>
                      <img src={newPhoto} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-semibold">Cambiar foto</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Camera className="h-8 w-8" />
                      <span className="text-sm font-medium">Foto del producto</span>
                      <span className="text-xs">Toca para abrir cámara o galería</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); e.target.value = ''; }}
                />

                {/* Name */}
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Nombre del producto"
                  className="h-10"
                />

                {/* Price + Store */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-semibold uppercase">Precio $</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      placeholder="0.00"
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-semibold uppercase">Tienda</label>
                    <select
                      value={newStore}
                      onChange={e => setNewStore(e.target.value)}
                      className="mt-1 w-full h-9 border border-input rounded-lg px-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {STORES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase">Categoría (para estimar peso)</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {Object.keys(WEIGHT_ESTIMATES).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setNewCategory(cat)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          newCategory === cat
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border text-muted-foreground hover:border-primary'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Peso estimado: ~{WEIGHT_ESTIMATES[newCategory] ?? 0.5} lb → envío aprox. ${((WEIGHT_ESTIMATES[newCategory] ?? 0.5) * RATE).toFixed(2)}
                  </p>
                </div>

                {/* Link */}
                <div className="flex items-center gap-2">
                  <Link className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={newLink}
                    onChange={e => setNewLink(e.target.value)}
                    placeholder="Link del producto (opcional)"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={addProduct} className="flex-1 h-9" disabled={!newName.trim() && !newPhoto}>
                    {editingProduct ? 'Guardar cambios' : 'Agregar producto'}
                  </Button>
                  {(editingProduct || products.length > 0) && (
                    <Button variant="ghost" className="h-9" onClick={() => {
                      setShowAddProduct(false);
                      setEditingProduct(null);
                      setNewName(''); setNewPhoto(''); setNewLink('');
                      setNewPrice(''); setNewStore('Shein'); setNewCategory('Ropa ligera');
                    }}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── RESUMEN ── */}
          {products.length > 0 && (
            <section className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Resumen del pedido</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Carrito</span>
                  <span className="font-semibold">${totalCart.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Envío estimado (~{totalEstWeight.toFixed(1)} lb × $10)</span>
                  <span className="font-semibold">${estShipping.toFixed(2)}</span>
                </div>
                {exchangeRate && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>≈ en Bolívares</span>
                    <span>{(estTotal * exchangeRate).toLocaleString('es', { maximumFractionDigits: 0 })} Bs</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 font-bold">
                  <span>Total estimado</span>
                  <span className="text-primary">${estTotal.toFixed(2)}</span>
                </div>
              </div>
            </section>
          )}

          {/* ── PAGO / NOTAS ── */}
          {products.length > 0 && (
            <section className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Método de pago (opcional)</label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(v => v === m ? '' : m)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      payMethod === m
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-muted-foreground hover:border-primary'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas del pedido (opcional)"
                className="h-9 text-sm"
              />

              {/* Brother toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                <div>
                  <p className="text-sm font-semibold">Mi hermano participa</p>
                  <p className="text-xs text-muted-foreground">30% de la ganancia</p>
                </div>
                <button
                  onClick={() => setBrotherInvolved(v => !v)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${brotherInvolved ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${brotherInvolved ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </section>
          )}

          {/* ── SUBMIT ── */}
          <Button
            className="w-full h-11 font-bold"
            onClick={handleSubmit}
            disabled={submitting || !clientId || products.length === 0}
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</> : `Crear pedido (${products.length} producto${products.length !== 1 ? 's' : ''})`}
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}