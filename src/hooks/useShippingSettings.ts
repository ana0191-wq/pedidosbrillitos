import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ShippingSettings {
  airRatePerLb: number;
  airPricePerLb: number;
  seaRatePerFt3: number;
  seaMinimum: number;
  seaInsurance: number;
  seaProfit: number;
  defaultShippingPercent: number;
  defaultMarginPercent: number;
}

const DEFAULTS: ShippingSettings = {
  airRatePerLb: 5.50,
  airPricePerLb: 8.00,
  seaRatePerFt3: 12.00,
  seaMinimum: 15.00,
  seaInsurance: 3.00,
  seaProfit: 5.00,
  defaultShippingPercent: 0.40,
  defaultMarginPercent: 0.40,
};

export function useShippingSettings() {
  const [settings, setSettings] = useState<ShippingSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('shipping_settings')
      .select('*')
      .maybeSingle();

    if (!error && data) {
      setSettings({
        airRatePerLb: Number(data.air_rate_per_lb),
        airPricePerLb: Number(data.air_price_per_lb),
        seaRatePerFt3: Number(data.sea_rate_per_ft3),
        seaMinimum: Number(data.sea_minimum),
        seaInsurance: Number(data.sea_insurance),
        seaProfit: Number(data.sea_profit),
        defaultShippingPercent: Number(data.default_shipping_percent),
        defaultMarginPercent: Number(data.default_margin_percent),
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = useCallback(async (s: ShippingSettings) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const row = {
      user_id: user.id,
      air_rate_per_lb: s.airRatePerLb,
      air_price_per_lb: s.airPricePerLb,
      sea_rate_per_ft3: s.seaRatePerFt3,
      sea_minimum: s.seaMinimum,
      sea_insurance: s.seaInsurance,
      sea_profit: s.seaProfit,
      default_shipping_percent: s.defaultShippingPercent,
      default_margin_percent: s.defaultMarginPercent,
    };

    const { error } = await supabase.from('shipping_settings').upsert(row, { onConflict: 'user_id' });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSettings(s);
      toast({ title: '✅ Tarifas guardadas' });
    }
  }, [toast]);

  return { settings, loading, saveSettings };
}
