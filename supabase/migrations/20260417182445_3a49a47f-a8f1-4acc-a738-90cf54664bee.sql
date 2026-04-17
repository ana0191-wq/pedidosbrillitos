ALTER TABLE public.client_orders
  ADD COLUMN IF NOT EXISTS brother_involved boolean NOT NULL DEFAULT true;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS brother_involved boolean NOT NULL DEFAULT true;