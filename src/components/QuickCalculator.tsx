import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Loader2, Calculator, Receipt, Tag, Upload, X, ImageIcon, Download, Minus, Plus } from 'lucide-react';
import { fmtMoney } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import type { ClientOrder } from '@/hooks/useClientOrders';
import { toPng } from 'html-to-image';

interface QuickCalculatorProps {
  shippingSettings?: ShippingSettings;
  exchangeRate: number | null;
  clientOrders: ClientOrder[];
}

interface DistributionRow {
  coId: string;
  clientName: string;
  weightLb: string;
  itemsCount: number;
  share: number;
  charge: number;
}

export function QuickCalculator({ shippingSettings, exchangeRate, clientOrders }: QuickCalculatorProps) {
  const { toast } = useToast();
  const freightRate = shippingSettings?.airRatePerLb ?? 6.50;
  const clientRate = shippingSettings?.airPricePerLb ?? 12.00;

  // ====== TAB 1: AI estimate (description + optional screenshot) ======
  const [aiDescription, setAiDescription] = useState('');
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [weightOverride, setWeightOverride] = useState<number | null>(null);
  const aiTabRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recalculate everything when user overrides the weight
  const adjustedResult = useMemo(() => {
    if (!aiResult) return null;
    if (weightOverride == null) return aiResult;
    const newWeight = Math.max(0.1, weightOverride);
    const billable = Math.ceil(newWeight);
    const myCost = Math.round(billable * freightRate * 100) / 100;
    const charge = Math.round(billable * clientRate * 100) / 100;
    const items = (aiResult.items || []) as any[];
    const totalItemW = items.reduce((s, it) => s + (it.weight_lb || 0) * (it.quantity || 1), 0) || newWeight;
    const enriched = items.map((it: any) => {
      const itemW = (it.weight_lb || 0) * (it.quantity || 1);
      const share = totalItemW > 0 ? itemW / totalItemW : 0;
      const itemShipping = Math.round(charge * share * 100) / 100;
      const totalPrice = it.total_price_usd;
      const fullTotal = totalPrice != null ? Math.round((totalPrice + itemShipping) * 100) / 100 : null;
      const fullPerUnit = fullTotal != null ? Math.round((fullTotal / it.quantity) * 100) / 100 : null;
      return { ...it, shipping_share_usd: itemShipping, full_total_usd: fullTotal, full_per_unit_usd: fullPerUnit };
    });
    const subtotal = aiResult.products_subtotal_usd;
    return {
      ...aiResult,
      items: enriched,
      estimated_weight_lb: Math.round(newWeight * 100) / 100,
      billable_weight_lb: billable,
      my_cost: myCost,
      client_charge: charge,
      profit: Math.round((charge - myCost) * 100) / 100,
      grand_total_usd: subtotal != null ? Math.round((subtotal + charge) * 100) / 100 : null,
    };
  }, [aiResult, weightOverride, freightRate, clientRate]);

  const compressImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas ctx'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleImageFile = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      setAiImage(compressed);
    } catch (err: any) {
      toast({ title: 'Error', description: 'No se pudo procesar la imagen', variant: 'destructive' });
    }
  };

  // Paste support inside the tab
  useEffect(() => {
    const el = aiTabRef.current;
    if (!el) return;
    const handler = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await handleImageFile(file);
            toast({ title: '📸 Imagen pegada', description: 'Ya puedes estimar' });
          }
          break;
        }
      }
    };
    el.addEventListener('paste', handler as any);
    return () => el.removeEventListener('paste', handler as any);
  }, [toast]);

  const runAIEstimate = async () => {
    if (!aiDescription.trim() && !aiImage) return;
    setAiLoading(true);
    setAiResult(null);
    setWeightOverride(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-shipping-estimate', {
        body: {
          description: aiDescription,
          ratePerLb: freightRate,
          pricePerLb: clientRate,
          imageBase64: aiImage,
          exchangeRate,
        },
      });
      if (error) throw error;
      if (data?.success) setAiResult(data.data);
      else toast({ title: 'No se pudo estimar', description: data?.error || 'Intenta de nuevo', variant: 'destructive' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const resultRef = useRef<HTMLDivElement>(null);

  const downloadImage = async () => {
    if (!resultRef.current) return;
    try {
      const dataUrl = await toPng(resultRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `calculadora-envio-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: '✅ Imagen descargada' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo generar la imagen', variant: 'destructive' });
    }
  };

  // ====== TAB 2: Distribute invoice between clients ======
  const [invoiceTotal, setInvoiceTotal] = useState('');
  const eligibleOrders = useMemo(
    () => clientOrders.filter(co => co.shippingPaymentStatus !== 'Pagado').slice(0, 30),
    [clientOrders]
  );
  const [selectedRows, setSelectedRows] = useState<Record<string, string>>({}); // coId -> weight string

  const toggleRow = (coId: string) => {
    setSelectedRows(prev => {
      if (prev[coId] !== undefined) {
        const { [coId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [coId]: '' };
    });
  };
  const setRowWeight = (coId: string, w: string) => {
    setSelectedRows(prev => ({ ...prev, [coId]: w }));
  };

  const distribution = useMemo<DistributionRow[]>(() => {
    const total = parseFloat(invoiceTotal);
    const entries = Object.entries(selectedRows);
    if (!total || total <= 0 || entries.length === 0) return [];

    const rows = entries.map(([coId, wStr]) => {
      const co = eligibleOrders.find(c => c.id === coId);
      const w = parseFloat(wStr);
      const itemsCount = co?.products.length || 1;
      return {
        coId,
        clientName: co?.clientName || 'Cliente',
        weightLb: wStr,
        itemsCount,
        weight: !isNaN(w) && w > 0 ? w : null,
      };
    });

    const allHaveWeight = rows.every(r => r.weight !== null);
    let basis: number[];
    if (allHaveWeight) {
      basis = rows.map(r => r.weight!);
    } else {
      // fallback: distribute by item count
      basis = rows.map(r => r.itemsCount);
    }
    const totalBasis = basis.reduce((a, b) => a + b, 0) || 1;

    return rows.map((r, i) => {
      const share = (basis[i] / totalBasis) * total;
      const ratio = clientRate / freightRate;
      const charge = share * ratio;
      return {
        coId: r.coId,
        clientName: r.clientName,
        weightLb: r.weightLb,
        itemsCount: r.itemsCount,
        share: Math.round(share * 100) / 100,
        charge: Math.round(charge * 100) / 100,
      };
    });
  }, [invoiceTotal, selectedRows, eligibleOrders, freightRate, clientRate]);

  const totalCharge = distribution.reduce((s, r) => s + r.charge, 0);
  const totalProfit = totalCharge - (parseFloat(invoiceTotal) || 0);

  // ====== TAB 3: Quick price ======
  const [productCost, setProductCost] = useState('');
  const pricingCalc = useMemo(() => {
    const cost = parseFloat(productCost);
    if (!cost || cost <= 0) return null;
    const margin35 = cost * 1.35;
    const margin50 = cost * 1.50;
    return {
      cost, margin35, margin50,
      bs35: exchangeRate ? margin35 * exchangeRate : null,
      bs50: exchangeRate ? margin50 * exchangeRate : null,
    };
  }, [productCost, exchangeRate]);

  const fmt = fmtMoney;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Calculadora Rápida
        </h3>

        <Tabs defaultValue="ai-estimate">
          <TabsList className="grid grid-cols-3 w-full h-8">
            <TabsTrigger value="ai-estimate" className="text-xs gap-1">
              <Sparkles className="h-3 w-3" /> Estimar IA
            </TabsTrigger>
            <TabsTrigger value="distribute" className="text-xs gap-1">
              <Receipt className="h-3 w-3" /> Distribuir
            </TabsTrigger>
            <TabsTrigger value="price" className="text-xs gap-1">
              <Tag className="h-3 w-3" /> Precio
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: AI Estimate */}
          <TabsContent value="ai-estimate" className="space-y-2 pt-2" ref={aiTabRef} tabIndex={0}>
            <p className="text-[11px] text-muted-foreground">
              Describe los productos o sube/pega una captura del carrito. La IA detecta cada item, su precio y peso, y calcula precios totales e individuales con envío.
            </p>
            <Textarea
              value={aiDescription}
              onChange={e => setAiDescription(e.target.value)}
              placeholder="Ej: 3 vestidos de Shein, 2 pares de zapatos talla 38 (opcional si subes captura)"
              rows={2}
              className="text-xs"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleImageFile(f);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            {aiImage ? (
              <div className="relative inline-block">
                <img src={aiImage} alt="captura" className="h-16 rounded border border-border" />
                <button
                  onClick={() => setAiImage(null)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-7 text-xs"
              >
                <Upload className="h-3 w-3 mr-1" /> Subir o pegar (Ctrl+V) captura
              </Button>
            )}
            <Button onClick={runAIEstimate} disabled={(!aiDescription.trim() && !aiImage) || aiLoading} size="sm" className="w-full h-7 text-xs">
              {aiLoading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Estimando...</> : <><Sparkles className="h-3 w-3 mr-1" /> Estimar con IA</>}
            </Button>
            {adjustedResult && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  onClick={downloadImage}
                >
                  <Download className="h-3 w-3 mr-1" /> Descargar imagen
                </Button>
              <div ref={resultRef} className="text-xs space-y-1 p-3 rounded-md border-l-2 border-primary bg-primary/5">
                <p className="font-semibold">⚖️ ~{adjustedResult.estimated_weight_lb} lbs ({adjustedResult.billable_weight_lb} lbs facturables)</p>

                {/* Manual weight override */}
                <div className="flex items-center gap-1 bg-background/60 rounded p-1 border border-border/50">
                  <span className="text-[10px] text-muted-foreground">Ajustar peso:</span>
                  <Button type="button" size="sm" variant="outline" className="h-5 w-5 p-0" onClick={() => setWeightOverride(Math.max(0.1, (weightOverride ?? aiResult.estimated_weight_lb) - 0.5))}>
                    <Minus className="h-2.5 w-2.5" />
                  </Button>
                  <Input
                    type="number"
                    step="0.1"
                    value={weightOverride ?? aiResult.estimated_weight_lb}
                    onChange={(e) => setWeightOverride(parseFloat(e.target.value) || 0.1)}
                    className="h-5 w-14 text-[10px] px-1"
                  />
                  <Button type="button" size="sm" variant="outline" className="h-5 w-5 p-0" onClick={() => setWeightOverride(Math.max(0.1, (weightOverride ?? aiResult.estimated_weight_lb) + 0.5))}>
                    <Plus className="h-2.5 w-2.5" />
                  </Button>
                  {weightOverride != null && (
                    <Button type="button" size="sm" variant="ghost" className="h-5 px-1 text-[9px] ml-auto" onClick={() => setWeightOverride(null)}>
                      reset
                    </Button>
                  )}
                </div>

                <p className="text-muted-foreground italic text-[10px]">{aiResult.reasoning}</p>

                {Array.isArray(adjustedResult.items) && adjustedResult.items.length > 0 && (
                  <div className="border-t border-border pt-1 mt-1 space-y-1">
                    <p className="font-semibold text-[11px]">Detalle por producto:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {adjustedResult.items.map((it: any, idx: number) => (
                        <div key={idx} className="border border-border/50 rounded p-1.5 bg-background/50">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium truncate flex-1">{it.name}</span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              x{it.quantity} · {it.weight_lb}lb
                            </span>
                          </div>
                          <div className="text-[10px] space-y-0.5 mt-0.5">
                            {it.total_price_usd != null && (
                              <p>Producto: {fmt(it.total_price_usd)}{it.quantity > 1 && it.unit_price_usd != null && <span className="text-muted-foreground"> ({fmt(it.unit_price_usd)}/u)</span>}</p>
                            )}
                            <p>+ Envío proporcional: <span className="text-muted-foreground">{fmt(it.shipping_share_usd)}</span></p>
                            {it.full_total_usd != null && (
                              <p className="font-semibold text-primary">
                                Total: {fmt(it.full_total_usd)}
                                {it.quantity > 1 && it.full_per_unit_usd != null && <span className="text-[10px] text-muted-foreground font-normal"> · {fmt(it.full_per_unit_usd)}/u</span>}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-border pt-1 mt-1 space-y-0.5">
                  {adjustedResult.products_subtotal_usd != null && (
                    <p>Subtotal productos: <strong>{fmt(adjustedResult.products_subtotal_usd)}</strong></p>
                  )}
                  <p>Empresa cobra envío: <strong>{fmt(adjustedResult.my_cost)}</strong></p>
                  <p>Cobrar envío al cliente: <strong className="text-primary">{fmt(adjustedResult.client_charge)}</strong></p>
                  <p>Ganancia bruta envío: <strong className="text-profit">{fmt(adjustedResult.profit)}</strong></p>
                  {adjustedResult.grand_total_usd != null && (
                    <p className="border-t border-border pt-0.5 mt-0.5">
                      Gran total al cliente: <strong className="text-primary">{fmt(adjustedResult.grand_total_usd)}</strong>
                      {exchangeRate && <span className="text-muted-foreground"> ≈ {(adjustedResult.grand_total_usd * exchangeRate).toFixed(0)} Bs</span>}
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">Confianza: {aiResult.confidence}</p>
              </div>
              </>
            )}
          </TabsContent>

          {/* TAB 2: Distribute invoice */}
          <TabsContent value="distribute" className="space-y-2 pt-2">
            <p className="text-[11px] text-muted-foreground">
              Pon la factura total de Total Envíos y selecciona los pedidos involucrados. Si conoces pesos, ponlos; si no, se distribuye por # de productos.
            </p>
            <div>
              <Input
                type="number"
                step="0.01"
                value={invoiceTotal}
                onChange={e => setInvoiceTotal(e.target.value)}
                placeholder="Factura total empresa $"
                className="h-7 text-xs"
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-md p-1">
              {eligibleOrders.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-2">No hay pedidos pendientes de envío</p>
              )}
              {eligibleOrders.map(co => {
                const checked = selectedRows[co.id] !== undefined;
                return (
                  <div key={co.id} className={`flex items-center gap-2 p-1 rounded text-[11px] ${checked ? 'bg-primary/10' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleRow(co.id)} className="h-3 w-3" />
                    <span className="flex-1 truncate">{co.clientName} <span className="text-muted-foreground">({co.products.length}p)</span></span>
                    {checked && (
                      <Input
                        type="number"
                        step="0.1"
                        value={selectedRows[co.id]}
                        onChange={e => setRowWeight(co.id, e.target.value)}
                        placeholder="lbs"
                        className="h-6 w-16 text-[10px]"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {distribution.length > 0 && (
              <div className="text-xs space-y-1 p-2 rounded-md border-l-2 border-primary bg-primary/5">
                {distribution.map(r => (
                  <div key={r.coId} className="flex justify-between">
                    <span className="truncate">{r.clientName}</span>
                    <span>
                      <span className="text-muted-foreground">paga {fmt(r.share)}</span>
                      {' → '}
                      <strong className="text-primary">cobrar {fmt(r.charge)}</strong>
                    </span>
                  </div>
                ))}
                <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold">
                  <span>Total a cobrar</span>
                  <span className="text-primary">{fmt(totalCharge)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ganancia</span>
                  <span className="text-profit font-semibold">{fmt(totalProfit)}</span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: Price */}
          <TabsContent value="price" className="space-y-2 pt-2">
            <Input
              type="number"
              step="0.01"
              value={productCost}
              onChange={e => setProductCost(e.target.value)}
              placeholder="Costo del producto $"
              className="h-7 text-xs"
            />
            {pricingCalc && (
              <div className="text-xs space-y-0.5 p-2 rounded-md border-l-2 border-primary bg-primary/5">
                <p>Vender +35%: <strong className="text-primary">{fmt(pricingCalc.margin35)}</strong>{pricingCalc.bs35 != null && <span className="text-muted-foreground"> ≈ {pricingCalc.bs35.toFixed(0)} Bs</span>}</p>
                <p>Vender +50%: <strong className="text-primary">{fmt(pricingCalc.margin50)}</strong>{pricingCalc.bs50 != null && <span className="text-muted-foreground"> ≈ {pricingCalc.bs50.toFixed(0)} Bs</span>}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
