import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Trash2, Eye, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Order, ClientOrder } from '@/types/orders';

interface InvoiceSectionProps {
  order: Order;
  onUpdate: (id: string, updates: Partial<Order>) => void;
}

export function InvoiceSection({ order, onUpdate }: InvoiceSectionProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const invoiceAmount = order.companyInvoiceAmount ?? null;
  const invoiceNotes = order.companyInvoiceNotes ?? '';
  const files = order.invoiceFiles ?? [];

  const isClient = order.category === 'client';
  const clientOrder = isClient ? (order as ClientOrder) : null;

  // Calculate real profit: shipping_charge_client - company_invoice_amount
  const clientPays = clientOrder?.amountCharged ?? 0;
  const realProfit = invoiceAmount != null ? clientPays - invoiceAmount : null;

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${order.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(path);

      const newFile = {
        name: file.name,
        url: urlData.publicUrl,
        uploadedAt: new Date().toISOString(),
      };

      const updatedFiles = [...files, newFile];
      onUpdate(order.id, { invoiceFiles: updatedFiles } as any);
      toast({ title: '✅ Archivo subido' });
    } catch (err: any) {
      toast({ title: 'Error al subir', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    onUpdate(order.id, { invoiceFiles: updatedFiles } as any);
  };

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
        <FileText className="h-4 w-4" /> 📄 Factura Total Envíos
      </h4>

      <div className="space-y-2">
        <div>
          <label className="text-xs text-muted-foreground font-medium">Lo que cobró la empresa</label>
          <Input
            type="number"
            step="0.01"
            placeholder="Ej: 93.00"
            defaultValue={invoiceAmount ?? ''}
            onBlur={(e) => {
              const val = e.target.value ? parseFloat(e.target.value) : null;
              onUpdate(order.id, { companyInvoiceAmount: val } as any);
            }}
            className="h-8 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium">Notas</label>
          <Textarea
            placeholder='Ej: "Laptop $93 + zapatos $22 + vestido $8"'
            defaultValue={invoiceNotes}
            onBlur={(e) => onUpdate(order.id, { companyInvoiceNotes: e.target.value } as any)}
            className="text-xs min-h-[50px]"
          />
        </div>

        {/* Profit recalculation */}
        {isClient && invoiceAmount != null && (
          <div className="rounded-md bg-muted/40 border border-border p-2.5 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente paga:</span>
              <span className="font-semibold">{fmt(clientPays)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Empresa cobró (real):</span>
              <span className="font-semibold text-amber-600">-{fmt(invoiceAmount)}</span>
            </div>
            <div className="border-t border-dashed border-border my-1" />
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Tu ganancia real:</span>
              <span className={`font-bold text-base ${(realProfit ?? 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {fmt(realProfit ?? 0)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* File upload */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium">📎 Subir factura</label>
        <div
          className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Subiendo...
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              <Upload className="h-5 w-5 mx-auto mb-1 opacity-50" />
              Arrastra o haz clic para subir PDF o imagen
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = '';
          }}
        />

        {/* Uploaded files list */}
        {files.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Archivos subidos:</p>
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1.5 text-xs">
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  <FileText className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  <span className="truncate">{f.name}</span>
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[10px]"
                    onClick={() => window.open(f.url, '_blank')}
                  >
                    <Eye className="h-3 w-3 mr-0.5" /> Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[10px] text-destructive"
                    onClick={() => handleDeleteFile(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
