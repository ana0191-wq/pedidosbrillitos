
-- Add arrived boolean to orders for per-product arrival tracking
ALTER TABLE public.orders ADD COLUMN arrived boolean NOT NULL DEFAULT false;
