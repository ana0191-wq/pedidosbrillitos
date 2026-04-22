-- Ensure estimated_arrival_date exists on client_orders (schema cache fix)
ALTER TABLE public.client_orders
  ADD COLUMN IF NOT EXISTS estimated_arrival_date DATE DEFAULT NULL;

-- Also ensure delivered exists on orders (in case previous migration didn't run)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered BOOLEAN DEFAULT false;
