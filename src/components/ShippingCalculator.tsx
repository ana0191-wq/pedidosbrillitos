import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Camera, Plane, Ship, Package, Settings2 } from 'lucide-react';
import { calcAirShipping, calcSeaShipping, calcUnitDistribution, type AirShippingResult, type SeaShippingResult, type UnitDistributionResult } from '@/lib/shipping-calc';
import type { ShippingSettings } from '@/hooks/useShippingSettings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ShippingCalculatorProps {
  settings: ShippingSettings;
  onSaveSettings: (s: ShippingSettings) => void;
}

export function ShippingCalculator({ settings, onSaveSettings }: ShippingCalculatorProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'air' | 'sea' | 'distribute' | 'settings'>('air');
  const [loading, setLoading] = useState(false);

  // Dimensions (shared)
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

  // Air
  const [weightLb, setWeightLb] = useState('');
  const [weightOz, setWeightOz] = useState('');
  const [extras, setExtras] = useState('0');
  const [airResult, setAirResult] = useState<AirShippingResult | null>(null);

  // Sea
  const [seaResult, setSeaResult] = useState<SeaShippingResult | null>(null);

  // Distribution
  const [totalShippingCost, setTotalShippingCost] = useState('');
  const [shippingPercent, setShippingPercent] = useState(String(settings.defaultShippingPercent * 100));
  const [totalUnits, setTotalUnits] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [margin, setMargin] = useState(String(settings.defaultMarginPercent * 100));
  const [distResult, setDistResult] = useState<UnitDistributionResult | null>(null);

  // Settings
  const [editSettings, setEditSettings] = useState(settings);

  // AI extraction
  const [textInput, setTextInput] = useState('');

  const handleAIExtract = async (source: 'text' | 'image', value: string) => {
    setLoading(true);
    try {
      const body: any = source === 'text' ? { text: value } : { imageBase64: value };
      const { data, error } = await supabase.functions.invoke('extract-shipping', { body });
      if (error) throw error;
      if (data?.success && data.data) {
        const d = data.data;
        if (d.length_in) setLength(String(d.length_in));
        if (d.width_in) setWidth(String(d.width_in));
        if (d.height_in) setHeight(String(d.height_in));
        if (d.weight_lb) setWeightLb(String(d.weight_lb));
        if (d.weight_oz) setWeightOz(String(d.weight_oz));
        if (d.shipping_type === 'AEREO') setTab('air');
        if (d.shipping_type === 'MARITIMO') setTab('sea');
        toast({ title: '✨ Datos extraídos', description: `${d.shipping_type || 'Revisa'} los datos y calcula` });
      } else {
        toast({ title: 'No se pudo extraer', description: data?.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo procesar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleAIExtract('image', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const calcAir = () => {
    const result = calcAirShipping({
      lengthIn: parseFloat(length) || 0,
      widthIn: parseFloat(width) || 0,
      heightIn: parseFloat(height) || 0,
      weightLb: parseFloat(weightLb) || 0,
      weightOz: parseFloat(weightOz) || undefined,
      courierRatePerLb: settings.airRatePerLb,
      pricePerLb: settings.airPricePerLb,
      extras: parseFloat(extras) || 0,
    });
    setAirResult(result);
  };

  const calcSea = () => {
    const result = calcSeaShipping({
      lengthIn: parseFloat(length) || 0,
      widthIn: parseFloat(width) || 0,
      heightIn: parseFloat(height) || 0,
      ratePerFt3: settings.seaRatePerFt3,
      minimum: settings.seaMinimum,
      insurance: settings.seaInsurance,
      desiredProfit: settings.seaProfit,
    });
    setSeaResult(result);
  };

  const calcDist = () => {
    const result = calcUnitDistribution({
      totalRealShippingCost: parseFloat(totalShippingCost) || 0,
      shippingPercentForMerch: (parseFloat(shippingPercent) || 40) / 100,
      totalSellableUnits: parseInt(totalUnits) || 1,
      productUnitCost: parseFloat(unitCost) || 0,
      marginPercent: (parseFloat(margin) || 40) / 100,
    });
    setDistResult(result);
  };

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const fmtN = (n: number, d = 2) => n.toFixed(d);

  const ResultRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${highlight ? 'text-green-600 text-base' : 'text-foreground'}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">📦 Calculadora de Envíos</h2>

      {/* AI Input */}
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">🤖 Extracción automática</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">📄 Texto manual</Label>
              <Textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder='13 × 11 × 5 in, 4 lb, envío $37' rows={2} />
              <Button size="sm" variant="outline" className="mt-1 w-full" disabled={!textInput.trim() || loading} onClick={() => handleAIExtract('text', textInput)}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Extraer
              </Button>
            </div>
            <div>
              <Label className="text-xs">📷 Foto de etiqueta</Label>
              <Input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} disabled={loading} />
              {loading && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Analizando...</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shared dimensions */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">📐 Dimensiones del paquete</p>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Largo (in)</Label><Input type="number" step="0.1" value={length} onChange={e => setLength(e.target.value)} /></div>
            <div><Label className="text-xs">Ancho (in)</Label><Input type="number" step="0.1" value={width} onChange={e => setWidth(e.target.value)} /></div>
            <div><Label className="text-xs">Alto (in)</Label><Input type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="air" className="gap-1 text-xs"><Plane className="h-3 w-3" /> Aéreo</TabsTrigger>
          <TabsTrigger value="sea" className="gap-1 text-xs"><Ship className="h-3 w-3" /> Marítimo</TabsTrigger>
          <TabsTrigger value="distribute" className="gap-1 text-xs"><Package className="h-3 w-3" /> Reparto</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1 text-xs"><Settings2 className="h-3 w-3" /> Tarifas</TabsTrigger>
        </TabsList>

        <TabsContent value="air" className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Peso real (lb)</Label><Input type="number" step="0.01" value={weightLb} onChange={e => setWeightLb(e.target.value)} /></div>
            <div><Label className="text-xs">Peso en oz (opc.)</Label><Input type="number" step="0.1" value={weightOz} onChange={e => setWeightOz(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Extras (taxi, seguro...)</Label><Input type="number" step="0.01" value={extras} onChange={e => setExtras(e.target.value)} /></div>
          <Button onClick={calcAir} className="w-full">✈️ Calcular Aéreo</Button>

          {airResult && (
            <Card className="bg-muted/30"><CardContent className="p-3 space-y-1">
              <ResultRow label="Peso real" value={`${fmtN(airResult.realWeightLb)} lb`} />
              <ResultRow label="Peso volumétrico" value={`${fmtN(airResult.volumetricWeight)} lb`} />
              <ResultRow label="Peso cobrable" value={`${airResult.chargeableWeight} lb`} />
              <ResultRow label="Costo real envío" value={fmt(airResult.realShippingCost)} />
              <ResultRow label="Precio al cliente" value={fmt(airResult.clientShippingPrice)} />
              <ResultRow label="Ganancia envío" value={fmt(airResult.shippingProfit)} highlight />
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="sea" className="space-y-3 pt-3">
          <Button onClick={calcSea} className="w-full">🚢 Calcular Marítimo</Button>

          {seaResult && (
            <Card className="bg-muted/30"><CardContent className="p-3 space-y-1">
              <ResultRow label="Volumen" value={`${fmtN(seaResult.volumeFt3, 4)} ft³`} />
              <ResultRow label="Costo base" value={fmt(seaResult.baseCost)} />
              <ResultRow label="Costo real (con mín.)" value={fmt(seaResult.realCost)} />
              <ResultRow label="Costo total (+ seguro)" value={fmt(seaResult.realCostTotal)} />
              <ResultRow label="Precio al cliente" value={fmt(seaResult.clientPrice)} highlight />
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="distribute" className="space-y-3 pt-3">
          <div><Label className="text-xs">Costo total envío real ($)</Label><Input type="number" step="0.01" value={totalShippingCost} onChange={e => setTotalShippingCost(e.target.value)} /></div>
          <div><Label className="text-xs">% envío para mercancía</Label><Input type="number" step="1" value={shippingPercent} onChange={e => setShippingPercent(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Total unidades vendibles</Label><Input type="number" value={totalUnits} onChange={e => setTotalUnits(e.target.value)} /></div>
            <div><Label className="text-xs">Costo unitario producto ($)</Label><Input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Margen deseado (%)</Label><Input type="number" step="1" value={margin} onChange={e => setMargin(e.target.value)} /></div>
          <Button onClick={calcDist} className="w-full">📊 Calcular Reparto</Button>

          {distResult && (
            <Card className="bg-muted/30"><CardContent className="p-3 space-y-1">
              <ResultRow label="Envío para mercancía" value={fmt(distResult.shippingForMerch)} />
              <ResultRow label="Envío por unidad" value={fmt(distResult.shippingPerUnit)} />
              <ResultRow label="Costo real unitario" value={fmt(distResult.realUnitCost)} />
              <ResultRow label="Precio sugerido" value={fmt(distResult.suggestedPrice)} highlight />
              <ResultRow label="Ganancia por unidad" value={fmt(distResult.unitProfit)} />
              <ResultRow label="Ganancia total estimada" value={fmt(distResult.totalEstimatedProfit)} highlight />
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-3 pt-3">
          <p className="text-xs text-muted-foreground">Tarifas del courier (se guardan para futuros cálculos)</p>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Tarifa aérea ($/lb)</Label><Input type="number" step="0.01" value={editSettings.airRatePerLb} onChange={e => setEditSettings({...editSettings, airRatePerLb: parseFloat(e.target.value) || 0})} /></div>
            <div><Label className="text-xs">Precio aéreo ($/lb)</Label><Input type="number" step="0.01" value={editSettings.airPricePerLb} onChange={e => setEditSettings({...editSettings, airPricePerLb: parseFloat(e.target.value) || 0})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Tarifa marítima ($/ft³)</Label><Input type="number" step="0.01" value={editSettings.seaRatePerFt3} onChange={e => setEditSettings({...editSettings, seaRatePerFt3: parseFloat(e.target.value) || 0})} /></div>
            <div><Label className="text-xs">Mínimo marítimo ($)</Label><Input type="number" step="0.01" value={editSettings.seaMinimum} onChange={e => setEditSettings({...editSettings, seaMinimum: parseFloat(e.target.value) || 0})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Seguro marítimo ($)</Label><Input type="number" step="0.01" value={editSettings.seaInsurance} onChange={e => setEditSettings({...editSettings, seaInsurance: parseFloat(e.target.value) || 0})} /></div>
            <div><Label className="text-xs">Ganancia marítima ($)</Label><Input type="number" step="0.01" value={editSettings.seaProfit} onChange={e => setEditSettings({...editSettings, seaProfit: parseFloat(e.target.value) || 0})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">% envío p/mercancía</Label><Input type="number" step="1" value={editSettings.defaultShippingPercent * 100} onChange={e => setEditSettings({...editSettings, defaultShippingPercent: (parseFloat(e.target.value) || 0) / 100})} /></div>
            <div><Label className="text-xs">Margen por defecto (%)</Label><Input type="number" step="1" value={editSettings.defaultMarginPercent * 100} onChange={e => setEditSettings({...editSettings, defaultMarginPercent: (parseFloat(e.target.value) || 0) / 100})} /></div>
          </div>
          <Button onClick={() => onSaveSettings(editSettings)} className="w-full">💾 Guardar Tarifas</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
