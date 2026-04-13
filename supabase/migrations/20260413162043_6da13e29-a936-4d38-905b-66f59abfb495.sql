
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company_invoice_amount NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company_invoice_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_files JSONB DEFAULT '[]';

INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload invoices"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoices' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices');

CREATE POLICY "Users can delete own invoices"
ON storage.objects FOR DELETE
USING (bucket_id = 'invoices' AND auth.uid() IS NOT NULL);
