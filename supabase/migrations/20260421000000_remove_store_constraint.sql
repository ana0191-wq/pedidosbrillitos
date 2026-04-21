-- Remove restrictive store CHECK constraint to allow any store name
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_store_check;
