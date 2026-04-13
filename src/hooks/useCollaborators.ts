import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Collaborator {
  id: string;
  name: string;
  percentage: number;
  createdAt: string;
}

export interface CollaboratorEarning {
  id: string;
  collaboratorId: string;
  orderId: string;
  anaProfit: number;
  collaboratorCut: number;
  paid: boolean;
  paidAt: string | null;
  createdAt: string;
}

export function useCollaborators() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [earnings, setEarnings] = useState<CollaboratorEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    const [{ data: collabs }, { data: earns }] = await Promise.all([
      supabase.from('collaborators').select('*').order('created_at', { ascending: true }),
      supabase.from('collaborator_earnings').select('*').order('created_at', { ascending: false }),
    ]);

    setCollaborators((collabs || []).map((r: any) => ({
      id: r.id, name: r.name, percentage: Number(r.percentage), createdAt: r.created_at,
    })));

    setEarnings((earns || []).map((r: any) => ({
      id: r.id, collaboratorId: r.collaborator_id, orderId: r.order_id,
      anaProfit: Number(r.ana_profit), collaboratorCut: Number(r.collaborator_cut),
      paid: r.paid, paidAt: r.paid_at, createdAt: r.created_at,
    })));

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addCollaborator = useCallback(async (name: string, percentage: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('collaborators').insert({
      user_id: user.id, name, percentage,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await fetchAll();
  }, [fetchAll, toast]);

  const updateCollaborator = useCallback(async (id: string, updates: Partial<Pick<Collaborator, 'name' | 'percentage'>>) => {
    const row: any = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.percentage !== undefined) row.percentage = updates.percentage;
    const { error } = await supabase.from('collaborators').update(row).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await fetchAll();
  }, [fetchAll, toast]);

  const deleteCollaborator = useCallback(async (id: string) => {
    const { error } = await supabase.from('collaborators').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await fetchAll();
  }, [fetchAll, toast]);

  // Upsert an earning for an order — called whenever profit changes
  const upsertEarning = useCallback(async (collaboratorId: string, orderId: string, anaProfit: number, percentage: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const collaboratorCut = Math.round(anaProfit * percentage / 100 * 100) / 100;

    // Try update first, then insert
    const { data: existing } = await supabase
      .from('collaborator_earnings')
      .select('id')
      .eq('collaborator_id', collaboratorId)
      .eq('order_id', orderId)
      .maybeSingle();

    if (existing) {
      await supabase.from('collaborator_earnings').update({
        ana_profit: anaProfit, collaborator_cut: collaboratorCut,
      }).eq('id', existing.id);
    } else {
      await supabase.from('collaborator_earnings').insert({
        user_id: user.id, collaborator_id: collaboratorId, order_id: orderId,
        ana_profit: anaProfit, collaborator_cut: collaboratorCut,
      });
    }
    await fetchAll();
  }, [fetchAll]);

  const markPaid = useCallback(async (earningId: string) => {
    const { error } = await supabase.from('collaborator_earnings').update({
      paid: true, paid_at: new Date().toISOString(),
    }).eq('id', earningId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await fetchAll();
  }, [fetchAll, toast]);

  const getEarningsByCollaborator = useCallback((collaboratorId: string) => {
    return earnings.filter(e => e.collaboratorId === collaboratorId);
  }, [earnings]);

  const getEarningForOrder = useCallback((orderId: string) => {
    return earnings.find(e => e.orderId === orderId) || null;
  }, [earnings]);

  return {
    collaborators, earnings, loading,
    addCollaborator, updateCollaborator, deleteCollaborator,
    upsertEarning, markPaid,
    getEarningsByCollaborator, getEarningForOrder,
  };
}
