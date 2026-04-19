import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { fmtMoney } from '@/lib/utils';

// ── Catálogo de pesos por tipo de prenda (en lbs, promedio) ──────────────────
// Fuente: datos reales de envíos internacionales, convertidos de gramos

const PRODUCT_CATALOG: Record<string, { label: string; lbsMin: number; lbsMax: number; emoji: string }> = {
  // Ropa mujer
  't-shirt-f':    { label: 'Camiseta / Top (mujer)',    lbsMin: 0.22, lbsMax: 0.31, emoji: '👚' },
  'jeans-f':      { label: 'Jeans (mujer)',              lbsMin: 0.88, lbsMax: 1.32, emoji: '👖' },
  'dress':        { label: 'Vestido',                    lbsMin: 0.26, lbsMax: 0.77, emoji: '👗' },
  'leggings':     { label: 'Leggings / Leggins',         lbsMin: 0.57, lbsMax: 0.66, emoji: '🩱' },
  'shorts-f':     { label: 'Shorts (mujer)',             lbsMin: 0.33, lbsMax: 0.44, emoji: '🩳' },
  'sweater-f':    { label: 'Suéter / Hoodie (mujer)',    lbsMin: 0.44, lbsMax: 0.77, emoji: '🧥' },
  'jacket-f':     { label: 'Chaqueta / Abrigo (mujer)', lbsMin: 1.32, lbsMax: 2.20, emoji: '🧥' },
  'bra':          { label: 'Brasier / Lencería',         lbsMin: 0.09, lbsMax: 0.15, emoji: '👙' },
  'pajamas-f':    { label: 'Pijama (mujer)',             lbsMin: 0.22, lbsMax: 0.44, emoji: '🌙' },
  'swimsuit':     { label: 'Vestido de baño',            lbsMin: 0.20, lbsMax: 0.26, emoji: '👙' },
  // Ropa hombre
  't-shirt-m':    { label: 'Camiseta (hombre)',          lbsMin: 0.33, lbsMax: 0.66, emoji: '👕' },
  'jeans-m':      { label: 'Jeans (hombre)',             lbsMin: 1.43, lbsMax: 1.76, emoji: '👖' },
  'shorts-m':     { label: 'Shorts (hombre)',            lbsMin: 0.55, lbsMax: 0.66, emoji: '🩳' },
  'sweater-m':    { label: 'Suéter / Hoodie (hombre)',   lbsMin: 0.99, lbsMax: 1.43, emoji: '🧥' },
  // Zapatos
  'sneakers-f':   { label: 'Tenis / Sneakers (mujer)',   lbsMin: 1.32, lbsMax: 1.54, emoji: '👟' },
  'sneakers-m':   { label: 'Tenis / Sneakers (hombre)', lbsMin: 1.54, lbsMax: 1.76, emoji: '👟' },
  'heels':        { label: 'Tacones / Sandalias',        lbsMin: 0.88, lbsMax: 1.32, emoji: '👠' },
  'boots-f':      { label: 'Botas (mujer)',              lbsMin: 1.76, lbsMax: 2.86, emoji: '👢' },
  'boots-m':      { label: 'Botas (hombre)',             lbsMin: 2.20, lbsMax: 3.09, emoji: '👢' },
  'flip-flops':   { label: 'Sandalias / Chanclas',       lbsMin: 0.44, lbsMax: 0.77, emoji: '🩴' },
  // Niños
  'kids-tshirt':  { label: 'Camiseta niño/a',            lbsMin: 0.11, lbsMax: 0.18, emoji: '👕' },
  'kids-jeans':   { label: 'Jeans niño/a',               lbsMin: 0.44, lbsMax: 0.88, emoji: '👖' },
  'kids-shoes':   { label: 'Zapatos niño/a',             lbsMin: 0.33, lbsMax: 0.88, emoji: '👟' },
  // Accesorios
  'bag':          { label: 'Cartera / Bolso',            lbsMin: 0.44, lbsMax: 1.10, emoji: '👜' },
  'watch':        { label: 'Reloj',                      lbsMin: 0.22, lbsMax: 0.55, emoji: '⌚' },
  'jewelry':      { label: 'Bisutería / Joyería',        lbsMin: 0.04, lbsMax: 0.22, emoji: '💍' },
  'sunglasses':   { label: 'Gafas de sol',               lbsMin: 0.07, lbsMax: 0.18, emoji: '🕶️' },
  'belt':         { label: 'Cinturón',                   lbsMin: 0.22, lbsMax: 0.44, emoji: '🪢' },
  // Electrónicos
  'phone':        { label: 'Teléfono celular',           lbsMin: 0.44, lbsMax: 0.66, emoji: '📱' },
  'tablet':       { label: 'Tablet',                     lbsMin: 0.88, lbsMax: 1.54, emoji: '📱' },
  'laptop':       { label: 'Laptop',                     lbsMin: 3.30, lbsMax: 5.50, emoji: '💻' },
  'headphones':   { label: 'Audífonos / Headphones',     lbsMin: 0.55, lbsMax: 1.10, emoji: '🎧' },
  'smartwatch':   { label: 'Smartwatch',                 lbsMin: 0.22, lbsMax: 0.44, emoji: '⌚' },
  // Hogar / otros
  'toy':          { label: 'Juguete',                    lbsMin: 0.44, lbsMax: 2.20, emoji: '🧸' },
  'perfume':      { label: 'Perfume / Fragancia',        lbsMin: 0.55, lbsMax: 1.10, emoji: '🌸' },
  'makeup':       { label: 'Maquillaje / Skincare',      lbsMin: 0.11, lbsMax: 0.44, emoji: '💄' },
};

