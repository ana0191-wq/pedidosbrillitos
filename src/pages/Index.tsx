import { useState } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import type { OrderCategory } from '@/types/orders';
import { Dashboard } from '@/components/Dashboard';
import { OrderSection } from '@/components/OrderSection';
import { AddOrderDialog } from '@/components/AddOrderDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingBag, Package, Users, LayoutDashboard, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { orders, loading, addOrder, updateOrder, deleteOrder, getByCategory, getCounts } = useOrders();
  const { signOut } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCategory, setDialogCategory] = useState<OrderCategory>('personal');

  const counts = getCounts();

  const openDialog = (cat: OrderCategory = 'personal') => {
    setDialogCategory(cat);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">📦 Mis Pedidos Online</h1>
            <p className="text-xs text-muted-foreground">AliExpress · Shein · Temu</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-1" /> Salir
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-4 pb-24">
        <Tabs defaultValue="dashboard">
          <TabsList className="w-full grid grid-cols-4 mb-6">
            <TabsTrigger value="dashboard" className="gap-1 text-xs sm:text-sm">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Inicio</span>
            </TabsTrigger>
            <TabsTrigger value="personal" className="gap-1 text-xs sm:text-sm">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Mis Pedidos</span>
              {counts.personal > 0 && <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">{counts.personal}</span>}
            </TabsTrigger>
            <TabsTrigger value="merchandise" className="gap-1 text-xs sm:text-sm">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Mercancía</span>
              {counts.merchandise > 0 && <span className="ml-1 text-xs bg-secondary text-secondary-foreground rounded-full px-1.5">{counts.merchandise}</span>}
            </TabsTrigger>
            <TabsTrigger value="client" className="gap-1 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clientes</span>
              {counts.client > 0 && <span className="ml-1 text-xs bg-accent text-accent-foreground rounded-full px-1.5">{counts.client}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard counts={counts} orders={orders} onAddOrder={() => openDialog()} />
          </TabsContent>

          <TabsContent value="personal">
            <OrderSection
              title="Mis Pedidos"
              emoji="🛍️"
              category="personal"
              orders={getByCategory('personal')}
              statusOptions={['Pedido', 'En Tránsito', 'Entregado']}
              onUpdate={updateOrder}
              onDelete={deleteOrder}
              onAdd={() => openDialog('personal')}
            />
          </TabsContent>

          <TabsContent value="merchandise">
            <OrderSection
              title="Mercancía"
              emoji="📦"
              category="merchandise"
              orders={getByCategory('merchandise')}
              statusOptions={['Pedido', 'En Tránsito', 'Parcialmente Recibido', 'Completo']}
              onUpdate={updateOrder}
              onDelete={deleteOrder}
              onAdd={() => openDialog('merchandise')}
            />
          </TabsContent>

          <TabsContent value="client">
            <OrderSection
              title="Pedidos de Clientes"
              emoji="👤"
              category="client"
              orders={getByCategory('client')}
              statusOptions={['Pedido', 'En Tránsito', 'Entregado', 'Cliente Notificado']}
              onUpdate={updateOrder}
              onDelete={deleteOrder}
              onAdd={() => openDialog('client')}
            />
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
