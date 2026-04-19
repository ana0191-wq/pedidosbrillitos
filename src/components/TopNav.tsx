import { Search, Plus, LogOut, ShoppingBag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TopNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onAddOrder: () => void;
  onSignOut: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onQuickAddClientOrder?: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'por-cobrar', label: '💰 Por Cobrar' },
  { id: 'clients', label: 'Clientes' },
  { id: 'personal', label: 'Pedidos' },
  { id: 'inventory', label: 'Género' },
  { id: 'team', label: 'Equipo' },
];

export function TopNav({ activeTab, onNavigate, onAddOrder, onSignOut, searchQuery, onSearchChange, onQuickAddClientOrder }: TopNavProps) {
  return (
    <header className="sticky top-0 z-50 px-4 pt-3 pb-2">
      <div className="card-brillitos max-w-[1400px] mx-auto flex items-center justify-between gap-4 px-5 py-2.5">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xl font-extrabold text-primary tracking-tight">✨ Brillitos Store</span>
        </div>

        {/* Pill Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-secondary rounded-full p-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/60" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar..."
              className="h-8 w-40 pl-8 rounded-full bg-secondary border-0 text-xs placeholder:text-primary/40 focus-visible:ring-primary/30"
            />
          </div>
          <Button
            size="sm"
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 gap-1 text-xs h-8 px-4"
            onClick={onAddOrder}
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo pedido
          </Button>
          {onQuickAddClientOrder && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-1 text-xs h-8 px-3 border-primary text-primary hover:bg-primary/10"
              onClick={onQuickAddClientOrder}
            >
              <ShoppingBag className="h-3.5 w-3.5" /> Pedido cliente
            </Button>
          )}
          <button
            onClick={onSignOut}
            className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden mt-2 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-1 bg-secondary rounded-full p-1 overflow-x-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === item.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
