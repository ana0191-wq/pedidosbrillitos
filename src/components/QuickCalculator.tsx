import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fmtMoney } from '@/lib/utils';
import type { ShippingSettings } from '@/hooks/useShippingSettings';

interface QuickCalculatorProps {
  shippingSettings?: ShippingSettings;
  exchangeRate: number | null;
}

export function QuickCalculator({ shippingSettings, exchangeRate }: QuickCalculatorProps) {
  const [weight, setWeight] = useState('');
  const [productCost, setProductCost] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [clientCharge, setClientCharge] = useState('');

  const freightRate = shippingSettings?.airRatePerLb ?? 6.50;
  const clientRate = shippingSettings?.airPricePerLb ?? 12.00;

  const shippingCalc = useMemo(() => {
    const w = parseFloat(weight);
    if (!w || w <= 0) return null;
    const myCost = Math.ceil(w) * freightRate;
    const charge = Math.ceil(w) * clientRate;
    return { myCost, charge, profit: charge - myCost, brotherCut: (charge - myCost) * 0.30, net: (charge - myCost) * 0.70 };
  }, [weight, freightRate, clientRate]);

  const invoiceCalc = useMemo(() => {
    const inv = parseFloat(invoiceAmount);
    const cli = parseFloat(clientCharge);
    if (!inv || !cli) return null;
    const profit = cli - inv;
    return { profit, brotherCut: profit * 0.30, net: profit * 0.70 };
  }, [invoiceAmount, clientCharge]);

  const pricingCalc = useMemo(() => {
    const cost = parseFloat(productCost);
    if (!cost || cost <= 0) return null;
    const margin35 = cost * 1.35;
    const margin50 = cost * 1.50;
    return { cost, margin35, margin50, bs35: exchangeRate ? margin35 * exchangeRate : null, bs50: exchangeRate ? margin50 * exchangeRate : null };
  }, [productCost, exchangeRate]);

  const fmt = fmtMoney;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        <h3 className="text-sm font-bold text-foreground">🧮 Calculadora Rápida</h3>

        {/* Shipping by weight */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">⚖️ Envío por peso</p>
          <div className="flex gap-2">
            <Input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Peso (lbs)" className="h-7 text-xs" />
          </div>
          {shippingCalc && (
            <div className="text-xs space-y-0.5 pl-2 border-l-2 border-primary/30">
              <p>Empresa cobra: <strong>{fmt(shippingCalc.myCost)}</strong></p>
              <p>Cobrar al cliente: <strong className="text-primary">{fmt(shippingCalc.charge)}</strong></p>
              <p>Ganancia: <strong className="text-green-600">{fmt(shippingCalc.profit)}</strong></p>
              <p className="text-muted-foreground">Hermano (30%): -{fmt(shippingCalc.brotherCut)} → Neto: <strong>{fmt(shippingCalc.net)}</strong></p>
            </div>
          )}
        </div>

        {/* Invoice calc */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">📄 Factura rápida</p>
          <div className="flex gap-2">
            <Input type="number" step="0.01" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)} placeholder="Factura empresa $" className="h-7 text-xs" />
            <Input type="number" step="0.01" value={clientCharge} onChange={e => setClientCharge(e.target.value)} placeholder="Cobro cliente $" className="h-7 text-xs" />
          </div>
          {invoiceCalc && (
            <div className="text-xs space-y-0.5 pl-2 border-l-2 border-primary/30">
              <p>Ganancia: <strong className={invoiceCalc.profit >= 0 ? 'text-green-600' : 'text-destructive'}>{fmt(invoiceCalc.profit)}</strong></p>
              <p className="text-muted-foreground">Hermano (30%): -{fmt(invoiceCalc.brotherCut)} → Neto: <strong>{fmt(invoiceCalc.net)}</strong></p>
            </div>
          )}
        </div>

        {/* Price calc */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">💰 Precio de venta</p>
          <Input type="number" step="0.01" value={productCost} onChange={e => setProductCost(e.target.value)} placeholder="Costo del producto $" className="h-7 text-xs" />
          {pricingCalc && (
            <div className="text-xs space-y-0.5 pl-2 border-l-2 border-primary/30">
              <p>Vender +35%: <strong className="text-primary">{fmt(pricingCalc.margin35)}</strong>{pricingCalc.bs35 && <span className="text-muted-foreground"> ≈ {pricingCalc.bs35.toFixed(0)} Bs</span>}</p>
              <p>Vender +50%: <strong className="text-primary">{fmt(pricingCalc.margin50)}</strong>{pricingCalc.bs50 && <span className="text-muted-foreground"> ≈ {pricingCalc.bs50.toFixed(0)} Bs</span>}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
