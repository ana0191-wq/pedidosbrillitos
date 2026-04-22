import { useOrders } from '@/hooks/useOrders';
import { MercanciaSection } from '@/components/MercanciaSection';

export default function MercanciaPage() {
  const { orders, addOrder, updateOrder, deleteOrder, getByCategory } = useOrders();

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Mercancía</h1>
        <p className="text-sm text-gray-500 mt-0.5">Productos para reventa</p>
      </div>
      <MercanciaSection
        orders={getByCategory('merchandise')}
        onAdd={addOrder}
        onUpdate={updateOrder}
        onDelete={deleteOrder}
      />
    </div>
  );
}