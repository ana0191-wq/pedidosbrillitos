import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, DollarSign, Truck, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIPricingCalculatorProps {
  exchangeRate: number | null;
}

export function AIPricingCalculator({ exchangeRate }: AIPricingCalculatorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Merchandise
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [costUSD, setCostUSD] = useState('');
  const [profitPercent, setProfitPercent] = useState('30');
  const [extraCosts, setExtraCosts] = useState('0');
  const [merchResult, setMerchResult] = useState<any>(null);

  // Shipping
  const [weight, setWeight] = useState('');
  const [destination, setDestination] = useState('');
  const [shippingType, setShippingType] = useState('aereo');
  const [shipResult, setShipResult] = useState<any>(null);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          setImageBase64(result);
          setImagePreview(result);
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const calculate = async (type: 'merchandise' | 'shipping') => {
    if (!exchangeRate) {
      toast({ title: 'Sin tasa', description: 'Configura la tasa de cambio primero.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const body = type === 'merchandise'
        ? {
            type: 'merchandise',
            imageBase64: imageBase64 || undefined,
            productName: productName || undefined,
            costUSD: costUSD ? parseFloat(costUSD) : undefined,
            exchangeRate,
            profitPercent: parseFloat(profitPercent) || 30,
            extraCosts: parseFloat(extraCosts) || 0,
          }
        : {
            type: 'shipping',
            weight: parseFloat(weight) || 0,
            destination,
            shippingType,
            exchangeRate,
          };

      const { data, error } = await supabase.functions.invoke('ai-pricing', { body });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Error desconocido');

      if (type === 'merchandise') {
        setMerchResult(data.data);
        if (data.data.costUSD && !costUSD) {
          setCostUSD(String(data.data.costUSD));
        }
      } else {
        setShipResult(data.data);
      }

      toast({ title: '✨ Calculado', description: 'Precio sugerido por IA listo.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo calcular.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Asistente de Precios IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="merchandise">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="merchandise" className="gap-1 text-xs">
              <DollarSign className="h-3.5 w-3.5" /> Precio de Venta
            </TabsTrigger>
            <TabsTrigger value="shipping" className="gap-1 text-xs">
              <Truck className="h-3.5 w-3.5" /> Precio de Envío
            </TabsTrigger>
          </TabsList>

          <TabsContent value="merchandise" className="space-y-3">
            {/* Paste zone */}
            <div
              onPaste={handlePaste}
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors focus-within:border-primary"
              tabIndex={0}
            >
              {imagePreview ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={imagePreview} alt="Preview" className="max-h-32 rounded-md object-contain" />
                  <button
                    onClick={() => { setImageBase64(null); setImagePreview(null); }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Quitar imagen
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                  <p className="text-sm">Pega una captura aquí (Ctrl+V)</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Producto</Label>
                <Input
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="Nombre (opcional)"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Costo USD</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={costUSD}
                  onChange={e => setCostUSD(e.target.value)}
                  placeholder="Auto si hay imagen"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">% Ganancia</Label>
                <Input
                  type="number"
                  value={profitPercent}
                  onChange={e => setProfitPercent(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Costos extra $</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={extraCosts}
                  onChange={e => setExtraCosts(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Button
              onClick={() => calculate('merchandise')}
              disabled={loading || (!imageBase64 && !productName && !costUSD)}
              className="w-full gap-2"
              size="sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Calcular con IA
            </Button>

            {merchResult && (
              <div className="bg-card rounded-lg p-4 border space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Costo:</span>
                    <span className="ml-1 font-semibold">${merchResult.costUSD?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Venta USD:</span>
                    <span className="ml-1 font-bold text-primary">${merchResult.salePriceUSD?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Venta Bs:</span>
                    <span className="ml-1 font-bold text-primary">Bs {merchResult.salePriceVES?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ganancia:</span>
                    <span className="ml-1 font-semibold text-green-600">${merchResult.profitUSD?.toFixed(2)} ({merchResult.profitPercent?.toFixed(0)}%)</span>
                  </div>
                </div>
                {merchResult.suggestion && (
                  <p className="text-xs italic text-muted-foreground border-t pt-2 mt-2">💡 {merchResult.suggestion}</p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="shipping" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Peso (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="Ej: 2.5"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Destino</Label>
                <Input
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="Ciudad destino"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Tipo de envío</Label>
              <Select value={shippingType} onValueChange={setShippingType}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="terrestre">Terrestre</SelectItem>
                  <SelectItem value="aereo">Aéreo</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => calculate('shipping')}
              disabled={loading || !weight || !destination}
              className="w-full gap-2"
              size="sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Calcular con IA
            </Button>

            {shipResult && (
              <div className="bg-card rounded-lg p-4 border space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Envío USD:</span>
                    <span className="ml-1 font-bold text-primary">${shipResult.shippingUSD?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Envío Bs:</span>
                    <span className="ml-1 font-bold text-primary">Bs {shipResult.shippingVES?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Días estimados:</span>
                    <span className="ml-1 font-semibold">{shipResult.estimatedDays}</span>
                  </div>
                </div>
                {shipResult.suggestion && (
                  <p className="text-xs italic text-muted-foreground border-t pt-2 mt-2">💡 {shipResult.suggestion}</p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
