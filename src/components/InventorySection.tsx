import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, TrendingUp, Package } from 'lucide-react';
import type { Product } from '@/types/orders';

interface InventorySectionProps {
  products: Product[];
  onAdd: (product: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, updates: Partial<Product>) => void;
  onDelete: (id: string) => void;
  exchangeRate: number | null;
}

const STORES = ['Amazon', 'Shein', 'Temu', 'AliExpress', 'Otra'];

export function InventorySection({ products, onAdd, onUpdate, onDelete, exchangeRate }: InventorySectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', store: 'Amazon', costUsd: '', quantity: '1', salePriceUsd: '', notes: '',
  });

  const resetForm = () => {
    setForm({ name: '', store: 'Amazon', costUsd: '', quantity: '1', salePriceUsd: '', notes: '' });
    setEditingId(null);
  };

  const openAdd = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (p: Product) => {
    setForm({
      name: p.name, store: p.store || 'Amazon', costUsd: String(p.costUsd),
      quantity: String(p.stock), salePriceUsd: String(p.salePriceUsd), notes: p.description,
    });
    setEditingId(p.id);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const cost = parseFloat(form.costUsd) || 0;
    const qty = parseInt(form.quantity) || 1;
    const sale = parseFloat(form.salePriceUsd) || 0;
    const vesPrice = exchangeRate ? sale * exchangeRate : 0;

    const data = {
      name: form.name, description: form.notes, costUsd: cost,
      salePriceUsd: sale, salePriceVes: vesPrice, isSet: false,
      setQuantity: 1, stock: qty, store: form.store, images: [], isPublished: false,
    };

    if (editingId) {
      onUpdate(editingId, data);
    } else {
      onAdd(data);
    }
    setDialogOpen(false);
    resetForm();
  };

  const fmt = (n: number) => n > 0 ? `$${n.toFixed(2)}` : '—';

  const cost = parseFloat(form.costUsd) || 0;
  const sale = parseFloat(form.salePriceUsd) || 0;
  const qty = parseInt(form.quantity) || 1;
  const profitPerUnit = sale - cost;
  const totalProfit = profitPerUnit * qty;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">📦 Género / Inventario</h2>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
          <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No hay productos en inventario</p>
          <Button variant="link" onClick={openAdd} className="mt-2">Agregar primer producto</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => {
            const ppu = p.salePriceUsd - p.costUsd;
            const tp = ppu * p.stock;
            return (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm truncate">{p.name}</h3>
                      <p className="text-xs text-muted-foreground">{p.store} · {p.stock} unidades</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Costo</span>
                      <p className="font-semibold">{fmt(p.costUsd)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Venta</span>
                      <p className="font-bold text-primary">{fmt(p.salePriceUsd)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ganancia/u</span>
                      <p className={`font-bold ${ppu > 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(ppu)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ganancia total</span>
                      <p className={`font-bold ${tp > 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(tp)}</p>
                    </div>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground mt-1">📝 {p.description}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Producto' : 'Agregar a Inventario'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del producto" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Tienda</Label>
              <Select value={form.store} onValueChange={v => setForm(f => ({ ...f, store: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Costo unitario $</Label>
                <Input type="number" step="0.01" value={form.costUsd} onChange={e => setForm(f => ({ ...f, costUsd: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Cantidad</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Precio venta $</Label>
                <Input type="number" step="0.01" value={form.salePriceUsd} onChange={e => setForm(f => ({ ...f, salePriceUsd: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-sm" placeholder="Notas opcionales..." />
            </div>

            {/* Profit preview */}
            {(cost > 0 || sale > 0) && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                  <TrendingUp className="h-4 w-4 text-green-600" /> Proyección
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Ganancia por pieza:</span>
                    <p className={`font-bold ${profitPerUnit > 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(profitPerUnit)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ganancia total ({qty}u):</span>
                    <p className={`font-bold ${totalProfit > 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(totalProfit)}</p>
                  </div>
                </div>
                {exchangeRate && sale > 0 && (
                  <p className="text-xs text-muted-foreground">≈ {(totalProfit * exchangeRate).toFixed(0)} Bs ganancia total</p>
                )}
              </div>
            )}

            <Button onClick={handleSubmit} className="w-full">{editingId ? 'Guardar Cambios' : 'Agregar al Inventario'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
