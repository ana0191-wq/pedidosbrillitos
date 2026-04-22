import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, ShoppingBag, Wallet,
  Store, Calculator, LogOut, Sparkles, Menu, X
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Dashboard from '@/pages/Dashboard';
import PedidosPage from '@/pages/PedidosPage';
import ClientesPage from '@/pages/ClientesPage';
import ComprasPage from '@/pages/ComprasPage';
import PorCobrarPage from '@/pages/PorCobrarPage';
import MercanciaPage from '@/pages/MercanciaPage';
import CalculadoraPage from '@/pages/CalculadoraPage';

const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/compras',     icon: ShoppingBag,     label: 'Compras' },
  { to: '/pedidos',     icon: Package,         label: 'Pedidos' },
  { to: '/clientes',    icon: Users,           label: 'Clientes' },
  { to: '/porcobrar',   icon: Wallet,          label: 'Por Cobrar' },
  { to: '/mercancia',   icon: Store,           label: 'Mercancía' },
  { to: '/calculadora', icon: Calculator,      label: 'Calculadora' },
];

// ── Sidebar — defined OUTSIDE AppShell to avoid re-mount on every render ──
interface SidebarProps {
  onClose?: () => void;
  onSignOut: () => void;
}

function Sidebar({ onClose, onSignOut }: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[hsl(14_90%_58%)] flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">Brillitos</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[hsl(14_90%_58%)] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-gray-100 flex-shrink-0">
        <button
          onClick={onSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all w-full"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

// ── AppShell ───────────────────────────────────────────────────────────────
export default function AppShell() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-100 flex-shrink-0">
        <Sidebar onSignOut={handleSignOut} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-56 bg-white flex flex-col shadow-xl z-10">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 z-10"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
            <Sidebar onClose={() => setMobileOpen(false)} onSignOut={handleSignOut} />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-gray-100 transition"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[hsl(14_90%_58%)] flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-gray-900">Brillitos</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/compras"     element={<ComprasPage />} />
            <Route path="/pedidos"     element={<PedidosPage />} />
            <Route path="/clientes"    element={<ClientesPage />} />
            <Route path="/porcobrar"   element={<PorCobrarPage />} />
            <Route path="/mercancia"   element={<MercanciaPage />} />
            <Route path="/calculadora" element={<CalculadoraPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
