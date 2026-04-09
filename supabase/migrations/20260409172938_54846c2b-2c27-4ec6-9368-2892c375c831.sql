
-- Store constraint (flexible, both cases + lowercase)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_store_check;

-- Add payment/delivery columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_currency TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS euro_rate NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Create products catalog table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  cost_usd NUMERIC DEFAULT 0,
  sale_price_usd NUMERIC DEFAULT 0,
  sale_price_ves NUMERIC DEFAULT 0,
  is_set BOOLEAN DEFAULT false,
  set_quantity INTEGER DEFAULT 1,
  stock INTEGER DEFAULT 0,
  store TEXT DEFAULT '',
  images TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Public can read published products
CREATE POLICY "Public can read published products"
ON public.products FOR SELECT
USING (is_published = true);

-- Authenticated users can read all their own products
CREATE POLICY "Users can view own products"
ON public.products FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create own products
CREATE POLICY "Users can create own products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update own products
CREATE POLICY "Users can update own products"
ON public.products FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Users can delete own products
CREATE POLICY "Users can delete own products"
ON public.products FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Timestamp trigger for products
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
