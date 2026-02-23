import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Loader2, ImagePlus, Clipboard, X, Trash2, Plus, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Client } from '@/hooks/useClients';
import type { ClientOrder } from '@/hooks/useClientOrders';
import type { Order, Store } from '@/types/orders';

const PAYMENT_METHODS = ['Bolívares (tasa euro)', 'PayPal', 'Binance', 'Efectivo'];

interface DetectedProduct {
  productName: string;
  store: string;
  pricePaid: number;
  pricePerUnit: number;
  unitsOrdered: number;
  orderNumber: string;
  croppedImage: string;
  imageBbox?: [number, number, number, number] | null;
}

function compressImage(base64: string, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    img.src = base64;
  });
}

function cropImageFromBbox(
  imageBase64: string,
  bbox: [number, number, number, number]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const [x1Pct, y1Pct, x2Pct, y2Pct] = bbox;
      const x = (x1Pct / 100) * img.width;
      const y = (y1Pct / 100) * img.height;
      const w = ((x2Pct - x1Pct) / 100) * img.width;
      const h = ((y2Pct - y1Pct) / 100) * img.height;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w));
      canvas.height = Math.max(1, Math.round(h));
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');
      ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = imageBase64;
  });
}

interface AddClientOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onAddOrder: (clientId: string, data: Partial<ClientOrder>) => Promise<string | null>;
  onAddProduct: (order: Order, clientOrderId?: string) => Promise<void>;
  /** If provided, pre-selects the client */
  defaultClientId?: string;
}

