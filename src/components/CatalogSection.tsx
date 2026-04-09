import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Package, Eye, EyeOff, Pencil } from 'lucide-react';
import type { Product } from '@/types/orders';

interface CatalogSectionProps {
  products: Product[];
  onAdd: (product: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, updates: Partial<Product>) => void;
  onDelete: (id: string) => void;
  exchangeRate: number | null;
}

export function CatalogSection({ products, onAdd, onUpdate, onDelete, exchangeRate }: CatalogSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', costUsd: '', salePriceUsd: '', salePriceVes: '',
    isSet: false, setQuantity: '1', stock: '0', store: '', isPublished: false,
  });

  const resetForm = () => {
    setForm({ name: '', description: '', costUsd: '', salePriceUsd: '', salePriceVes: '', isSet: false, setQuantity: '1', stock: '0', store: '', isPublished: false });
    setEditingId(null);
  };

  const openAdd = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (p: Product) => {
    setForm({
      name: p.name, description: p.description, costUsd: String(p.costUsd), salePriceUsd: String(p.salePriceUsd),
      salePriceVes: String(p.salePriceVes), isSet: p.isSet, setQuantity: String(p.setQuantity),
      stock: String(p.stock), store: p.store, isPublished: p.isPublished,
    });
    setEditingId(p.id);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name, description: form.description,
      costUsd: parseFloat(form.costUsd) || 0, salePriceUsd: parseFloat(form.salePriceUsd) || 0,
      salePriceVes: parseFloat(form.salePriceVes) || 0, isSet: form.isSet,
      setQuantity: parseInt(form.setQuantity) || 1, stock: parseInt(form.stock) || 0,
      store: form.store, images: [], isPublished: form.isPublished,
    };
    if (editingId) {
      onUpdate(editingId, data);
    } else {
      onAdd(data);
    }
    setDialogOpen(false);
    resetForm();
  };

  // Auto-calc VES when USD changes
  const handlePriceUsdChange = (val: string) => {
    setForm(f => ({
      ...f, salePriceUsd: val,
      salePriceVes: exchangeRate ? String((parseFloat(val) || 0) * exchangeRate) : f.salePriceVes,
    }));
  };

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">🏪 Catálogo</h2>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Agregar Producto</Button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">No hay productos en el catálogo</p>
          <Button variant="link" onClick={openAdd} className="mt-2">Agregar primer producto</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map(p => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{p.name}</h3>
                    {p.isSet && <span className="text-xs text-primary">Set de {p.setQuantity}</span>}
                    {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {p.isPublished ? <Eye className="h-3.5 w-3.5 text-green-600" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Costo</span>
                    <p className="font-semibold">{fmt(p.costUsd)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Venta USD</span>
                    <p className="font-bold text-primary">{fmt(p.salePriceUsd)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Venta Bs</span>
                    <p className="font-bold text-primary">Bs {p.salePriceVes.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Stock: <span className="font-semibold text-foreground">{p.stock}</span></span>
                  <div className="flex gap-1">
                    <Switch
                      checked={p.isPublished}
                      onCheckedChange={(v) => onUpdate(p.id, { isPublished: v })}
                      className="scale-75"
                    />
                    <span className="text-xs text-muted-foreground">{p.isPublished ? 'Publicado' : 'Oculto'}</span>
                  </div>
                </div>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(p)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive ml-auto" onClick={() => onDelete(p.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Producto' : 'Agregar Producto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del producto" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Costo USD</Label>
                <Input type="number" step="0.01" value={form.costUsd} onChange={e => setForm(f => ({ ...f, costUsd: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Venta USD</Label>
                <Input type="number" step="0.01" value={form.salePriceUsd} onChange={e => handlePriceUsdChange(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Venta Bs</Label>
                <Input type="number" step="0.01" value={form.salePriceVes} onChange={e => setForm(f => ({ ...f, salePriceVes: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Stock</Label>
                <Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Tienda</Label>
                <Input value={form.store} onChange={e => setForm(f => ({ ...f, store: e.target.value }))} className="h-8 text-sm" placeholder="AliExpress..." />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex items-center gap-1">
                  <Switch checked={form.isSet} onCheckedChange={v => setForm(f => ({ ...f, isSet: v }))} className="scale-75" />
                  <span className="text-xs">Set</span>
                </div>
                {form.isSet && (
                  <Input type="number" min="2" value={form.setQuantity} onChange={e => setForm(f => ({ ...f, setQuantity: e.target.value }))} className="h-8 text-sm w-14" placeholder="Qty" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isPublished} onCheckedChange={v => setForm(f => ({ ...f, isPublished: v }))} />
              <Label className="text-sm">Publicar en web</Label>
            </div>
            <Button onClick={handleSubmit} className="w-full">{editingId ? 'Guardar Cambios' : 'Agregar al Catálogo'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
