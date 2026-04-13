
CREATE TABLE public.collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  percentage NUMERIC NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own collaborators" ON public.collaborators FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own collaborators" ON public.collaborators FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own collaborators" ON public.collaborators FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own collaborators" ON public.collaborators FOR DELETE USING (user_id = auth.uid());

CREATE TABLE public.collaborator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  ana_profit NUMERIC NOT NULL DEFAULT 0,
  collaborator_cut NUMERIC NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(collaborator_id, order_id)
);

ALTER TABLE public.collaborator_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own earnings" ON public.collaborator_earnings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own earnings" ON public.collaborator_earnings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own earnings" ON public.collaborator_earnings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own earnings" ON public.collaborator_earnings FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_collaborators_updated_at BEFORE UPDATE ON public.collaborators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_collaborator_earnings_updated_at BEFORE UPDATE ON public.collaborator_earnings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
