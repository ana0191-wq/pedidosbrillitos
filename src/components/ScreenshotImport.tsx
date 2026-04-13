import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Loader2, Plus, X, ImagePlus, Clipboard, Trash2, ShoppingBag, Package, Users, ArrowUp, ArrowDown, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Order, OrderCategory, Store } from '@/types/orders';

interface ScreenshotImportProps {
  onImportOrders: (orders: Order[]) => void;
}

interface DetectedOrder {
  productName?: string;
  imageBbox?: [number, number, number, number] | null;
  store?: string;
  pricePaid?: number;
  pricePerUnit?: number;
  orderNumber?: string;
  orderDate?: string;
  estimatedArrival?: string;
  unitsOrdered?: number;
  croppedImage?: string;
  // User-editable fields
  category: OrderCategory;
  clientName: string;
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

const categoryIcons: Record<OrderCategory, React.ReactNode> = {
  personal: <ShoppingBag className="h-3 w-3" />,
  merchandise: <Package className="h-3 w-3" />,
  client: <Users className="h-3 w-3" />,
};

export function ScreenshotImport({ onImportOrders }: ScreenshotImportProps) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [foundOrders, setFoundOrders] = useState<DetectedOrder[]>([]);
  const [globalCategory, setGlobalCategory] = useState<OrderCategory>('personal');
  const [globalClient, setGlobalClient] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (base64: string) => {
    setPreview(base64);
    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('extract-screenshot', {
        body: { imageBase64: base64 },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Error desconocido');

      if (data.orders?.length) {
        const ordersWithImages: DetectedOrder[] = await Promise.all(
          data.orders.map(async (order: any) => {
            let croppedImage = '';
            if (order.imageBbox && Array.isArray(order.imageBbox) && order.imageBbox.length === 4) {
              try {
                croppedImage = await cropImageFromBbox(base64, order.imageBbox);
              } catch (e) {
                console.warn('Could not crop thumbnail:', e);
                croppedImage = base64;
              }
            } else {
              croppedImage = base64;
            }
            return {
              ...order,
              croppedImage,
              category: globalCategory,
              clientName: globalClient,
            };
          })
        );

        setFoundOrders(prev => [...prev, ...ordersWithImages]);
        toast({ title: `📸 ${data.orders.length} producto(s) detectado(s)` });
      } else {
        toast({ title: '🤔 No se detectaron pedidos', description: 'Intenta con otra captura más clara' });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: err.message || 'No se pudo procesar la imagen', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [toast, globalCategory, globalClient]);

  // Clipboard paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (ev) => {
            const b64 = ev.target?.result as string;
            processImage(b64);
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [processImage]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      processImage(b64);
    };
    reader.readAsDataURL(file);
  };

  const updateOrderField = (index: number, field: keyof DetectedOrder, value: any) => {
    setFoundOrders(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o));
  };

  const removeOrder = (index: number) => {
    setFoundOrders(prev => prev.filter((_, i) => i !== index));
  };

