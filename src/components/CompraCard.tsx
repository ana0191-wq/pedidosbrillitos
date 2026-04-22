import { Package, ExternalLink } from 'lucide-react';

const statusColor: Record<string, string> = {
  'Pendiente':    'bg-amber-100 text-amber-700',
  'En Tránsito':  'bg-blue-100 text-blue-700',
  'Llegó':        'bg-green-100 text-green-700',
  'En Venezuela': 'bg-purple-100 text-purple-700',
  'Entregado':    'bg-gray-100 text-gray-500',
  'No Llegó':     'bg-red-100 text-red-600',
};

const categoryBadge: Record<string, { label: string; class: string }> = {
  client:      { label: '👤 Cliente',   class: 'bg-orange-50 text-orange-600' },
  merchandise: { label: '🛍️ Mercancía', class: 'bg-purple-50 text-purple-600' },
  personal:    { label: '🏠 Personal',  class: 'bg-green-50 text-green-700' },
};

interface Props {
  order: any;
}

export default function CompraCard({ order }: Props) {
  const cat = categoryBadge[order.category];
  const sc = statusColor[order.status] ?? 'bg-gray-100 text-gray-500';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-4 flex items-center gap-4 hover:shadow-md transition">
      {/* Photo */}
      <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
        {order.product_photo ? (
          <img src={order.product_photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-5 h-5 text-gray-300" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{order.product_name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-gray-400">{order.store}</span>
          {cat && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cat.class}`}>
              {cat.label}
            </span>
          )}
        </div>
        {order.client_name && (
          <p className="text-xs text-gray-400 mt-0.5">👤 {order.client_name}</p>
        )}
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className="font-bold text-gray-900 text-sm">${order.price_paid.toFixed(2)}</span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sc}`}>
          {order.status}
        </span>
      </div>
    </div>
  );
}