import { useNavigate } from 'react-router-dom';
import { Upload, Package, Users, Wallet, TrendingUp, Clock, ShoppingBag, ArrowRight } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { useClientOrders } from '@/hooks/useClientOrders';
import { useClients } from '@/hooks/useClients';

export default function Dashboard() {
  const navigate = useNavigate();
  const { orders } = useOrders();
  const { clientOrders } = useClientOrders();
  const { clients } = useClients();

  // Stats
  const totalCompras = orders?.length ?? 0;
  const enTransito = orders?.filter(o => o.status === 'En Tránsito').length ?? 0;
  const pendientesCobrar = clientOrders?.filter(o =>
    o.product_payment_status !== 'Pagado' || o.shipping_payment_status !== 'Pagado'
  ).length ?? 0;
  const totalClientes = clients?.filter(c => !c.deleted_at).length ?? 0;

  const stats = [
    { label: 'Compras registradas', value: totalCompras, icon: ShoppingBag, color: 'text-coral', bg: 'bg-coral-soft' },
    { label: 'En tránsito', value: enTransito, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Por cobrar', value: pendientesCobrar, icon: Wallet, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Clientes', value: totalClientes, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  // Recent orders (last 5)
  const recent = [...(orders ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const statusColor: Record<string, string> = {
    'Pendiente':    'bg-amber-100 text-amber-700',
    'En Tránsito':  'bg-blue-100 text-blue-700',
    'Llegó':        'bg-green-100 text-green-700',
    'En Venezuela': 'bg-purple-100 text-purple-700',
    'Entregado':    'bg-gray-100 text-gray-600',
    'No Llegó':     'bg-red-100 text-red-600',
  };

  const categoryLabel: Record<string, string> = {
    client:      '👤 Cliente',
    merchandise: '🛍️ Mercancía',
    personal:    '🏠 Personal',
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Bienvenida, Ana ✨</p>
        </div>
      </div>

      {/* ── BIG UPLOAD BUTTON ── */}
      <button
        onClick={() => navigate('/compras?upload=1')}
        className="w-full bg-coral hover:opacity-95 active:scale-[0.99] transition-all text-white rounded-2xl p-5 flex items-center gap-4 shadow-md"
      >
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Upload className="w-6 h-6 text-white" />
        </div>
        <div className="text-left flex-1">
          <p className="font-bold text-lg leading-tight">Subir compras</p>
          <p className="text-white/80 text-sm mt-0.5">
            Escanea productos y asígnalos a clientes o categorías
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-white/70 flex-shrink-0" />
      </button>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 card-shadow">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4.5 h-4.5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent purchases */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-coral" />
            <h2 className="font-semibold text-gray-900 text-sm">Compras recientes</h2>
          </div>
          <button
            onClick={() => navigate('/compras')}
            className="text-xs text-coral font-medium hover:underline flex items-center gap-1"
          >
            Ver todas <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aún no hay compras registradas</p>
            <button
              onClick={() => navigate('/compras?upload=1')}
              className="mt-3 text-sm text-coral font-medium hover:underline"
            >
              Subir primera compra →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map(order => (
              <div key={order.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition">
                {/* Photo */}
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                  {order.product_photo ? (
                    <img src={order.product_photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{order.product_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{order.store}</span>
                    <span className="text-gray-200">·</span>
                    <span className="text-xs text-gray-400">
                      {categoryLabel[order.category] ?? order.category}
                    </span>
                  </div>
                </div>

                {/* Right */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-900">
                    ${order.price_paid.toFixed(2)}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/pedidos')}
          className="bg-white rounded-2xl border border-gray-100 p-4 text-left hover:shadow-md transition card-shadow group"
        >
          <Package className="w-5 h-5 text-coral mb-2" />
          <p className="font-semibold text-sm text-gray-900">Ver pedidos</p>
          <p className="text-xs text-gray-400 mt-0.5">Gestiona pedidos de clientes</p>
        </button>
        <button
          onClick={() => navigate('/porcobrar')}
          className="bg-white rounded-2xl border border-gray-100 p-4 text-left hover:shadow-md transition card-shadow group"
        >
          <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
          <p className="font-semibold text-sm text-gray-900">Por cobrar</p>
          <p className="text-xs text-gray-400 mt-0.5">Pagos pendientes</p>
        </button>
      </div>
    </div>
  );
}