const CATEGORIES = [
  { label: '👚 Ropa mujer',   keys: ['t-shirt-f','jeans-f','dress','leggings','shorts-f','sweater-f','jacket-f','bra','pajamas-f','swimsuit'] },
  { label: '👕 Ropa hombre',  keys: ['t-shirt-m','jeans-m','shorts-m','sweater-m'] },
  { label: '👟 Zapatos',      keys: ['sneakers-f','sneakers-m','heels','boots-f','boots-m','flip-flops'] },
  { label: '🧒 Niños',        keys: ['kids-tshirt','kids-jeans','kids-shoes'] },
  { label: '👜 Accesorios',   keys: ['bag','watch','jewelry','sunglasses','belt'] },
  { label: '💻 Electrónicos', keys: ['phone','tablet','laptop','headphones','smartwatch'] },
  { label: '🏠 Otros',        keys: ['toy','perfume','makeup'] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function roundUp05(n: number): number {
  return Math.ceil(n * 2) / 2;
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        active ? 'bg-primary text-primary-foreground border-primary shadow-sm'
               : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
      }`}>
      {label}
    </button>
  );
}

function MoneyRow({ label, value, large, sub, green, amber }: {
  label: string; value: string; large?: boolean; sub?: boolean; green?: boolean; amber?: boolean;
}) {
  return (
    <div className={`flex justify-between items-baseline ${sub ? 'pl-3' : ''}`}>
      <span className={`${sub ? 'text-[11px]' : 'text-xs'} text-muted-foreground`}>{label}</span>
      <span className={`font-bold ${large ? 'text-xl' : 'text-sm'} ${green ? 'text-green-700' : amber ? 'text-amber-600' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Producto seleccionado ────────────────────────────────────────────────────

interface ProductLine {
  id: string;
  key: string;
  qty: number;
  priceUsd: string; // precio del producto (solo si quien_compro = yo)
}

let _id = 0;
const newId = () => String(++_id);

// ─── Main component ──────────────────────────────────────────────────────────

export function BrillitosCotizador({ exchangeRate }: { exchangeRate: number | null }) {
  const [quienCompro, setQuienCompro] = useState<'yo' | 'cliente'>('cliente');
  const [modoCompra, setModoCompra] = useState<'individual' | 'carrito'>('individual');
  const [clientesEnCajon, setClientesEnCajon] = useState('1');
  const [products, setProducts] = useState<ProductLine[]>([{ id: newId(), key: '', qty: 1, priceUsd: '' }]);
  const [openCat, setOpenCat] = useState<string | null>('👚 Ropa mujer');
  const [activeProductId, setActiveProductId] = useState<string | null>(products[0].id);
  const [overrideWeight, setOverrideWeight] = useState(''); // si sabe el peso real

  const addProduct = () => {
    const id = newId();
    setProducts(p => [...p, { id, key: '', qty: 1, priceUsd: '' }]);
    setActiveProductId(id);
  };

  const removeProduct = (id: string) => {
    setProducts(p => p.filter(x => x.id !== id));
  };

  const updateProduct = (id: string, patch: Partial<ProductLine>) => {
    setProducts(p => p.map(x => x.id === id ? { ...x, ...patch } : x));
  };

  const selectType = (productId: string, key: string) => {
    updateProduct(productId, { key });
    setActiveProductId(null); // cerrar picker
  };

  // ── Cálculo ───────────────────────────────────────────────────────────────

  const result = useMemo(() => {
    const validProducts = products.filter(p => p.key !== '');
    if (validProducts.length === 0) return null;

    const clientes = Math.max(1, parseInt(clientesEnCajon) || 1);

    // Peso estimado (min y max) sumando todos los productos × qty
    let lbsMin = 0, lbsMax = 0;
    let costoProducto = 0;
    let hasElectronico = false;

    for (const p of validProducts) {
      const cat = PRODUCT_CATALOG[p.key];
      if (!cat) continue;
      lbsMin += cat.lbsMin * p.qty;
      lbsMax += cat.lbsMax * p.qty;
      if (['phone','tablet','laptop','headphones','smartwatch'].includes(p.key)) {
        hasElectronico = true;
      }
      if (quienCompro === 'yo') {
        const price = parseFloat(p.priceUsd) || 0;
        costoProducto += price;
      }
    }

    // Si tiene peso real manual, úsalo
    const manualWeight = parseFloat(overrideWeight) || 0;

    const calc = (lbsRaw: number) => {
      const pesoCobrable = roundUp05(Math.max(lbsRaw, 1));
      let envio = (pesoCobrable * 14) + 5;
      let costoEmpresa = pesoCobrable * 6.50;
      if (hasElectronico) { envio += 70; costoEmpresa += 60; }
      const costoTaxi = 10 / clientes;
      const costoTotal = costoProducto + costoEmpresa + costoTaxi;
      const totalCliente = costoProducto + envio; // cobrar producto + envío
      const ganancia = totalCliente - costoTotal;
      const corteBrother = ganancia > 0 ? ganancia * 0.30 : 0;
      const gananciaTuya = ganancia > 0 ? ganancia - corteBrother : ganancia;
      return { pesoCobrable, envio, costoEmpresa, costoTaxi, costoTotal, totalCliente, ganancia, corteBrother, gananciaTuya };
    };

    if (manualWeight > 0) {
      const r = calc(manualWeight);
      return { type: 'exact' as const, pesoReal: manualWeight, ...r, costoProducto, hasElectronico };
    }

    const rMin = calc(lbsMin);
    const rMax = calc(lbsMax);
    return {
      type: 'range' as const,
      lbsMin, lbsMax,
      min: rMin, max: rMax,
      costoProducto, hasElectronico,
    };
  }, [products, quienCompro, clientesEnCajon, overrideWeight]);

  const fmt = fmtMoney;

  return (
    <div className="space-y-4">

      {/* ── Quién compró ── */}
      <Card><CardContent className="p-4 space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">¿Quién compró?</p>
          <div className="flex gap-2">
            <Pill label="🛍️ Un cliente" active={quienCompro === 'cliente'} onClick={() => setQuienCompro('cliente')} />
            <Pill label="👤 Yo" active={quienCompro === 'yo'} onClick={() => setQuienCompro('yo')} />
          </div>
        </div>

        {quienCompro === 'yo' && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Modo de compra</p>
            <div className="flex gap-2">
              <Pill label="📦 Individual" active={modoCompra === 'individual'} onClick={() => setModoCompra('individual')} />
              <Pill label="🛒 En carrito" active={modoCompra === 'carrito'} onClick={() => setModoCompra('carrito')} />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clientes en el cajón</p>
          <div className="flex gap-2">
            {['1','2','3','4','5'].map(n => (
              <Pill key={n} label={n} active={clientesEnCajon === n} onClick={() => setClientesEnCajon(n)} />
            ))}
          </div>
        </div>
      </CardContent></Card>

      {/* ── Productos ── */}
      <Card><CardContent className="p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📦 Productos del pedido</p>

        {products.map((prod, idx) => (
          <div key={prod.id} className="border border-border rounded-xl overflow-hidden">
            {/* Cabecera del producto */}
            <div
              className="flex items-center justify-between px-3 py-2.5 bg-muted/30 cursor-pointer"
              onClick={() => setActiveProductId(activeProductId === prod.id ? null : prod.id)}
            >
              <span className="text-sm font-semibold text-foreground">
                {prod.key
                  ? `${PRODUCT_CATALOG[prod.key].emoji} ${PRODUCT_CATALOG[prod.key].label}`
                  : `Producto ${idx + 1} — toca para elegir tipo`}
              </span>
              <div className="flex items-center gap-2">
                {products.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); removeProduct(prod.id); }}
                    className="text-destructive hover:text-destructive/80 p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {activeProductId === prod.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>

            {/* Picker de tipo */}
            {activeProductId === prod.id && (
              <div className="p-3 space-y-2 border-t border-border bg-background">
                {CATEGORIES.map(cat => (
                  <div key={cat.label}>
                    <button
                      type="button"
                      onClick={() => setOpenCat(openCat === cat.label ? null : cat.label)}
                      className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wide py-1.5 hover:text-foreground transition-colors"
                    >
                      {cat.label}
                      {openCat === cat.label ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {openCat === cat.label && (
                      <div className="grid grid-cols-2 gap-1.5 pb-2">
                        {cat.keys.map(key => {
                          const item = PRODUCT_CATALOG[key];
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => selectType(prod.id, key)}
                              className={`text-left px-2.5 py-2 rounded-lg text-xs border transition-all ${
                                prod.key === key
                                  ? 'bg-primary/10 border-primary text-primary font-semibold'
                                  : 'bg-muted/30 border-transparent hover:bg-muted text-foreground'
                              }`}
                            >
                              <span className="mr-1">{item.emoji}</span>
                              {item.label}
                              <br />
                              <span className="text-[10px] text-muted-foreground">
                                ~{item.lbsMin}–{item.lbsMax} lbs
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Cantidad y precio */}
            {prod.key && (
              <div className="px-3 py-2.5 border-t border-border bg-background flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Cant.</span>
                  <button onClick={() => updateProduct(prod.id, { qty: Math.max(1, prod.qty - 1) })}
                    className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-sm font-bold hover:bg-muted/80">−</button>
                  <span className="text-sm font-bold w-4 text-center">{prod.qty}</span>
                  <button onClick={() => updateProduct(prod.id, { qty: prod.qty + 1 })}
                    className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-sm font-bold hover:bg-muted/80">+</button>
                </div>
                {quienCompro === 'yo' && (
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-xs text-muted-foreground">Precio $</span>
                    <Input
                      type="number" step="0.01" placeholder="0.00"
                      value={prod.priceUsd}
                      onChange={e => updateProduct(prod.id, { priceUsd: e.target.value })}
                      className="h-7 text-sm flex-1"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addProduct}
          className="w-full border-2 border-dashed border-border rounded-xl py-2.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar otro producto
        </button>
      </CardContent></Card>

      {/* ── Peso real opcional ── */}
      <Card><CardContent className="p-4 space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">¿Ya sabes el peso real? <span className="font-normal normal-case">(opcional)</span></p>
        <div className="flex items-center gap-2">
          <Input
            type="number" step="0.1" placeholder="Si tienes el peso exacto en lbs, ponlo aquí"
            value={overrideWeight}
            onChange={e => setOverrideWeight(e.target.value)}
            className="h-8 text-sm"
          />
          {overrideWeight && (
            <button onClick={() => setOverrideWeight('')} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          )}
        </div>
        {!overrideWeight && (
          <p className="text-[11px] text-muted-foreground">Si lo dejas vacío, la calculadora estima el peso por tipo de prenda 👆</p>
        )}
      </CardContent></Card>

      {/* ── Resultado ── */}
      {result && (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-4">

            {/* Peso */}
            <div className="space-y-1 border-b border-border pb-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">⚖️ Peso estimado</p>
              {result.type === 'exact' ? (
                <p className="text-lg font-black text-foreground">{result.pesoReal} lbs → cobrable: <span className="text-primary">{result.pesoCobrable} lbs</span></p>
              ) : (
                <>
                  <p className="text-lg font-black text-foreground">
                    {result.lbsMin.toFixed(1)}–{result.lbsMax.toFixed(1)} lbs estimado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Peso cobrable: {result.min.pesoCobrable}–{result.max.pesoCobrable} lbs
                  </p>
                </>
              )}
              {result.hasElectronico && (
                <p className="text-[11px] text-amber-600 font-semibold">⚡ Incluye cargo electrónico (+$70 envío, +$60 costo)</p>
              )}
            </div>

            {/* Costos */}
            <div className="space-y-1.5 border-b border-border pb-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Tu costo</p>
              {result.costoProducto > 0 && <MoneyRow label="Producto" value={fmt(result.costoProducto)} />}
              {result.type === 'exact' ? (
                <>
                  <MoneyRow label="Empresa (envío)" value={fmt(result.costoEmpresa)} sub />
                  <MoneyRow label="Taxi ÷ {clientes}" value={fmt(result.costoTaxi)} sub />
                  <MoneyRow label="Total que te cuesta" value={fmt(result.costoTotal)} large />
                </>
              ) : (
                <MoneyRow label="Total que te cuesta" value={`${fmt(result.min.costoTotal)} – ${fmt(result.max.costoTotal)}`} large />
              )}
            </div>

            {/* Lo que cobra al cliente */}
            <div className="space-y-1.5 border-b border-border pb-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Lo que cobra al cliente</p>
              {result.type === 'exact' ? (
                <>
                  {result.costoProducto > 0 && <MoneyRow label="Producto" value={fmt(result.costoProducto)} />}
                  <MoneyRow label="Envío" value={fmt(result.envio)} />
                  <MoneyRow label="Total cliente paga" value={fmt(result.totalCliente)} large />
                </>
              ) : (
                <>
                  <MoneyRow label="Cobrar envío" value={`${fmt(result.min.envio)} – ${fmt(result.max.envio)}`} />
                  <MoneyRow label="Total cliente paga" value={`${fmt(result.min.totalCliente)} – ${fmt(result.max.totalCliente)}`} large />
                </>
              )}
            </div>

            {/* Ganancia */}
            {result.type === 'exact' ? (
              <>
                <div className={`rounded-xl p-4 text-center ${result.ganancia >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    {result.ganancia >= 0 ? '✅ Ganancia total del pedido' : '⚠️ Perderías dinero'}
                  </p>
                  <p className={`text-5xl font-black mb-1 ${result.ganancia >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt(result.ganancia)}
                  </p>
                  {exchangeRate && result.ganancia !== 0 && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {(result.ganancia * exchangeRate).toLocaleString('es', { maximumFractionDigits: 0 })} Bs
                    </p>
                  )}
                </div>
                {result.ganancia > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">🐵 Hermano (30%)</p>
                      <p className="text-2xl font-black text-amber-700">{fmt(result.corteBrother)}</p>
                      {exchangeRate && <p className="text-[10px] text-amber-400 mt-0.5">≈ {(result.corteBrother * exchangeRate).toLocaleString('es', { maximumFractionDigits: 0 })} Bs</p>}
                    </div>
                    <div className="rounded-xl bg-pink-50 border border-pink-200 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">🌸 Tú (70%)</p>
                      <p className="text-2xl font-black text-primary">{fmt(result.gananciaTuya)}</p>
                      {exchangeRate && <p className="text-[10px] text-primary/50 mt-0.5">≈ {(result.gananciaTuya * exchangeRate).toLocaleString('es', { maximumFractionDigits: 0 })} Bs</p>}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">✅ Ganancia estimada</p>
                  <p className="text-4xl font-black text-green-700 mb-1">
                    {fmt(result.min.ganancia)} – {fmt(result.max.ganancia)}
                  </p>
                  {exchangeRate && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {(result.min.ganancia * exchangeRate).toLocaleString('es', { maximumFractionDigits: 0 })}–{(result.max.ganancia * exchangeRate).toLocaleString('es', { maximumFractionDigits: 0 })} Bs
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Basado en pesos típicos por tipo de prenda. Si conoces el peso real, ingrésalo arriba para mayor exactitud.</p>
                </div>
                {result.min.ganancia > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">🐵 Hermano (30%)</p>
                      <p className="text-xl font-black text-amber-700">{fmt(result.min.corteBrother)}–{fmt(result.max.corteBrother)}</p>
                    </div>
                    <div className="rounded-xl bg-pink-50 border border-pink-200 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">🌸 Tú (70%)</p>
                      <p className="text-xl font-black text-primary">{fmt(result.min.gananciaTuya)}–{fmt(result.max.gananciaTuya)}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground"
              onClick={() => {
                setProducts([{ id: newId(), key: '', qty: 1, priceUsd: '' }]);
                setOverrideWeight('');
                setActiveProductId(null);
              }}>
              🔄 Limpiar calculadora
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
