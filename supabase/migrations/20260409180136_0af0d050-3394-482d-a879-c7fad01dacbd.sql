ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS weight_lb numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS length_in numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS width_in numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS height_in numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_price_usd numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_price_ves numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_charge_client numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prices_confirmed boolean NOT NULL DEFAULT false;