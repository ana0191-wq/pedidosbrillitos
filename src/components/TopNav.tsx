import { useState } from 'react';
import { Package, Users, ShoppingBag, BarChart3, Calculator, UserCheck, LogOut, Menu, X, DollarSign, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onAddOrder: () => void;
  onSignOut: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onQuickAddClientOrder: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',  icon: BarChart3 },
  { id: 'client-orders', label: 'Pedidos',    icon: Package },
  { id: 'clients',       label: 'Clientes',   icon: Users },
  { id: 'por-cobrar',    label: 'Por Cobrar', icon: DollarSign },
  { id: 'personal',      label: 'Compras',    icon: ShoppingBag },
  { id: 'merchandise',   label: 'Mercancía',  icon: Package },
  { id: 'team',          label: 'Equipo',     icon: UserCheck },
  { id: 'calculator',    label: 'Calculadora',icon: Calculator },
];

export function TopNav({ activeTab, onNavigate, onAddOrder, onSignOut, searchQuery, onSearchChange, onQuickAddClientOrder }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNav = (tab: string) => {
    onNavigate(tab);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center gap-3 h-14">
          {/* Logo */}
          <button
            className="flex items-center gap-2 flex-shrink-0"
            onClick={() => handleNav('dashboard')}
          >
            <span className="text-xl">✨</span>
            <span className="font-bold text-foreground text-sm hidden sm:block">Brillitos</span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Search — hidden on mobile */}
            <div className="hidden sm:flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
              <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Buscar..."
                className="bg-transparent text-sm outline-none w-28 placeholder:text-muted-foreground"
              />
            </div>

            <Button
              size="sm"
              onClick={onQuickAddClientOrder}
              className="hidden sm:flex items-center gap-1.5 h-8 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo pedido
            </Button>

            {/* Mobile: + button */}
            <Button
              size="icon"
              onClick={onQuickAddClientOrder}
              className="flex sm:hidden h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onSignOut}
              className="hidden md:flex h-8 w-8 text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="flex md:hidden h-8 w-8"
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-white px-4 py-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          <button
            onClick={() => { onSignOut(); setMenuOpen(false); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </header>
  );
}