  const moveOrder = (index: number, direction: -1 | 1) => {
    setFoundOrders(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const applyGlobalCategory = (cat: OrderCategory) => {
    setGlobalCategory(cat);
    setFoundOrders(prev => prev.map(o => ({ ...o, category: cat })));
  };

  const applyGlobalClient = (name: string) => {
    setGlobalClient(name);
    setFoundOrders(prev => prev.map(o => o.category === 'client' ? { ...o, clientName: name } : o));
  };

  const buildOrder = (d: DetectedOrder): Order => {
    const validStores: Store[] = ['AliExpress', 'Shein', 'Temu', 'Amazon'];
    const store: Store = validStores.includes(d.store as Store) ? d.store as Store : 'AliExpress';

    const base = {
      id: Math.random().toString(36).substring(2, 15),
      productName: d.productName || 'Pedido importado',
      productPhoto: d.croppedImage || '',
      store,
      pricePaid: d.pricePaid || 0,
      orderDate: d.orderDate || new Date().toISOString().split('T')[0],
      estimatedArrival: d.estimatedArrival || '',
      orderNumber: d.orderNumber || '',
      notes: 'Importado desde captura',
      createdAt: new Date().toISOString(),
    };

    if (d.category === 'merchandise') {
      const units = d.unitsOrdered || 1;
      const perUnit = d.pricePerUnit || (d.pricePaid ? d.pricePaid / units : 0);
      return {
        ...base,
        category: 'merchandise' as const,
        status: 'Pendiente' as const,
        unitsOrdered: units,
        unitsReceived: 0,
        pricePerUnit: perUnit,
        suggestedPrice: null,
      };
    }
    if (d.category === 'client') {
      return {
        ...base,
        category: 'client',
        status: 'Pendiente',
        clientName: d.clientName || '',
        shippingCost: 0,
        amountCharged: 0,
      };
    }
    return { ...base, category: 'personal', status: 'Pendiente' };
  };

  const importOrder = (index: number) => {
    const d = foundOrders[index];
    onImportOrders([buildOrder(d)]);
    removeOrder(index);
    toast({ title: '✅ Pedido importado', description: d.productName });
  };

  const importAll = () => {
    const orders = foundOrders.map(buildOrder);
    onImportOrders(orders);
    setFoundOrders([]);
    setPreview(null);
    toast({ title: `✅ ${orders.length} pedido(s) importado(s)` });
  };

  const reset = () => {
    setPreview(null);
    setFoundOrders([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasClientOrders = foundOrders.some(o => o.category === 'client');

    const spendingSummary = foundOrders.reduce((acc, o) => {
    const price = o.pricePaid || 0;
    acc.total += price;
    acc[o.category] = (acc[o.category] || 0) + price;
    return acc;
  }, { total: 0, personal: 0, merchandise: 0, client: 0 } as Record<string, number>);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Importar desde captura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!preview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-28 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3 text-muted-foreground">
              <ImagePlus className="h-7 w-7" />
              <span className="text-lg font-medium">/</span>
              <Clipboard className="h-6 w-6" />
            </div>
            <span className="text-sm text-muted-foreground">
              Sube una captura o pega con <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Ctrl+V</kbd>
            </span>
          </div>
        ) : (
          <div className="relative">
            <img src={preview} alt="Captura" className="w-full rounded-lg max-h-48 object-contain bg-muted" />
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 h-7 w-7 p-0"
              onClick={reset}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {processing && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analizando imagen con AI...
          </div>
        )}

        {foundOrders.length > 0 && (
          <div className="space-y-3">
            {/* Global controls */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Aplicar a todos:</p>
              <div className="flex gap-2">
                <Select value={globalCategory} onValueChange={(v) => applyGlobalCategory(v as OrderCategory)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">🛍️ Mis Pedidos</SelectItem>
                    <SelectItem value="merchandise">📦 Mercancía</SelectItem>
                    <SelectItem value="client">👤 Clientes</SelectItem>
                  </SelectContent>
                </Select>
                {globalCategory === 'client' && (
                  <Input
                    placeholder="Nombre del cliente"
                    value={globalClient}
                    onChange={(e) => applyGlobalClient(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                )}
              </div>
            </div>

            {/* Spending summary */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex flex-wrap gap-3 items-center">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Total: ${spendingSummary.total.toFixed(2)}</span>
              {spendingSummary.personal > 0 && <span className="text-xs text-muted-foreground">🛍️ ${spendingSummary.personal.toFixed(2)}</span>}
              {spendingSummary.merchandise > 0 && <span className="text-xs text-muted-foreground">📦 ${spendingSummary.merchandise.toFixed(2)}</span>}
              {spendingSummary.client > 0 && <span className="text-xs text-muted-foreground">👤 ${spendingSummary.client.toFixed(2)}</span>}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{foundOrders.length} producto(s)</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setFoundOrders([])} className="text-xs h-7 text-destructive">
                  <Trash2 className="h-3 w-3 mr-1" /> Borrar todos
                </Button>
                <Button variant="secondary" size="sm" onClick={importAll} className="text-xs h-7">
                  <Plus className="h-3 w-3 mr-1" /> Importar todos
                </Button>
              </div>
            </div>

            {/* Product list */}
            {foundOrders.map((order, i) => (
              <div key={i} className="p-2 rounded-md bg-muted/30 border border-border/50 space-y-2">
                {/* Header row: thumbnail + actions */}
                <div className="flex items-center gap-2">
                  <div className="h-12 w-12 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                    {order.croppedImage ? (
                      <img src={order.croppedImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                        <Camera className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <Input
                    value={order.productName || ''}
                    onChange={(e) => updateOrderField(i, 'productName', e.target.value)}
                    placeholder="Nombre del producto"
                    className="h-7 text-xs font-medium flex-1"
                  />
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => moveOrder(i, -1)} disabled={i === 0} className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => moveOrder(i, 1)} disabled={i === foundOrders.length - 1} className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => importOrder(i)} className="h-7 w-7 p-0 text-primary">
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeOrder(i)} className="h-7 w-7 p-0 text-destructive">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Editable fields row */}
                <div className="grid grid-cols-4 gap-1.5">
                  <Select value={order.store || ''} onValueChange={(v) => updateOrderField(i, 'store', v)}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Tienda" />
                    </SelectTrigger>
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
                    value={order.pricePerUnit ?? ''}
                    onChange={(e) => {
                      const perUnit = e.target.value ? parseFloat(e.target.value) : 0;
                      const units = order.unitsOrdered || 1;
                      updateOrderField(i, 'pricePerUnit', perUnit);
                      updateOrderField(i, 'pricePaid', parseFloat((perUnit * units).toFixed(2)));
                    }}
                    placeholder="P/U $"
                    className="h-7 text-xs"
                  />
                  <Input
                    type="number"
                    min="1"
                    value={order.unitsOrdered ?? 1}
                    onChange={(e) => {
                      const units = e.target.value ? parseInt(e.target.value) : 1;
                      const perUnit = order.pricePerUnit || 0;
                      updateOrderField(i, 'unitsOrdered', units);
                      updateOrderField(i, 'pricePaid', parseFloat((perUnit * units).toFixed(2)));
                    }}
                    placeholder="Uds"
                    className="h-7 text-xs"
                  />
                  <div className="h-7 flex items-center justify-center text-xs font-semibold text-primary bg-primary/10 rounded-md">
                    ${(order.pricePaid || 0).toFixed(2)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Input
                    value={order.orderNumber || ''}
                    onChange={(e) => updateOrderField(i, 'orderNumber', e.target.value)}
                    placeholder="# Orden"
                    className="h-7 text-xs"
                  />
                  <Input
                    type="date"
                    value={order.orderDate || ''}
                    onChange={(e) => updateOrderField(i, 'orderDate', e.target.value)}
                    className="h-7 text-xs"
                  />
                  <Input
                    type="date"
                    value={order.estimatedArrival || ''}
                    onChange={(e) => updateOrderField(i, 'estimatedArrival', e.target.value)}
                    placeholder="Llegada"
                    className="h-7 text-xs"
                  />
                </div>

                {/* Category & client */}
                <div className="flex gap-2 items-center">
                  <Select value={order.category} onValueChange={(v) => updateOrderField(i, 'category', v)}>
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">🛍️ Personal</SelectItem>
                      <SelectItem value="merchandise">📦 Mercancía</SelectItem>
                      <SelectItem value="client">👤 Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                  {order.category === 'client' && (
                    <Input
                      placeholder="Cliente..."
                      value={order.clientName}
                      onChange={(e) => updateOrderField(i, 'clientName', e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                  )}
                </div>
              </div>
            ))}

            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="w-full text-xs"
              disabled={processing}
            >
              <ImagePlus className="h-3 w-3 mr-1" /> Agregar otra captura
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
