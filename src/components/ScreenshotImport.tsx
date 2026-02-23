import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Plus, X, ImagePlus, Clipboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Order, Store } from '@/types/orders';

interface ScreenshotImportProps {
  onImportOrders: (orders: Order[]) => void;
}

interface DetectedOrder {
  productName?: string;
  imageBbox?: [number, number, number, number] | null;
  store?: string;
  pricePaid?: number;
  orderNumber?: string;
  orderDate?: string;
  estimatedArrival?: string;
  unitsOrdered?: number;
  croppedImage?: string; // base64 cropped thumbnail
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

export function ScreenshotImport({ onImportOrders }: ScreenshotImportProps) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [foundOrders, setFoundOrders] = useState<DetectedOrder[]>([]);
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
        // Crop thumbnails from bounding boxes
        const ordersWithImages: DetectedOrder[] = await Promise.all(
          data.orders.map(async (order: any) => {
            let croppedImage = '';
            if (order.imageBbox && Array.isArray(order.imageBbox) && order.imageBbox.length === 4) {
              try {
                croppedImage = await cropImageFromBbox(base64, order.imageBbox);
                console.log('Cropped bbox:', order.imageBbox, 'for:', order.productName?.slice(0, 30));
              } catch (e) {
                console.warn('Could not crop thumbnail:', e);
                croppedImage = base64; // fallback: use full screenshot
              }
            } else {
              console.warn('No imageBbox for:', order.productName, 'bbox:', order.imageBbox);
              croppedImage = base64; // fallback: use full screenshot
            }
            return { ...order, croppedImage };
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
  }, [toast]);

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

  const importOrder = (orderData: DetectedOrder) => {
    const validStores: Store[] = ['AliExpress', 'Shein', 'Temu', 'Amazon'];
    const store: Store = validStores.includes(orderData.store as Store) ? orderData.store as Store : 'AliExpress';

    const order: Order = {
      id: Math.random().toString(36).substring(2, 15),
      category: 'personal',
      productName: orderData.productName || 'Pedido importado',
      productPhoto: orderData.croppedImage || '',
      store,
      pricePaid: orderData.pricePaid || 0,
      orderDate: orderData.orderDate || new Date().toISOString().split('T')[0],
      estimatedArrival: orderData.estimatedArrival || '',
      orderNumber: orderData.orderNumber || '',
      notes: 'Importado desde captura',
      createdAt: new Date().toISOString(),
      status: 'Pedido',
    };

    onImportOrders([order]);
    setFoundOrders(prev => prev.filter(o => o !== orderData));
    toast({ title: '✅ Pedido importado', description: order.productName });
  };

  const importAll = () => {
    const validStores: Store[] = ['AliExpress', 'Shein', 'Temu', 'Amazon'];

    const ordersToImport: Order[] = foundOrders.map(orderData => ({
      id: Math.random().toString(36).substring(2, 15),
      category: 'personal' as const,
      productName: orderData.productName || 'Pedido importado',
      productPhoto: orderData.croppedImage || '',
      store: validStores.includes(orderData.store as Store) ? orderData.store as Store : 'AliExpress' as Store,
      pricePaid: orderData.pricePaid || 0,
      orderDate: orderData.orderDate || new Date().toISOString().split('T')[0],
      estimatedArrival: orderData.estimatedArrival || '',
      orderNumber: orderData.orderNumber || '',
      notes: 'Importado desde captura',
      createdAt: new Date().toISOString(),
      status: 'Pedido' as const,
    }));

    onImportOrders(ordersToImport);
    setFoundOrders([]);
    setPreview(null);
    toast({ title: `✅ ${ordersToImport.length} pedido(s) importado(s)` });
  };

  const reset = () => {
    setPreview(null);
    setFoundOrders([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{foundOrders.length} producto(s) detectado(s)</span>
              <Button variant="secondary" size="sm" onClick={importAll} className="text-xs h-7">
                <Plus className="h-3 w-3 mr-1" /> Importar todos
              </Button>
            </div>

            {foundOrders.map((order, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                <div className="h-10 w-10 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                  {order.croppedImage ? (
                    <img src={order.croppedImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      <Camera className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{order.productName || 'Sin nombre'}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.store || '?'} · ${order.pricePaid?.toFixed(2) || '?'}
                    {(order.unitsOrdered ?? 0) > 1 ? ` · x${order.unitsOrdered}` : ''}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => importOrder(order)} className="h-7 w-7 p-0">
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setFoundOrders(prev => prev.filter((_, j) => j !== i))} className="h-7 w-7 p-0 text-muted-foreground">
                    <X className="h-3 w-3" />
                  </Button>
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
