import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, Search, Package, ShoppingBag } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import UploadComprasDialog from '@/components/UploadComprasDialog';
import CompraCard from '@/components/CompraCard';

const STATUS_TABS = ['Todos', 'Pendiente', 'En Tránsito', 'Llegó', 'En Venezuela', 'Entregado'];
const CAT_TABS    = ['Todas', 'Cliente', 'Mercancía', 'Personal'];
const CAT_MAP: Record<string, string> = {
  'Cliente':   'client',
  'Mercancía': 'merchandise',
  'Personal':  'personal',
};

export default function ComprasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { orders, loading } = useOrders();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search,     setSearch]     = useState('');
  const [statusTab,  setStatusTab]  = useState('Todos');
  const [catTab,     setCatTab]     = useState('Todas');

  // Auto-open upload if ?upload=1
  useEffect(() => {
    if (searchParams.get('upload') === '1') {
      setUploadOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const filtered = (orders ?? []).filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      o.productName.toLowerCase().includes(q) ||
      o.store.toLowerCase().includes(q);
    const matchStatus = statusTab === 'Todos' || o.status === statusTab;
    const matchCat    = catTab === 'Todas'    || o.category === CAT_MAP[catTab];
    return matchSearch && matchStatus && matchCat;
  });

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orders?.length ?? 0} productos registrados</p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-sm"
          style={{ background: 'hsl(14 90% 58%)' }}
        >
          <Upload className="w-4 h-4" />
          Subir compras
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por producto o tienda..."
          className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 transition"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
        {CAT_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setCatTab(tab)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
              catTab === tab
                ? 'text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
            }`}
            style={catTab === tab ? { background: 'hsl(14 90% 58%)' } : {}}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Status pills */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
              statusTab === tab
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {search ? 'No se encontraron productos' : 'Aún no hay compras registradas'}
          </p>
          {!search && (
            <button
              onClick={() => setUploadOpen(true)}
              className="mt-3 text-sm font-medium hover:underline text-orange-500"
            >
              Subir primera compra →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <CompraCard key={order.id} order={order} />
          ))}
        </div>
      )}

      <UploadComprasDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}