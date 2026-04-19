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
import { ComprasPersonalesSection } from '@/components/ComprasPersonalesSection';
import { InventorySection } from '@/components/InventorySection';
import { PorCobrarSection } from '@/components/PorCobrarSection';
import { QuickCalculator } from '@/components/QuickCalculator';
import { BrillitosCotizador } from '@/components/BrillitosCotizador';
import { EditClientOrderDialog } from '@/components/EditClientOrderDialog';
import { AddClientOrderDialog } from '@/components/AddClientOrderDialog';
import type { ClientOrder as ClientOrderRow } from '@/hooks/useClientOrders';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';

const NON_DASHBOARD_TABS = ['por-cobrar', 'personal', 'merchandise', 'clients', 'client-orders', 'inventory', 'catalog', 'team', 'shipping', 'calculator'];

const Index = () => {
  const { orders, loading, addOrder, updateOrder, deleteOrder, archiveOrder, getByCategory, getCounts } = useOrders();
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { clientOrders, addClientOrder, updateClientOrder, deleteClientOrder, archiveClientOrder, getByClient } = useClientOrders();
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
  const [editingClientOrder, setEditingClientOrder] = useState<ClientOrderRow | null>(null);
  const [quickAddClientOrderOpen, setQuickAddClientOrderOpen] = useState(false);
  const [calcTab, setCalcTab] = useState<'cotizar' | 'distribuir'>('cotizar');

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

  const isSubPage = NON_DASHBOARD_TABS.includes(activeTab);

  // Back button bar shown on all sub-pages
  const BackBar = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 mb-4">
      <Button
        variant="outline"
        size="sm"
        className="rounded-full gap-1.5 text-xs h-8 px-3"
        onClick={() => setActiveTab('dashboard')}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Regresar
      </Button>
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <Dashboard
              orders={orders}
              clients={clients}
              clientOrders={clientOrders}
              collaborators={collaborators}
              earnings={earnings}
              onNavigate={setActiveTab}
              onMarkPaid={markPaid}
              onOrderClick={(order, parentCO) => {
                if (parentCO) {
                  setEditingClientOrder(parentCO);
                } else {
                  setActiveTab(order.category === 'merchandise' ? 'merchandise' : 'personal');
                }
              }}
            />

          </div>
        );
      case 'por-cobrar':
        return (
          <>
            <BackBar label="💰 Por Cobrar" />
            <PorCobrarSection
              clientOrders={clientOrders}
              onUpdateOrder={updateClientOrder}
            />
          </>
        );
      case 'personal':
        return (
          <>
            <BackBar label="🛍️ Compras Personales" />
            <ComprasPersonalesSection
              orders={getByCategory('personal')}
              onAdd={async (data) => {
                const order: any = {
                  id: Math.random().toString(36).substring(2),
                  category: 'personal',
                  productName: data.productName,
                  productPhoto: '',
                  store: (data as any).store || 'Shein',
                  pricePaid: (data as any).pricePaid || 0,
                  orderDate: '',
                  estimatedArrival: '',
                  orderNumber: (data as any).orderNumber || '',
                  notes: (data as any).notes || '',
                  status: 'Pendiente',
                  createdAt: new Date().toISOString(),
                };
                await addOrder(order);
              }}
              onUpdate={updateOrder}
              onDelete={deleteOrder}
            />
          </>
        );
      case 'merchandise':
        return (
          <>
            <BackBar label="📦 Mercancía" />
            <div className="space-y-6">
              <OrderSection
                title="Mercancía"
                emoji="📦"
                category="merchandise"
                orders={getByCategory('merchandise')}
                statusOptions={['Pendiente', 'En Tránsito', 'Llegó', 'No Llegó', 'En Venezuela', 'Entregado']}
                onUpdate={updateOrder}
                onDelete={deleteOrder}
                onArchive={archiveOrder}
                onAdd={() => openDialog('merchandise')}
                getCollabInfo={getCollabInfo}
              />
              <AIPricingCalculator exchangeRate={exchangeRate} />
            </div>
          </>
        );
      case 'clients':
        return (
          <>
            <BackBar label="👥 Clientes" />
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
            />
          </>
        );
      case 'client-orders':
        return (
          <>
            <BackBar label="📋 Pedidos de Clientes" />
            <ClientOrdersList
              clientOrders={clientOrders}
              clients={clients}
              onAddOrder={addClientOrder}
              onAddProduct={async (order, coId) => { await addOrder(order, coId); }}
              onUpdateOrder={updateClientOrder}
              onDeleteOrder={deleteClientOrder}
              onArchiveOrder={archiveClientOrder}
              exchangeRate={exchangeRate}
              shippingSettings={shippingSettings}
            />
          </>
        );
      case 'inventory':
        return (
          <>
            <BackBar label="🗂️ Género / Inventario" />
            <InventorySection
              products={products}
              onAdd={addProduct}
              onUpdate={updateProduct}
              onDelete={deleteProduct}
              exchangeRate={exchangeRate}
            />
          </>
        );
      case 'catalog':
        return (
          <>
            <BackBar label="📖 Catálogo" />
            <CatalogSection
              products={products}
              onAdd={addProduct}
              onUpdate={updateProduct}
              onDelete={deleteProduct}
              exchangeRate={exchangeRate}
            />
          </>
        );
      case 'team':
        return (
          <>
            <BackBar label="👫 Equipo" />
            <TeamSection
              collaborators={collaborators}
              earnings={earnings}
              clientOrders={clientOrders}
              onMarkPaid={markPaid}
              getEarningsByCollaborator={getEarningsByCollaborator}
            />
          </>
        );
      case 'calculator':
        return (
          <>
            <BackBar label="🧮 Calculadora" />
            <div className="max-w-md space-y-4">
              <div className="flex gap-2 border-b border-border pb-3">
                <button
                  onClick={() => setCalcTab('cotizar')}
                  className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${
                    calcTab === 'cotizar' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  💰 Cotizar producto
                </button>
                <button
                  onClick={() => setCalcTab('distribuir')}
                  className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${
                    calcTab === 'distribuir' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🧳 Distribuir factura
                </button>
              </div>
              {calcTab === 'cotizar' && <BrillitosCotizador exchangeRate={exchangeRate} />}
              {calcTab === 'distribuir' && <QuickCalculator shippingSettings={shippingSettings} exchangeRate={exchangeRate} clientOrders={clientOrders} distributeOnly />}
            </div>
          </>
        );
      case 'shipping':
        return (
          <>
            <BackBar label="✈️ Calculadora de Envío" />
            <ShippingCalculator settings={shippingSettings} onSaveSettings={saveSettings} />
          </>
        );
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
        onQuickAddClientOrder={() => setQuickAddClientOrderOpen(true)}
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

      {/* Quick add client order from any page */}
      {clients.length > 0 && (
        <AddClientOrderDialog
          open={quickAddClientOrderOpen}
          onOpenChange={setQuickAddClientOrderOpen}
          clients={clients}
          onAddOrder={addClientOrder}
          onAddProduct={async (order, coId) => { await addOrder(order, coId); }}
          exchangeRate={exchangeRate}
          shippingSettings={shippingSettings}
        />
      )}

      <EditClientOrderDialog
        open={!!editingClientOrder}
        onOpenChange={(v) => { if (!v) setEditingClientOrder(null); }}
        order={editingClientOrder}
        onUpdateOrder={updateClientOrder}
        onDeleteOrder={deleteClientOrder}
        exchangeRate={exchangeRate}
        shippingSettings={shippingSettings}
        collaborators={collaborators}
        onUpsertEarning={upsertEarning}
      />
    </div>
  );
};

export default Index;
