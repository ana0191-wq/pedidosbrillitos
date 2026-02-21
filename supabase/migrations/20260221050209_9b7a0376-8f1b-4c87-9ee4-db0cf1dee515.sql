
-- Table to store Gmail OAuth tokens per user
CREATE TABLE public.gmail_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gmail tokens"
ON public.gmail_tokens FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own gmail tokens"
ON public.gmail_tokens FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own gmail tokens"
ON public.gmail_tokens FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own gmail tokens"
ON public.gmail_tokens FOR DELETE
USING (user_id = auth.uid());

CREATE TRIGGER update_gmail_tokens_updated_at
BEFORE UPDATE ON public.gmail_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
