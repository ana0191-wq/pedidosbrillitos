import { useState } from 'react';
import { Plus, Package } from 'lucide-react';
import { useClientOrders } from '@/hooks/useClientOrders';
import { useClients } from '@/hooks/useClients';
import { useOrders } from '@/hooks/useOrders';
import { useShippingSettings } from '@/hooks/useShippingSettings';
import { useCollaborators } from '@/hooks/useCollaborators';
import { ClientOrdersList } from '@/components/ClientOrdersList';
import { AddClientOrderDialog } from '@/components/AddClientOrderDialog';
import { EditClientOrderDialog } from '@/components/EditClientOrderDialog';
import type { ClientOrder as ClientOrderRow } from '@/hooks/useClientOrders';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export default function PedidosPage() {
  const { clientOrders, loading, addClientOrder, updateClientOrder, deleteClientOrder, archiveClientOrder } = useClientOrders();
  const { clients, addClient } = useClients();
  const { addOrder, updateOrder } = useOrders();
  const { settings: shippingSettings } = useShippingSettings();
  const { collaborators, upsertEarning } = useCollaborators();
  const [addOpen, setAddOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ClientOrderRow | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  useEffect(() => {
    supabase.functions.invoke('exchange-rate').then(({ data }) => {
      if (data?.success) setExchangeRate(data.rate);
    });
  }, []);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clientOrders?.length ?? 0} pedidos en total</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 bg-coral text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo pedido
        </button>
      </div>

      <ClientOrdersList
        clientOrders={clientOrders}
        clients={clients}
        onAddClient={async (name, phone) => addClient(name, phone || '')}
        onAddOrder={addClientOrder}
        onAddProduct={async (order, coId) => { await addOrder(order, coId); }}
        onUpdateOrder={updateClientOrder}
        onDeleteOrder={deleteClientOrder}
        onArchiveOrder={archiveClientOrder}
        exchangeRate={exchangeRate}
        shippingSettings={shippingSettings}
        collaborators={collaborators}
        onUpsertEarning={upsertEarning}
        onToggleDelivered={async (productId, delivered) => { await updateOrder(productId, { delivered } as any); }}
      />

      <AddClientOrderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clients={clients}
        onAddClient={async (name, phone) => addClient(name, phone || '')}
        onAddOrder={addClientOrder}
        onAddProduct={async (order, coId) => { await addOrder(order, coId); }}
        exchangeRate={exchangeRate}
        shippingSettings={shippingSettings}
      />

      <EditClientOrderDialog
        open={!!editingOrder}
        onOpenChange={v => { if (!v) setEditingOrder(null); }}
        order={editingOrder}
        onUpdateOrder={updateClientOrder}
        onDeleteOrder={deleteClientOrder}
        exchangeRate={exchangeRate}
        shippingSettings={shippingSettings}
        collaborators={collaborators}
        onUpsertEarning={upsertEarning}
      />
    </div>
  );
}