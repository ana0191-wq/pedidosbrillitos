-- Add two-stage payment columns to client_orders
ALTER TABLE public.client_orders
  ADD COLUMN IF NOT EXISTS product_payment_status text NOT NULL DEFAULT 'Pendiente',
  ADD COLUMN IF NOT EXISTS product_payment_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS product_payment_method text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS product_payment_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_payment_status text NOT NULL DEFAULT 'Pendiente',
  ADD COLUMN IF NOT EXISTS shipping_payment_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_payment_method text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_payment_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_cost_company numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_charge_to_client numeric DEFAULT NULL;

-- Update default client shipping rate from $10 to $12/lb
ALTER TABLE public.shipping_settings ALTER COLUMN air_price_per_lb SET DEFAULT 12.00;

-- Update existing settings rows to $12 if they still have the old $8 or $10 default
UPDATE public.shipping_settings SET air_price_per_lb = 12.00 WHERE air_price_per_lb IN (8.00, 10.00);