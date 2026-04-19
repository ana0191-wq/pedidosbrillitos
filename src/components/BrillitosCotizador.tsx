import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fmtMoney } from '@/lib/utils';

type QuienCompro = 'yo' | 'cliente';
type ModoCompra = 'individual' | 'carrito';
type TipoProducto = 'general' | 'electronico';

interface CotizadorState {
  quienCompro: QuienCompro;
  modoCompra: ModoCompra;
  precioIndividual: string;
  precioCarrito: string;
  pesoReal: string;
  largo: string;
  ancho: string;
  alto: string;
  tipo: TipoProducto;
  clientesEnCajon: string;
}

function roundUp05(n: number): number {
  return Math.ceil(n * 2) / 2;
}

function Pill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
      }`}
    >
      {label}
    </button>
  );
}

function Row({ label, value, highlight, sub }: { label: string; value: string; highlight?: boolean; sub?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline ${sub ? 'pl-2' : ''}`}>
      <span className={`${sub ? 'text-[11px] text-muted-foreground' : 'text-xs text-muted-foreground'}`}>{label}</span>
      <span className={`font-semibold ${highlight ? 'text-primary text-base' : 'text-sm text-foreground'}`}>{value}</span>
    </div>
  );
}

export function BrillitosCotizador({ exchangeRate }: { exchangeRate: number | null }) {
  const [s, setS] = useState<CotizadorState>({
    quienCompro: 'cliente',
    modoCompra: 'individual',
    precioIndividual: '',
    precioCarrito: '',
    pesoReal: '',
    largo: '',
    ancho: '',
    alto: '',
    tipo: 'general',
    clientesEnCajon: '1',
  });

  const set = (key: keyof CotizadorState, val: string) =>
    setS(prev => ({ ...prev, [key]: val }));

  const result = useMemo(() => {
    const pesoReal = parseFloat(s.pesoReal) || 0;
    const largo = parseFloat(s.largo) || 0;
    const ancho = parseFloat(s.ancho) || 0;
    const alto = parseFloat(s.alto) || 0;
    const clientes = Math.max(1, parseInt(s.clientesEnCajon) || 1);
    const precioInd = parseFloat(s.precioIndividual) || 0;
    const precioCart = parseFloat(s.precioCarrito) || 0;

    if (pesoReal <= 0) return null;

    // Paso 1: Costo y cobro del producto
    let costoProducto = 0;
    let cobraProducto = 0;
    if (s.quienCompro === 'yo') {
      costoProducto = s.modoCompra === 'individual' ? precioInd : precioCart;
      cobraProducto = costoProducto;
    }

    // Paso 2: Peso cobrable
    const pesoVol = (largo && ancho && alto) ? (largo * ancho * alto) / 166 : 0;
    const pesoBase = Math.max(pesoReal, pesoVol, 1);
    const pesoCobrable = roundUp05(pesoBase);

    // Paso 3: Envío que cobra al cliente
    let envio = (pesoCobrable * 14) + 5;
    if (s.tipo === 'electronico') envio += 70;

    // Paso 4: Costo real
    let costoEmpresa = pesoCobrable * 6.50;
    if (s.tipo === 'electronico') costoEmpresa += 60;
    const costoTaxi = 10 / clientes;
    const costoTotal = costoProducto + costoEmpresa + costoTaxi;

    // Paso 5: Total cliente paga y ganancia
    const totalCliente = cobraProducto + envio;
    const ganancia = totalCliente - costoTotal;

    return {
      pesoCobrable,
      pesoVol,
      envio,
      costoProducto,
      cobraProducto,
      costoEmpresa,
      costoTaxi,
      costoTotal,
      totalCliente,
      ganancia,
    };
  }, [s]);

  const fmt = fmtMoney;
  const bsRate = exchangeRate;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* ¿Quién compró? */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">¿Quién compró?</p>
            <div className="flex gap-2">
              <Pill label="👤 Yo" active={s.quienCompro === 'yo'} onClick={() => set('quienCompro', 'yo')} />
              <Pill label="🛍️ Un cliente" active={s.quienCompro === 'cliente'} onClick={() => set('quienCompro', 'cliente')} />
            </div>
          </div>

          {/* Modo compra */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Modo de compra</p>
            <div className="flex gap-2">
              <Pill label="📦 Individual" active={s.modoCompra === 'individual'} onClick={() => set('modoCompra', 'individual')} />
              <Pill label="🛒 En carrito" active={s.modoCompra === 'carrito'} onClick={() => set('modoCompra', 'carrito')} />
            </div>
          </div>

          {/* Precios del producto */}
          {s.quienCompro === 'yo' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Precio del producto</p>
              {s.modoCompra === 'individual' ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24">Precio solo</span>
                  <Input
                    type="number" step="0.01" placeholder="0.00"
                    value={s.precioIndividual}
                    onChange={e => set('precioIndividual', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24">Precio carrito</span>
                    <Input
                      type="number" step="0.01" placeholder="0.00"
                      value={s.precioCarrito}
                      onChange={e => set('precioCarrito', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24">Precio solo</span>
                    <Input
                      type="number" step="0.01" placeholder="0.00 (opcional)"
                      value={s.precioIndividual}
                      onChange={e => set('precioIndividual', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Peso */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Peso real (lbs) <span className="text-red-400">*</span></p>
            <Input
              type="number" step="0.1" placeholder="ej: 2.5"
              value={s.pesoReal}
              onChange={e => set('pesoReal', e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Dimensiones */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dimensiones en pulgadas <span className="text-muted-foreground font-normal">(opcional)</span></p>
            <div className="grid grid-cols-3 gap-2">
              {(['largo', 'ancho', 'alto'] as const).map(dim => (
                <div key={dim} className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground capitalize">{dim}</span>
                  <Input
                    type="number" step="0.1" placeholder="0"
                    value={s[dim]}
                    onChange={e => set(dim, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de producto</p>
            <div className="flex gap-2">
              <Pill label="👗 General" active={s.tipo === 'general'} onClick={() => set('tipo', 'general')} />
              <Pill label="💻 Electrónico" active={s.tipo === 'electronico'} onClick={() => set('tipo', 'electronico')} />
            </div>
          </div>

          {/* Clientes en cajón */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clientes en el cajón</p>
            <div className="flex gap-2">
              {['1', '2', '3', '4', '5'].map(n => (
                <Pill key={n} label={n} active={s.clientesEnCajon === n} onClick={() => set('clientesEnCajon', n)} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {result && (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-bold text-foreground">📊 Desglose</p>

            {/* Peso */}
            <div className="space-y-1 border-b border-border pb-2">
              <Row label="Peso real" value={`${parseFloat(s.pesoReal).toFixed(1)} lbs`} />
              {result.pesoVol > 0 && <Row label="Peso volumétrico" value={`${result.pesoVol.toFixed(1)} lbs`} sub />}
              <Row label="⚖️ Peso cobrable" value={`${result.pesoCobrable} lbs`} />
            </div>

            {/* Costos */}
            <div className="space-y-1 border-b border-border pb-2">
              {result.costoProducto > 0 && <Row label="Costo producto" value={fmt(result.costoProducto)} />}
              <Row label="Costo empresa (envío)" value={fmt(result.costoEmpresa)} sub />
              <Row label="Taxi proporcional" value={fmt(result.costoTaxi)} sub />
              <Row label="Tu costo total" value={fmt(result.costoTotal)} />
            </div>

            {/* Cobro al cliente */}
            <div className="space-y-1 border-b border-border pb-2">
              {result.cobraProducto > 0 && <Row label="Cobrar producto" value={fmt(result.cobraProducto)} />}
              <Row label="Cobrar envío" value={fmt(result.envio)} />
              <Row label="Total que paga el cliente" value={fmt(result.totalCliente)} />
              {bsRate && (
                <Row
                  label="≈ en Bs"
                  value={`${(result.totalCliente * bsRate).toLocaleString('es', { maximumFractionDigits: 0 })} Bs`}
                  sub
                />
              )}
            </div>

            {/* Ganancia */}
            <div className={`rounded-lg p-3 text-center ${result.ganancia >= 0 ? 'bg-green-50 dark:bg-green-950/30 border border-green-200' : 'bg-red-50 dark:bg-red-950/30 border border-red-200'}`}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                {result.ganancia >= 0 ? '✅ Tu ganancia' : '⚠️ Perderías dinero'}
              </p>
              <p className={`text-3xl font-black ${result.ganancia >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
                {fmt(result.ganancia)}
              </p>
              {bsRate && result.ganancia > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {(result.ganancia * bsRate).toLocaleString('es', { maximumFractionDigits: 0 })} Bs
                </p>
              )}
            </div>

            {/* Reset */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setS({
                quienCompro: 'cliente', modoCompra: 'individual',
                precioIndividual: '', precioCarrito: '',
                pesoReal: '', largo: '', ancho: '', alto: '',
                tipo: 'general', clientesEnCajon: '1',
              })}
            >
              🔄 Limpiar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}