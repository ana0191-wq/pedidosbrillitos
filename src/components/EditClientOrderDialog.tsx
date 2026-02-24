import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Package, CheckCircle2, Circle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { ClientOrder, ClientOrderProduct } from '@/hooks/useClientOrders';
import { useOrders } from '@/hooks/useOrders';

const ORDER_STATUSES = ['Pagado sin comprar', 'Comprado', 'En Tránsito', 'Recibido'];
const PAYMENT_METHODS = ['Bolívares (tasa euro)', 'PayPal', 'Binance', 'Efectivo'];
const STORES = ['AliExpress', 'Shein', 'Temu', 'Amazon'];
const PRODUCT_STATUSES = ['Pedido', 'En Tránsito', 'Entregado'];

interface EditClientOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ClientOrder | null;
  onUpdateOrder: (id: string, updates: Record<string, any>) => void;
  onDeleteOrder: (id: string) => void;
  exchangeRate: number | null;
}

export function EditClientOrderDialog({ open, onOpenChange, order, onUpdateOrder, onDeleteOrder, exchangeRate }: EditClientOrderDialogProps) {
  const { updateOrder: updateProduct, deleteOrder: deleteProduct } = useOrders();
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [payRef, setPayRef] = useState('');
  const [shipping, setShipping] = useState('');
  const [charged, setCharged] = useState('');
  const [shippingType, setShippingType] = useState('');
  const [weightLb, setWeightLb] = useState('');
  const [volumeFt3, setVolumeFt3] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState<ClientOrderProduct[]>([]);

  useEffect(() => {
    if (order && open) {
      setStatus(order.status);
      setPayment(order.paymentMethod);
      setPayRef(order.paymentReference);
      setShipping(String(order.shippingCost || ''));
      setCharged(String(order.amountCharged || ''));
      setShippingType(order.shippingType);
      setWeightLb(String(order.shippingWeightLb || ''));
      setVolumeFt3(String(order.shippingVolumeFt3 || ''));
      setDimensions(order.shippingDimensions);
      setNotes(order.notes);
      setProducts([...order.products]);
    }
  }, [order, open]);

  if (!order) return null;

  const handleSave = () => {
    onUpdateOrder(order.id, {
      status,
      paymentMethod: payment,
      paymentReference: payRef,
      shippingCost: parseFloat(shipping) || 0,
      amountCharged: parseFloat(charged) || 0,
      shippingType,
      shippingWeightLb: parseFloat(weightLb) || 0,
      shippingVolumeFt3: parseFloat(volumeFt3) || 0,
      shippingDimensions: dimensions,
      notes,
    });

    // Update each product
    for (const p of products) {
      const orig = order.products.find(op => op.id === p.id);
      if (!orig) continue;
      const updates: Record<string, any> = {};
      if (p.productName !== orig.productName) updates.productName = p.productName;
      if (p.store !== orig.store) updates.store = p.store;
      if (p.pricePaid !== orig.pricePaid) updates.pricePaid = p.pricePaid;
      if (p.orderNumber !== orig.orderNumber) updates.orderNumber = p.orderNumber;
      if (p.status !== orig.status) updates.status = p.status;
      if (p.arrived !== orig.arrived) updates.arrived = p.arrived;
      if (Object.keys(updates).length > 0) {
        updateProduct(p.id, updates);
      }
    }

    onOpenChange(false);
  };

  const handleDeleteProduct = (productId: string) => {
    deleteProduct(productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const updateLocalProduct = (id: string, field: keyof ClientOrderProduct, value: any) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const totalProductCost = products.reduce((s, p) => s + p.pricePaid, 0);
  const profit = (parseFloat(charged) || 0) - totalProductCost - (parseFloat(shipping) || 0);
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pedido — {order.clientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Método de pago</Label>
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div><Label>Referencia de pago</Label><Input value={payRef} onChange={e => setPayRef(e.target.value)} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Costo envío ($)</Label><Input type="number" step="0.01" value={shipping} onChange={e => setShipping(e.target.value)} /></div>
            <div><Label>Cobrado ($)</Label><Input type="number" step="0.01" value={charged} onChange={e => setCharged(e.target.value)} /></div>
          </div>

          <div>
            <Label>Tipo de envío</Label>
            <Select value={shippingType} onValueChange={setShippingType}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aereo">Aéreo</SelectItem>
                <SelectItem value="maritimo">Marítimo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Peso (lb)</Label><Input type="number" step="0.01" value={weightLb} onChange={e => setWeightLb(e.target.value)} /></div>
            <div><Label>Volumen (ft³)</Label><Input type="number" step="0.01" value={volumeFt3} onChange={e => setVolumeFt3(e.target.value)} /></div>
          </div>
          <div><Label>Dimensiones</Label><Input value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder="ej: 30x20x10 cm" /></div>

          <div><Label>Notas</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>

          {/* Products */}
          <div className="border-t border-border pt-3 space-y-2">
            <Label>Productos ({products.length})</Label>
            {products.map(p => (
              <div key={p.id} className="p-2 rounded-md bg-muted/30 border border-border/50 space-y-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={!!p.arrived}
                    onCheckedChange={(checked) => updateLocalProduct(p.id, 'arrived', !!checked)}
                    className="flex-shrink-0"
                  />
                  <div className="h-16 w-16 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                    {p.productPhoto ? <img src={p.productPhoto} alt="" className="h-full w-full object-cover" /> : <Package className="h-6 w-6 m-5 text-muted-foreground" />}
                  </div>
                  <Input value={p.productName} onChange={e => updateLocalProduct(p.id, 'productName', e.target.value)} className={`h-7 text-xs flex-1 ${p.arrived ? 'line-through opacity-60' : ''}`} />
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(p.id)} className="h-7 w-7 p-0 text-destructive flex-shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Select value={p.store} onValueChange={v => updateLocalProduct(p.id, 'store', v)}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" step="0.01" value={p.pricePaid} onChange={e => updateLocalProduct(p.id, 'pricePaid', parseFloat(e.target.value) || 0)} className="h-7 text-xs w-20" placeholder="$" />
                  <Select value={p.status} onValueChange={v => updateLocalProduct(p.id, 'status', v)}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input value={p.orderNumber} onChange={e => updateLocalProduct(p.id, 'orderNumber', e.target.value)} className="h-7 text-xs" placeholder="N° de orden" />
              </div>
            ))}
          </div>

          {/* Financial summary */}
          <div className="border-t border-border pt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Costo productos:</span><span>{fmt(totalProductCost)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Envío:</span><span>{fmt(parseFloat(shipping) || 0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cobrado:</span><span>{fmt(parseFloat(charged) || 0)}</span></div>
            <div className="flex justify-between font-semibold">
              <span>Ganancia:</span>
              <span className={profit >= 0 ? 'text-green-600' : 'text-destructive'}>{fmt(profit)}</span>
            </div>
            {exchangeRate && parseFloat(charged) > 0 && (
              <p className="text-xs text-muted-foreground">💱 ≈ {((parseFloat(charged) || 0) * exchangeRate).toFixed(2)} Bs</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">Guardar Cambios</Button>
            <Button variant="destructive" onClick={() => { onDeleteOrder(order.id); onOpenChange(false); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
