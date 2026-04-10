import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Download, MessageCircle } from 'lucide-react';

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
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const truncate = (s: string, max = 60) => s.length > max ? s.slice(0, max) + '...' : s;

  const generate = () => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const W = 800;
    const padding = 40;

    const productLines = data.products.length;
    const H = 480 + productLines * 32;
    canvas.width = W;
    canvas.height = H;

    // Background
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

    // Greeting — use only client name
    ctx.fillStyle = '#374151';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    let y = 90;
    ctx.fillText(`Hola ${data.clientName},`, padding, y);
    y += 24;
    ctx.fillText('aquí está tu cotización tentativa:', padding, y);
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
      ctx.fillText(`📦 ${truncate(p.name)}`, padding, y);
      ctx.textAlign = 'right';
      ctx.fillText(fmt(p.price), W - padding, y);
      ctx.textAlign = 'left';
      y += 32;
    });

    y += 8;

    // Summary rows
    const rows = [
      { label: 'Precio del producto:', value: fmt(productTotal) },
      { label: 'Envío estimado:', value: fmt(data.shippingCharge) },
    ];

    rows.forEach(row => {
      ctx.fillStyle = '#6B7280';
      ctx.font = '15px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.label, padding, y);
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
    ctx.fillText('⚠️ Precio tentativo, puede variar según', padding, y);
    y += 20;
    ctx.fillText('peso y dimensiones reales del paquete.', padding + 20, y);
    y += 36;

    // Footer
    ctx.fillStyle = '#F9A8D4';
    ctx.fillRect(0, H - 44, W, 44);
    ctx.fillStyle = '#831843';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Brillitos Store 📱 04249006350', W / 2, H - 18);

    setImageUrl(canvas.toDataURL('image/png'));
  };

  const download = () => {
    if (!imageUrl || !data) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `cotizacion-${data.clientName.replace(/\s+/g, '-')}.png`;
    a.click();
  };

  const sendWhatsApp = () => {
    if (!data) return;
    const phone = data.clientPhone?.replace(/\D/g, '') || '';
    const msg = encodeURIComponent(`Hola ${data.clientName}, aquí tu cotización de Brillitos Store 👇`);
    const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
  };

  // Auto-generate on open
  const handleOpenChange = (v: boolean) => {
    if (!v) setImageUrl(null);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>📤 Cotización para {data?.clientName}</DialogTitle></DialogHeader>
        <canvas ref={canvasRef} className="hidden" />

        {!imageUrl ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Se generará una imagen PNG lista para enviar por WhatsApp.</p>
            <Button onClick={generate} className="w-full">Generar Cotización</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <img src={imageUrl} alt="Cotización" className="w-full rounded-lg border border-border" />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={download} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Descargar PNG
              </Button>
              <Button onClick={sendWhatsApp} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
