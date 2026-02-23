import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Client {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdAt: string;
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchClients = useCallback(async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching clients:', error);
      return;
    }

    setClients((data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      phone: r.phone || '',
      notes: r.notes || '',
      createdAt: r.created_at,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const addClient = useCallback(async (name: string, phone = '', notes = '') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.from('clients').insert({
      user_id: user.id, name, phone, notes,
    }).select('id').single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchClients();
    return data?.id;
  }, [fetchClients, toast]);

  const updateClient = useCallback(async (id: string, updates: Partial<Pick<Client, 'name' | 'phone' | 'notes'>>) => {
    const { error } = await supabase.from('clients').update(updates).eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else await fetchClients();
  }, [fetchClients, toast]);

  const deleteClient = useCallback(async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else await fetchClients();
  }, [fetchClients, toast]);

  return { clients, loading, addClient, updateClient, deleteClient, refetch: fetchClients };
}
