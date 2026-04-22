import { useEffect, useState } from 'react';
import { useShippingSettings } from '@/hooks/useShippingSettings';
import { useClientOrders } from '@/hooks/useClientOrders';
import { ShippingCalculator } from '@/components/ShippingCalculator';
import { QuickCalculator } from '@/components/QuickCalculator';
import { supabase } from '@/integrations/supabase/client';

export default function CalculadoraPage() {
  const { settings, saveSettings } = useShippingSettings();
  const { clientOrders } = useClientOrders();
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  useEffect(() => {
    supabase.functions.invoke('exchange-rate').then(({ data }) => {
      if (data?.success) setExchangeRate(data.rate);
    });
  }, []);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Calculadora</h1>
      </div>
      <ShippingCalculator settings={settings} onSaveSettings={saveSettings} />
      <QuickCalculator
        shippingSettings={settings}
        exchangeRate={exchangeRate}
        clientOrders={clientOrders}
      />
    </div>
  );
}