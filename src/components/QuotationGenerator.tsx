import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Download } from 'lucide-react';

interface QuotationData {
  clientName: string;
  clientPhone?: string;
  products: { name: string; price: number }[];
  shippingCharge: number;
  exchangeRate: number | null;
}

interface QuotationGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: QuotationData | null;
}

export function QuotationGenerator({ open, onOpenChange, data }: QuotationGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const generate = () => {
    if (!data || !canvasRef.current) return;
    setGenerating(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const W = 800;
    const padding = 40;

    // Calculate content height dynamically
    const productLines = data.products.length;
    const H = 520 + productLines * 32;
    canvas.width = W;
    canvas.height = H;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#FFF0F5');
    grad.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Pink top bar
    ctx.fillStyle = '#EC4899';
    ctx.fillRect(0, 0, W, 6);

    // Header
    ctx.fillStyle = '#EC4899';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨ Brillitos Store', W / 2, 50);

    // Greeting
    ctx.fillStyle = '#374151';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    let y = 90;
    ctx.fillText(`Hola ${data.clientName},`, padding, y);
    y += 24;
    ctx.fillText('aquí está tu cotización tentativa de envío:', padding, y);
    y += 36;

    // Divider
    ctx.strokeStyle = '#F9A8D4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(W - padding, y);
    ctx.stroke();
    y += 24;

    // Products
    const productTotal = data.products.reduce((s, p) => s + p.price, 0);
    data.products.forEach(p => {
      ctx.fillStyle = '#374151';
      ctx.font = '15px system-ui, -apple-system, sans-serif';
      ctx.fillText(`📦 ${p.name}`, padding, y);
      ctx.textAlign = 'right';
      ctx.fillText(fmt(p.price), W - padding, y);
      ctx.textAlign = 'left';
      y += 32;
    });

    y += 8;

    // Price rows
    const rows = [
      { icon: '🛒', label: 'Precio del producto:', value: fmt(productTotal) },
      { icon: '🚚', label: 'Envío estimado:', value: fmt(data.shippingCharge) },
    ];

    rows.forEach(row => {
      ctx.fillStyle = '#6B7280';
      ctx.font = '15px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${row.icon} ${row.label}`, padding, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.value, W - padding, y);
      ctx.textAlign = 'left';
      y += 28;
    });

    y += 8;

    // Divider
    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(W - padding, y);
    ctx.stroke();
    y += 28;

    // Total
    const total = productTotal + data.shippingCharge;
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('Total estimado:', padding, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#EC4899';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(fmt(total), W - padding, y);
    ctx.textAlign = 'left';
    y += 32;

    // Bs
    if (data.exchangeRate && data.exchangeRate > 0) {
      const bs = total * data.exchangeRate;
      ctx.fillStyle = '#6B7280';
      ctx.font = '15px system-ui, -apple-system, sans-serif';
      ctx.fillText('En Bs aprox:', padding, y);
      ctx.textAlign = 'right';
      ctx.fillText(`≈ ${bs.toLocaleString('es', { maximumFractionDigits: 0 })} Bs`, W - padding, y);
      ctx.textAlign = 'left';
      y += 36;
    }

    // Warning
    ctx.fillStyle = '#D97706';
    ctx.font = '13px system-ui, -apple-system, sans-serif';
    ctx.fillText('⚠️ Este precio es tentativo y puede variar', padding, y);
    y += 20;
    ctx.fillText('según el peso y dimensiones reales del paquete.', padding + 20, y);
    y += 36;

    // Footer
    ctx.fillStyle = '#F9A8D4';
    ctx.fillRect(0, H - 44, W, 44);
    ctx.fillStyle = '#831843';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Brillitos Store 📱 04249006350', W / 2, H - 18);

    const url = canvas.toDataURL('image/png');
    setImageUrl(url);
    setGenerating(false);
  };

  const download = () => {
    if (!imageUrl || !data) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `cotizacion-${data.clientName.replace(/\s+/g, '-')}.png`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setImageUrl(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>📤 Cotización para {data?.clientName}</DialogTitle></DialogHeader>
        <canvas ref={canvasRef} className="hidden" />

        {!imageUrl ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Se generará una imagen PNG lista para enviar por WhatsApp.</p>
            <Button onClick={generate} disabled={generating} className="w-full">
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generar Cotización
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <img src={imageUrl} alt="Cotización" className="w-full rounded-lg border border-border" />
            <Button onClick={download} className="w-full gap-2">
              <Download className="h-4 w-4" /> Descargar PNG
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
