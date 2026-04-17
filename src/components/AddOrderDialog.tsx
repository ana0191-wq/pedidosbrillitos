import { useState, useEffect, useRef } from 'react';
import type { Order, OrderCategory, Store } from '@/types/orders';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link2, PenLine, Loader2, Camera, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { parseNum } from '@/lib/utils';

interface AddOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (order: Order) => void;
  defaultCategory?: OrderCategory;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export function AddOrderDialog({ open, onOpenChange, onAdd, defaultCategory = 'personal' }: AddOrderDialogProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'auto' | 'manual'>('auto');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith("image/"));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setReceiptImage(reader.result as string);
      reader.readAsDataURL(file);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open]);

  // Manual form state
  const [category, setCategory] = useState<OrderCategory>(defaultCategory);
  const [productName, setProductName] = useState('');
  const [productPhoto, setProductPhoto] = useState('');
  const [store, setStore] = useState<Store>('AliExpress');
  const [pricePaid, setPricePaid] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [unitsOrdered, setUnitsOrdered] = useState('1');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [clientName, setClientName] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [amountCharged, setAmountCharged] = useState('');
  const [initialStatus, setInitialStatus] = useState<'Pendiente' | 'En Tránsito' | 'Llegó' | 'En Venezuela' | 'Entregado'>('Pendiente');

  const applyExtractedData = (data: any) => {
    if (data.productName) setProductName(data.productName);
    if (data.store && ['AliExpress', 'Shein', 'Temu', 'Amazon'].includes(data.store)) setStore(data.store);
    if (data.pricePaid != null) setPricePaid(String(data.pricePaid));
    if (data.orderNumber) setOrderNumber(data.orderNumber);
    if (data.orderDate) setOrderDate(data.orderDate);
    if (data.estimatedArrival) setEstimatedArrival(data.estimatedArrival);
    if (data.unitsOrdered != null) setUnitsOrdered(String(data.unitsOrdered));
    if (data.pricePerUnit != null) setPricePerUnit(String(data.pricePerUnit));
    if (data.clientName) setClientName(data.clientName);
    if (data.shippingCost != null) setShippingCost(String(data.shippingCost));
  };

  const handleUrlExtract = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-order', {
        body: { url: url.trim() },
      });
      if (error) throw error;
      if (data?.success && data.data) {
        applyExtractedData(data.data);
        setTab('manual');
        toast({ title: '✨ Datos extraídos', description: 'Revisa y completa lo que falte' });
      } else {
        toast({ title: 'No se pudo extraer', description: data?.error || 'Intenta manualmente', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo procesar la URL', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptExtract = async () => {
    if (!receiptImage) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-order', {
        body: { receiptImage },
      });
      if (error) throw error;
      if (data?.success && data.data) {
        applyExtractedData(data.data);
        setTab('manual');
        toast({ title: '✨ Datos extraídos del recibo', description: 'Revisa y completa lo que falte' });
      } else {
        toast({ title: 'No se pudo extraer', description: data?.error || 'Intenta manualmente', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo procesar el recibo', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUrl('');
    setProductName('');
    setProductPhoto('');
    setStore('AliExpress');
    setPricePaid('');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setEstimatedArrival('');
    setOrderNumber('');
    setNotes('');
    setUnitsOrdered('1');
    setPricePerUnit('');
    setClientName('');
    setShippingCost('');
    setAmountCharged('');
    setCategory(defaultCategory);
    setReceiptImage(null);
    setInitialStatus('Pendiente');
  };

  const handleSubmit = () => {
    if (!productName.trim()) {
      toast({ title: 'Nombre requerido', variant: 'destructive' });
      return;
    }

    const base = {
      id: generateId(),
      productName: productName.trim(),
      productPhoto,
      store,
      pricePaid: parseNum(pricePaid) ?? 0,
      orderDate,
      estimatedArrival,
      orderNumber,
      notes,
      createdAt: new Date().toISOString(),
    };

    let order: Order;
    if (category === 'personal') {
      order = { ...base, category: 'personal', status: initialStatus };
    } else if (category === 'merchandise') {
      order = { ...base, category: 'merchandise', status: initialStatus, unitsOrdered: parseNum(unitsOrdered) ?? 1, unitsReceived: 0, pricePerUnit: parseNum(pricePerUnit) ?? (parseNum(pricePaid) ?? 0), suggestedPrice: null };
    } else {
      order = { ...base, category: 'client', status: initialStatus, clientName, shippingCost: parseNum(shippingCost) ?? 0, amountCharged: parseNum(amountCharged) ?? 0 };
    }

    onAdd(order);
    resetForm();
    onOpenChange(false);
    toast({ title: '✅ Pedido agregado' });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setProductPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Agregar Pedido</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'auto' | 'manual')}>
          <TabsList className="w-full">
            <TabsTrigger value="auto" className="flex-1 gap-1"><Sparkles className="h-4 w-4" /> Automático</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1 gap-1"><PenLine className="h-4 w-4" /> Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="space-y-4 pt-4">
            {/* URL */}
            <div>
              <Label className="flex items-center gap-1"><Link2 className="h-4 w-4" /> Pegar URL del producto</Label>
              <Input
                placeholder="https://www.aliexpress.com/item/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">AliExpress, Shein, Temu o Amazon — extraemos los datos automáticamente</p>
            </div>
            <Button onClick={handleUrlExtract} disabled={!url.trim() || loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Extrayendo...</> : <><Sparkles className="h-4 w-4 mr-2" /> Extraer Datos</>}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">o</span></div>
            </div>

            {/* Receipt paste/upload zone */}
            <div>
              <Label className="flex items-center gap-1"><Camera className="h-4 w-4" /> Captura de pantalla / recibo</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition mt-1"
              >
                {receiptImage
                  ? <img src={receiptImage} className="max-h-40 mx-auto rounded" alt="Preview" />
                  : <p className="text-sm text-muted-foreground">📋 Pega con Ctrl+V o haz clic para subir imagen</p>
                }
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setReceiptImage(reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
            </div>
            {receiptImage && (
              <Button onClick={handleReceiptExtract} disabled={loading} className="w-full">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Extrayendo...</> : <><Sparkles className="h-4 w-4 mr-2" /> Extraer Datos del Recibo</>}
              </Button>
            )}

            {loading && (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Analizando con IA...
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 pt-4">
            {/* Category */}
            <div>
              <Label>Sección</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as OrderCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">🛍️ Mis Pedidos</SelectItem>
                  <SelectItem value="merchandise">📦 Mercancía</SelectItem>
                  <SelectItem value="client">👤 Pedidos de Clientes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Product name */}
            <div>
              <Label>Nombre del producto *</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Funda para iPhone 15..." />
            </div>

            {/* Photo */}
            <div>
              <Label>Foto del producto</Label>
              <Input type="file" accept="image/*" onChange={handlePhotoUpload} />
              {productPhoto && <img src={productPhoto} alt="Preview" className="mt-2 h-20 w-20 rounded-md object-cover" />}
            </div>

            {/* Store */}
            <div>
              <Label>Tienda</Label>
              <Select value={store} onValueChange={(v) => setStore(v as Store)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AliExpress">AliExpress</SelectItem>
                  <SelectItem value="Shein">Shein</SelectItem>
                  <SelectItem value="Temu">Temu</SelectItem>
                  <SelectItem value="Amazon">Amazon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price + Order number */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Precio pagado ($)</Label>
                <Input type="number" step="0.01" value={pricePaid} onChange={(e) => setPricePaid(e.target.value)} />
              </div>
              <div>
                <Label>N° de pedido</Label>
                <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha de compra</Label>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div>
                <Label>Llegada estimada</Label>
                <Input type="date" value={estimatedArrival} onChange={(e) => setEstimatedArrival(e.target.value)} />
              </div>
            </div>

            {/* Initial Status — for registering past/already-arrived orders */}
            <div>
              <Label>Estado inicial</Label>
              <Select value={initialStatus} onValueChange={(v) => setInitialStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendiente">⏳ Pendiente</SelectItem>
                  <SelectItem value="En Tránsito">🚚 En Tránsito</SelectItem>
                  <SelectItem value="Llegó">📦 Llegó</SelectItem>
                  <SelectItem value="En Venezuela">🇻🇪 En Venezuela</SelectItem>
                  <SelectItem value="Entregado">✅ Entregado</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Útil si registras un pedido que ya llegó o ya está en camino</p>
            </div>

            {/* Merchandise fields */}
            {category === 'merchandise' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Unidades</Label>
                  <Input type="number" value={unitsOrdered} onChange={(e) => setUnitsOrdered(e.target.value)} />
                </div>
                <div>
                  <Label>Precio por unidad ($)</Label>
                  <Input type="number" step="0.01" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} />
                </div>
              </div>
            )}

            {/* Client fields */}
            {category === 'client' && (
              <>
                <div>
                  <Label>Nombre del cliente</Label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Costo de envío ($)</Label>
                    <Input type="number" step="0.01" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} />
                  </div>
                  <div>
                    <Label>Cobrado al cliente ($)</Label>
                    <Input type="number" step="0.01" value={amountCharged} onChange={(e) => setAmountCharged(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            <div>
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas opcionales..." rows={2} />
            </div>

            <Button onClick={handleSubmit} className="w-full">Agregar Pedido</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