export function AddClientOrderDialog({ open, onOpenChange, clients, onAddOrder, onAddProduct, defaultClientId }: AddClientOrderDialogProps) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState(defaultClientId || '');
  const [payment, setPayment] = useState('');
  const [payRef, setPayRef] = useState('');
  const [shipping, setShipping] = useState('');
  const [charged, setCharged] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Screenshot import state
  const [processing, setProcessing] = useState(false);
  const [products, setProducts] = useState<DetectedProduct[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync clientId when defaultClientId changes or dialog opens
  useEffect(() => {
    if (open && defaultClientId) {
      setClientId(defaultClientId);
    }
  }, [open, defaultClientId]);

  const reset = () => {
    setClientId(defaultClientId || '');
    setPayment('');
    setPayRef('');
    setShipping('');
    setCharged('');
    setNotes('');
    setProducts([]);
    setProcessing(false);
    setSubmitting(false);
  };

  const processImage = useCallback(async (base64Raw: string) => {
    setProcessing(true);
    try {
      const base64 = await compressImage(base64Raw, 1200);
      const { data, error } = await supabase.functions.invoke('extract-screenshot', {
        body: { imageBase64: base64 },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Error desconocido');

      if (data.orders?.length) {
        const detected: DetectedProduct[] = await Promise.all(
          data.orders.map(async (order: any) => {
            let croppedImage = '';
            if (order.imageBbox && Array.isArray(order.imageBbox) && order.imageBbox.length === 4) {
              try { croppedImage = await cropImageFromBbox(base64, order.imageBbox); } catch { croppedImage = base64; }
            } else {
              croppedImage = base64;
            }
            return {
              productName: order.productName || 'Producto',
              store: order.store || 'AliExpress',
              pricePaid: order.pricePaid || 0,
              pricePerUnit: order.pricePerUnit || order.pricePaid || 0,
              unitsOrdered: order.unitsOrdered || 1,
              orderNumber: order.orderNumber || '',
              croppedImage,
            };
          })
        );
        setProducts(prev => [...prev, ...detected]);
        toast({ title: `📸 ${data.orders.length} producto(s) detectado(s)` });
      } else {
        toast({ title: '🤔 No se detectaron productos', description: 'Intenta con otra captura' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [toast]);

  // Clipboard paste
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = (ev) => processImage(ev.target?.result as string);
          reader.readAsDataURL(file);
          return;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [open, processImage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const updateProduct = (i: number, field: keyof DetectedProduct, value: any) => {
    setProducts(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };

  const removeProduct = (i: number) => {
    setProducts(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    const selectedClient = clientId || defaultClientId;
    if (!selectedClient) {
      toast({ title: 'Selecciona un cliente', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      // Create the client order first
      const orderId = await onAddOrder(selectedClient, {
        paymentMethod: payment,
        paymentReference: payRef,
        shippingCost: parseFloat(shipping) || 0,
        amountCharged: parseFloat(charged) || 0,
        notes,
      });

      if (!orderId) {
        toast({ title: 'Error al crear pedido', description: 'Verifica que estés conectado e intenta de nuevo.', variant: 'destructive' });
        return;
      }

      // Now add each product as an order linked to this client_order_id
      const validStores: Store[] = ['AliExpress', 'Shein', 'Temu', 'Amazon'];
      let savedCount = 0;
      for (const p of products) {
        try {
          const store: Store = validStores.includes(p.store as Store) ? (p.store as Store) : 'AliExpress';
          const clientName = clients.find(c => c.id === selectedClient)?.name || '';
          const order: Order = {
            id: Math.random().toString(36).substring(2, 15),
            category: 'client',
            productName: p.productName,
            productPhoto: p.croppedImage,
            store,
            pricePaid: p.pricePaid,
            orderDate: new Date().toISOString().split('T')[0],
            estimatedArrival: '',
            orderNumber: p.orderNumber,
            notes: '',
            createdAt: new Date().toISOString(),
            status: 'Pedido',
            clientName,
            shippingCost: 0,
            amountCharged: 0,
          };
          await onAddProduct(order, orderId);
          savedCount++;
        } catch (err: any) {
          console.error('Error saving product:', err);
        }
      }

      reset();
      onOpenChange(false);
      toast({ title: `✅ Pedido creado${savedCount > 0 ? ` con ${savedCount} producto(s)` : ''}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const totalProducts = products.reduce((s, p) => s + p.pricePaid, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* Screenshot Import Section */}
          <div className="border-t border-border pt-3 space-y-2">
            <Label className="flex items-center gap-1.5">
              <Camera className="h-4 w-4" /> Productos (desde capturas)
            </Label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-20 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <ImagePlus className="h-5 w-5" />
                <span className="text-sm">/</span>
                <Clipboard className="h-4 w-4" />
              </div>
              <span className="text-xs text-muted-foreground">
                Sube captura o pega con <kbd className="px-1 py-0.5 rounded bg-muted text-xs font-mono">Ctrl+V</kbd>
              </span>
            </div>

            {processing && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Analizando...
              </div>
            )}

            {products.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{products.length} producto(s) · Total: ${totalProducts.toFixed(2)}</span>
                  <Button variant="ghost" size="sm" onClick={() => setProducts([])} className="h-6 text-xs text-destructive">
                    <Trash2 className="h-3 w-3 mr-1" /> Limpiar
                  </Button>
                </div>

                {products.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/50">
                    <div className="h-10 w-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                      {p.croppedImage ? (
                        <img src={p.croppedImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 m-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <Input
                        value={p.productName}
                        onChange={(e) => updateProduct(i, 'productName', e.target.value)}
                        className="h-6 text-xs"
                      />
                      <div className="flex gap-1">
                        <Select value={p.store} onValueChange={(v) => updateProduct(i, 'store', v)}>
                          <SelectTrigger className="h-6 text-xs flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AliExpress">AliExpress</SelectItem>
                            <SelectItem value="Shein">Shein</SelectItem>
                            <SelectItem value="Temu">Temu</SelectItem>
                            <SelectItem value="Amazon">Amazon</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          value={p.pricePaid}
                          onChange={(e) => updateProduct(i, 'pricePaid', parseFloat(e.target.value) || 0)}
                          className="h-6 text-xs w-20"
                          placeholder="$"
                        />
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeProduct(i)} className="h-6 w-6 p-0 text-destructive flex-shrink-0">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-7"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                >
                  <ImagePlus className="h-3 w-3 mr-1" /> Agregar otra captura
                </Button>
              </div>
            )}
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={(!clientId && !defaultClientId) || submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando...</> : <>Crear Pedido{products.length > 0 ? ` (${products.length} productos)` : ''}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
