import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/orders';
import { useToast } from '@/hooks/use-toast';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
      return;
    }

    const mapped: Product[] = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description || '',
      costUsd: Number(row.cost_usd) || 0,
      salePriceUsd: Number(row.sale_price_usd) || 0,
      salePriceVes: Number(row.sale_price_ves) || 0,
      isSet: row.is_set || false,
      setQuantity: row.set_quantity || 1,
      stock: row.stock || 0,
      store: row.store || '',
      images: row.images || [],
      isPublished: row.is_published || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    setProducts(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('products').insert({
      user_id: user.id,
      name: product.name,
      description: product.description,
      cost_usd: product.costUsd,
      sale_price_usd: product.salePriceUsd,
      sale_price_ves: product.salePriceVes,
      is_set: product.isSet,
      set_quantity: product.setQuantity,
      stock: product.stock,
      store: product.store,
      images: product.images,
      is_published: product.isPublished,
    } as any);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchProducts();
    toast({ title: '✅ Producto guardado' });
  }, [fetchProducts, toast]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const row: any = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.costUsd !== undefined) row.cost_usd = updates.costUsd;
    if (updates.salePriceUsd !== undefined) row.sale_price_usd = updates.salePriceUsd;
    if (updates.salePriceVes !== undefined) row.sale_price_ves = updates.salePriceVes;
    if (updates.isSet !== undefined) row.is_set = updates.isSet;
    if (updates.setQuantity !== undefined) row.set_quantity = updates.setQuantity;
    if (updates.stock !== undefined) row.stock = updates.stock;
    if (updates.store !== undefined) row.store = updates.store;
    if (updates.images !== undefined) row.images = updates.images;
    if (updates.isPublished !== undefined) row.is_published = updates.isPublished;

    const { error } = await supabase.from('products').update(row).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchProducts();
  }, [fetchProducts, toast]);

  const deleteProduct = useCallback(async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchProducts();
  }, [fetchProducts, toast]);

  return { products, loading, addProduct, updateProduct, deleteProduct };
}
