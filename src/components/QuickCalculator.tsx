import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Loader2, Calculator, Receipt, Tag, Upload, X, ImageIcon } from 'lucide-react';
import { fmtMoney } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import type { ClientOrder } from '@/hooks/useClientOrders';

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

  // ====== TAB 1: AI estimate (no weight) ======
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const runAIEstimate = async () => {
    if (!aiDescription.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-shipping-estimate', {
        body: { description: aiDescription, ratePerLb: freightRate, pricePerLb: clientRate },
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
          <TabsContent value="ai-estimate" className="space-y-2 pt-2">
            <p className="text-[11px] text-muted-foreground">
              Describe los productos del cliente sin peso. La IA estima cuánto va a pesar, cuánto te cobra la empresa y cuánto cobrarle al cliente.
            </p>
            <Textarea
              value={aiDescription}
              onChange={e => setAiDescription(e.target.value)}
              placeholder="Ej: 3 vestidos de Shein, 2 pares de zapatos talla 38, 5 accesorios pequeños"
              rows={2}
              className="text-xs"
            />
            <Button onClick={runAIEstimate} disabled={!aiDescription.trim() || aiLoading} size="sm" className="w-full h-7 text-xs">
              {aiLoading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Estimando...</> : <><Sparkles className="h-3 w-3 mr-1" /> Estimar con IA</>}
            </Button>
            {aiResult && (
              <div className="text-xs space-y-1 p-2 rounded-md border-l-2 border-primary bg-primary/5">
                <p className="font-semibold">⚖️ ~{aiResult.estimated_weight_lb} lbs ({aiResult.billable_weight_lb} lbs facturables)</p>
                <p className="text-muted-foreground italic text-[10px]">{aiResult.reasoning}</p>
                <div className="border-t border-border pt-1 mt-1 space-y-0.5">
                  <p>Empresa cobra: <strong>{fmt(aiResult.my_cost)}</strong></p>
                  <p>Cobrar al cliente: <strong className="text-primary">{fmt(aiResult.client_charge)}</strong></p>
                  <p>Ganancia bruta: <strong className="text-profit">{fmt(aiResult.profit)}</strong></p>
                </div>
                <p className="text-[10px] text-muted-foreground">Confianza: {aiResult.confidence}</p>
              </div>
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
