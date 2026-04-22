ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered boolean DEFAULT false;
