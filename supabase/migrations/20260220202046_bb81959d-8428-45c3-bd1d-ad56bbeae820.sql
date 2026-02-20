
-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('personal', 'merchandise', 'client')),
  product_name TEXT NOT NULL,
  product_photo TEXT DEFAULT '',
  store TEXT NOT NULL CHECK (store IN ('AliExpress', 'Shein', 'Temu')),
  price_paid NUMERIC NOT NULL DEFAULT 0,
  order_date DATE,
  estimated_arrival DATE,
  order_number TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pedido',
  notes TEXT DEFAULT '',
  -- Merchandise fields
  units_ordered INTEGER DEFAULT 1,
  units_received INTEGER DEFAULT 0,
  price_per_unit NUMERIC DEFAULT 0,
  -- Client fields
  client_name TEXT DEFAULT '',
  shipping_cost NUMERIC DEFAULT 0,
  amount_charged NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.is_own_order(order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()
  );
$$;

-- RLS policies
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own orders"
  ON public.orders FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own orders"
  ON public.orders FOR DELETE
  USING (user_id = auth.uid());

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
