
-- Tabla de clientes
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clients" ON public.clients FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own clients" ON public.clients FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own clients" ON public.clients FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de pedidos de cliente (carritos)
CREATE TABLE public.client_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Pendiente',
  payment_method TEXT DEFAULT '',
  payment_reference TEXT DEFAULT '',
  shipping_cost NUMERIC DEFAULT 0,
  amount_charged NUMERIC DEFAULT 0,
  shipping_type TEXT DEFAULT '',
  shipping_weight_lb NUMERIC DEFAULT 0,
  shipping_volume_ft3 NUMERIC DEFAULT 0,
  shipping_dimensions TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own client_orders" ON public.client_orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own client_orders" ON public.client_orders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own client_orders" ON public.client_orders FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own client_orders" ON public.client_orders FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_client_orders_updated_at BEFORE UPDATE ON public.client_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Agregar referencia de productos a client_orders
ALTER TABLE public.orders ADD COLUMN client_order_id UUID REFERENCES public.client_orders(id) ON DELETE SET NULL;

-- Tabla de configuración de envíos (tarifas courier)
CREATE TABLE public.shipping_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  air_rate_per_lb NUMERIC DEFAULT 5.50,
  air_price_per_lb NUMERIC DEFAULT 8.00,
  sea_rate_per_ft3 NUMERIC DEFAULT 12.00,
  sea_minimum NUMERIC DEFAULT 15.00,
  sea_insurance NUMERIC DEFAULT 3.00,
  sea_profit NUMERIC DEFAULT 5.00,
  default_shipping_percent NUMERIC DEFAULT 0.40,
  default_margin_percent NUMERIC DEFAULT 0.40,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shipping_settings" ON public.shipping_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can upsert own shipping_settings" ON public.shipping_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own shipping_settings" ON public.shipping_settings FOR UPDATE USING (user_id = auth.uid());

CREATE TRIGGER update_shipping_settings_updated_at BEFORE UPDATE ON public.shipping_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
