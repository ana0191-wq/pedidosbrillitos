import { useState, useEffect } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useClients } from '@/hooks/useClients';
import { useClientOrders } from '@/hooks/useClientOrders';
import { useShippingSettings } from '@/hooks/useShippingSettings';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { useCollaborators } from '@/hooks/useCollaborators';
import type { Order, OrderCategory } from '@/types/orders';
import { Dashboard } from '@/components/Dashboard';
import { TopNav } from '@/components/TopNav';
import { OrderSection } from '@/components/OrderSection';
import { AddOrderDialog } from '@/components/AddOrderDialog';
import { ClientsSection } from '@/components/ClientsSection';
import { ClientOrdersList } from '@/components/ClientOrdersList';
import { ShippingCalculator } from '@/components/ShippingCalculator';
import { AIPricingCalculator } from '@/components/AIPricingCalculator';
import { CatalogSection } from '@/components/CatalogSection';
import { TeamSection } from '@/components/TeamSection';
import { InventorySection } from '@/components/InventorySection';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { orders, loading, addOrder, updateOrder, deleteOrder, getByCategory, getCounts } = useOrders();
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { clientOrders, addClientOrder, updateClientOrder, deleteClientOrder, getByClient } = useClientOrders();
  const { settings: shippingSettings, saveSettings } = useShippingSettings();
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const { signOut } = useAuth();
  const {
    collaborators, earnings, addCollaborator, updateCollaborator, deleteCollaborator,
    upsertEarning, markPaid, getEarningsByCollaborator, getEarningForOrder,
  } = useCollaborators();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCategory, setDialogCategory] = useState<OrderCategory>('personal');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const counts = getCounts();

  // Collaborator info helper for order cards
  const getCollabInfo = (order: Order) => {
    if (collaborators.length === 0) return null;
    const collab = collaborators[0];
    let profit: number | null = null;
    if (order.category === 'client') {
      const co = order as any;
      const invoiceAmt = order.companyInvoiceAmount;
      if (invoiceAmt == null) return null;
      profit = (co.amountCharged || 0) - invoiceAmt;
    } else if (order.category === 'merchandise') {
      const mo = order as any;
      const suggested = mo.suggestedPrice ?? (order.pricePaid / (mo.unitsOrdered || 1)) * 1.35;
      profit = (suggested - (order.pricePaid / (mo.unitsOrdered || 1))) * (mo.unitsOrdered || 1);
    }
    if (profit === null || profit <= 0) return null;
    const cut = Math.round(profit * collab.percentage / 100 * 100) / 100;
    return { name: collab.name, percentage: collab.percentage, cut };
  };

  // Fetch exchange rate on mount
  useEffect(() => {
    supabase.functions.invoke('exchange-rate').then(({ data }) => {
      if (data?.success) {
        setExchangeRate(data.rate);
      }
    });
  }, []);

  const openDialog = (cat: OrderCategory = 'personal') => {
    setDialogCategory(cat);
    setDialogOpen(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            orders={orders}
            clients={clients}
            clientOrders={clientOrders}
            collaborators={collaborators}
            earnings={earnings}
            onNavigate={setActiveTab}
            onMarkPaid={markPaid}
          />
        );
      case 'personal':
        return (
          <OrderSection
            title="Mis Pedidos"
            emoji="🛍️"
            category="personal"
            orders={getByCategory('personal')}
            statusOptions={['Pendiente', 'En Tránsito', 'Llegó', 'No Llegó', 'En Venezuela', 'Entregado']}
            onUpdate={updateOrder}
            onDelete={deleteOrder}
            onAdd={() => openDialog('personal')}
            getCollabInfo={getCollabInfo}
          />
        );
      case 'merchandise':
        return (
          <div className="space-y-6">
            <OrderSection
              title="Mercancía"
              emoji="📦"
              category="merchandise"
              orders={getByCategory('merchandise')}
              statusOptions={['Pendiente', 'En Tránsito', 'Llegó', 'No Llegó', 'En Venezuela', 'Entregado']}
              onUpdate={updateOrder}
              onDelete={deleteOrder}
              onAdd={() => openDialog('merchandise')}
              getCollabInfo={getCollabInfo}
            />
            <AIPricingCalculator exchangeRate={exchangeRate} />
          </div>
        );
      case 'clients':
        return (
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
            getOrdersByClient={getByClient}
            exchangeRate={exchangeRate}
            shippingSettings={shippingSettings}
          />
        );
      case 'client-orders':
        return (
          <ClientOrdersList
            clientOrders={clientOrders}
            clients={clients}
            onAddOrder={addClientOrder}
            onAddProduct={async (order, coId) => { await addOrder(order, coId); }}
            onUpdateOrder={updateClientOrder}
            onDeleteOrder={deleteClientOrder}
            exchangeRate={exchangeRate}
            shippingSettings={shippingSettings}
          />
        );
      case 'inventory':
        return (
          <InventorySection
            products={products}
            onAdd={addProduct}
            onUpdate={updateProduct}
            onDelete={deleteProduct}
            exchangeRate={exchangeRate}
          />
        );
      case 'catalog':
        return (
          <CatalogSection
            products={products}
            onAdd={addProduct}
            onUpdate={updateProduct}
            onDelete={deleteProduct}
            exchangeRate={exchangeRate}
          />
        );
      case 'team':
        return (
          <TeamSection
            collaborators={collaborators}
            earnings={earnings}
            orders={orders}
            onAdd={addCollaborator}
            onUpdate={updateCollaborator}
            onDelete={deleteCollaborator}
            onMarkPaid={markPaid}
            getEarningsByCollaborator={getEarningsByCollaborator}
          />
        );
      case 'shipping':
        return <ShippingCalculator settings={shippingSettings} onSaveSettings={saveSettings} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onAddOrder={() => openDialog()}
        onSignOut={signOut}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="max-w-[1400px] mx-auto px-4 py-4 pb-24">
        {renderContent()}
      </main>

      <AddOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={addOrder}
        defaultCategory={dialogCategory}
      />
    </div>
  );
};

export default Index;
