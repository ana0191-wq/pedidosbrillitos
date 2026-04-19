ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

ALTER TABLE public.client_orders
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;
