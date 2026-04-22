import { useClientOrders } from '@/hooks/useClientOrders';
import { PorCobrarSection } from '@/components/PorCobrarSection';

export default function PorCobrarPage() {
  const { clientOrders, updateClientOrder } = useClientOrders();

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Por Cobrar</h1>
        <p className="text-sm text-gray-500 mt-0.5">Pagos pendientes de clientes</p>
      </div>
      <PorCobrarSection
        clientOrders={clientOrders}
        onUpdateOrder={updateClientOrder}
      />
    </div>
  );
}