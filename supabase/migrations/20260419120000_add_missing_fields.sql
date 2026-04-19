-- Add missing fields to orders (products inside client orders)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_link TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS size_color TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS arrival_photo TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_arrival_date DATE DEFAULT NULL;

-- Add missing fields to client_orders
ALTER TABLE public.client_orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_arrival_date DATE DEFAULT NULL;

-- Add personal order extra fields (compras personales)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quien_compro TEXT DEFAULT 'yo',
  ADD COLUMN IF NOT EXISTS modo_compra TEXT DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS clientes_en_cajon INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tipo_producto TEXT DEFAULT 'general';
