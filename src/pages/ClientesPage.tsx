import { useEffect, useState } from 'react';
import { useClients } from '@/hooks/useClients';
import { useClientOrders } from '@/hooks/useClientOrders';
import { useOrders } from '@/hooks/useOrders';
import { useShippingSettings } from '@/hooks/useShippingSettings';
import { useCollaborators } from '@/hooks/useCollaborators';
import { ClientsSection } from '@/components/ClientsSection';
import { supabase } from '@/integrations/supabase/client';

export default function ClientesPage() {
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { clientOrders, addClientOrder, updateClientOrder, deleteClientOrder, archiveClientOrder, getByClient } = useClientOrders();
  const { addOrder } = useOrders();
  const { settings: shippingSettings } = useShippingSettings();
  const { collaborators, upsertEarning } = useCollaborators();
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  useEffect(() => {
    supabase.functions.invoke('exchange-rate').then(({ data }) => {
      if (data?.success) setExchangeRate(data.rate);
    });
  }, []);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-sm text-gray-500 mt-0.5">{clients?.filter(c => !c.deleted_at).length ?? 0} clientes</p>
      </div>
      <ClientsSection
        clients={clients}
        clientOrders={clientOrders}
        onAddClient={addClient}
        onUpdateClient={updateClient}
        onDeleteClient={deleteClient}
        onAddOrder={addClientOrder}
        onAddProduct={async (order, coId) => { await addOrder(order, coId); }}
        onUpdateOrder={updateClientOrder}
        onDeleteOrder={deleteClientOrder}
        onArchiveOrder={archiveClientOrder}
        getOrdersByClient={getByClient}
        exchangeRate={exchangeRate}
        shippingSettings={shippingSettings}
        collaborators={collaborators}
        onUpsertEarning={upsertEarning}
      />
    </div>
  );
}