import { useState } from 'react';
import type { Order, OrderCategory, Store } from '@/types/orders';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link2, PenLine, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AddOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (order: Order) => void;
  defaultCategory?: OrderCategory;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export function AddOrderDialog({ open, onOpenChange, onAdd, defaultCategory = 'personal' }: AddOrderDialogProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'url' | 'manual'>('url');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

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
  // Merchandise
  const [unitsOrdered, setUnitsOrdered] = useState('1');
  const [pricePerUnit, setPricePerUnit] = useState('');
  // Client
  const [clientName, setClientName] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [amountCharged, setAmountCharged] = useState('');

  const detectStore = (url: string): Store | null => {
    if (url.includes('aliexpress')) return 'AliExpress';
    if (url.includes('shein')) return 'Shein';
    if (url.includes('temu')) return 'Temu';
    return null;
  };

  const handleUrlPaste = () => {
    const detected = detectStore(url);
    if (!detected) {
      toast({ title: 'URL no reconocida', description: 'Pega un enlace de AliExpress, Shein o Temu', variant: 'destructive' });
      return;
    }
    setStore(detected);
    setTab('manual');
    toast({ title: `Tienda detectada: ${detected}`, description: 'Completa los datos del producto. La extracción automática requiere Cloud.' });
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
      pricePaid: parseFloat(pricePaid) || 0,
      orderDate,
      estimatedArrival,
      orderNumber,
      notes,
      createdAt: new Date().toISOString(),
    };

    let order: Order;

    if (category === 'personal') {
      order = { ...base, category: 'personal', status: 'Pedido' };
    } else if (category === 'merchandise') {
      order = {
        ...base,
        category: 'merchandise',
        status: 'Pedido',
        unitsOrdered: parseInt(unitsOrdered) || 1,
        unitsReceived: 0,
        pricePerUnit: parseFloat(pricePerUnit) || parseFloat(pricePaid) || 0,
      };
    } else {
      order = {
        ...base,
        category: 'client',
        status: 'Pedido',
        clientName,
        shippingCost: parseFloat(shippingCost) || 0,
        amountCharged: parseFloat(amountCharged) || 0,
      };
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

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'url' | 'manual')}>
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1 gap-1"><Link2 className="h-4 w-4" /> Pegar URL</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1 gap-1"><PenLine className="h-4 w-4" /> Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 pt-4">
            <div>
              <Label>URL del producto</Label>
              <Input
                placeholder="https://www.aliexpress.com/item/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Pega el enlace del producto de AliExpress, Shein o Temu</p>
            </div>
            <Button onClick={handleUrlPaste} disabled={!url.trim()} className="w-full">
              Detectar Tienda y Continuar
            </Button>
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
              <div className="flex gap-2">
                <Input type="file" accept="image/*" onChange={handlePhotoUpload} className="flex-1" />
              </div>
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
                </SelectContent>
              </Select>
            </div>

            {/* Price */}
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
