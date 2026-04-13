import { useState, useEffect } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useClients } from '@/hooks/useClients';
import { useClientOrders } from '@/hooks/useClientOrders';
import { useShippingSettings } from '@/hooks/useShippingSettings';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { useCollaborators } from '@/hooks/useCollaborators';
import type { OrderCategory } from '@/types/orders';
import { Dashboard } from '@/components/Dashboard';
import { AddClientOrderDialog } from '@/components/AddClientOrderDialog';
import { OrderSection } from '@/components/OrderSection';
import { AddOrderDialog } from '@/components/AddOrderDialog';
import { ClientsSection } from '@/components/ClientsSection';
import { ClientOrdersList } from '@/components/ClientOrdersList';
import { ShippingCalculator } from '@/components/ShippingCalculator';
import { AIPricingCalculator } from '@/components/AIPricingCalculator';
import { CatalogSection } from '@/components/CatalogSection';
import { TeamSection } from '@/components/TeamSection';
import { InventorySection } from '@/components/InventorySection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingBag, Package, Users, LayoutDashboard, LogOut, Calculator, ClipboardList, Store, Boxes, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  const [manualRate, setManualRate] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  const counts = getCounts();

  // Fetch exchange rate on mount
  useEffect(() => {
    supabase.functions.invoke('exchange-rate').then(({ data }) => {
      if (data?.success) {
        setExchangeRate(data.rate);
        setManualRate(String(data.rate));
      }
    });
  }, []);

  const handleRateChange = (val: string) => {
    setManualRate(val);
    const num = parseFloat(val);
    if (num > 0) setExchangeRate(num);
  };

  const openDialog = (cat: OrderCategory = 'personal') => {
    setDialogCategory(cat);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">✨ Pedidos Brillitos Store</h1>
            <p className="text-xs text-muted-foreground">AliExpress · Shein · Temu · Amazon</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
              <span className="text-xs text-muted-foreground">💱</span>
              <Input
                type="number"
                step="0.01"
                value={manualRate}
                onChange={e => handleRateChange(e.target.value)}
                className="h-6 w-20 text-xs border-0 bg-transparent p-0 text-center font-semibold"
                placeholder="Tasa"
              />
              <span className="text-xs text-muted-foreground">Bs/$</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-4 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-5 sm:grid-cols-9 mb-6">
            <TabsTrigger value="dashboard" className="gap-1 text-xs">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Inicio</span>
            </TabsTrigger>
            <TabsTrigger value="personal" className="gap-1 text-xs">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
              {counts.personal > 0 && <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">{counts.personal}</span>}
            </TabsTrigger>
            <TabsTrigger value="merchandise" className="gap-1 text-xs">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Mercancía</span>
              {counts.merchandise > 0 && <span className="ml-1 text-xs bg-secondary text-secondary-foreground rounded-full px-1.5">{counts.merchandise}</span>}
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-1 text-xs">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="client-orders" className="gap-1 text-xs">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos C.</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-1 text-xs">
              <Boxes className="h-4 w-4" />
              <span className="hidden sm:inline">Género</span>
            </TabsTrigger>
            <TabsTrigger value="catalog" className="gap-1 text-xs">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Catálogo</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1 text-xs">
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Equipo</span>
            </TabsTrigger>
            <TabsTrigger value="shipping" className="gap-1 text-xs">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Envíos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard counts={counts} orders={orders} clients={clients} clientOrders={clientOrders} onAddOrder={() => openDialog()} onAddClientOrder={addClientOrder} onAddProduct={async (order, coId) => { await addOrder(order, coId); }} onImportOrders={async (imported) => { for (const o of imported) await addOrder(o); }} onNavigate={setActiveTab} />
          </TabsContent>

          <TabsContent value="personal">
            <OrderSection
              title="Mis Pedidos"
              emoji="🛍️"
              category="personal"
              orders={getByCategory('personal')}
              statusOptions={['Pendiente', 'En Tránsito', 'Llegó', 'No Llegó', 'En Venezuela', 'Entregado']}
              onUpdate={updateOrder}
              onDelete={deleteOrder}
              onAdd={() => openDialog('personal')}
            />
          </TabsContent>

          <TabsContent value="merchandise">
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
              />
              <AIPricingCalculator exchangeRate={exchangeRate} />
            </div>
          </TabsContent>

          <TabsContent value="clients">
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
          </TabsContent>

          <TabsContent value="client-orders">
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
          </TabsContent>

          <TabsContent value="inventory">
            <InventorySection
              products={products}
              onAdd={addProduct}
              onUpdate={updateProduct}
              onDelete={deleteProduct}
              exchangeRate={exchangeRate}
            />
          </TabsContent>

          <TabsContent value="catalog">
            <CatalogSection
              products={products}
              onAdd={addProduct}
              onUpdate={updateProduct}
              onDelete={deleteProduct}
              exchangeRate={exchangeRate}
            />
          </TabsContent>

          <TabsContent value="team">
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
          </TabsContent>

          <TabsContent value="shipping">
            <ShippingCalculator settings={shippingSettings} onSaveSettings={saveSettings} />
          </TabsContent>
        </Tabs>
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
