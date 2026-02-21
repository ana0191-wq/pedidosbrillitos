import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Loader2, Check, X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Order, Store } from '@/types/orders';

interface GmailImportProps {
  onImportOrders: (orders: Order[]) => void;
}

export function GmailImport({ onImportOrders }: GmailImportProps) {
  const { toast } = useToast();
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [foundOrders, setFoundOrders] = useState<any[]>([]);
  const [tokens, setTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null);

  // Check if Gmail is already connected
  useEffect(() => {
    const checkConnection = async () => {
      const { data } = await supabase
        .from('gmail_tokens')
        .select('email, access_token, refresh_token')
        .maybeSingle();

      if (data) {
        setGmailConnected(true);
        setGmailEmail(data.email || '');
        setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
      }
    };
    checkConnection();
  }, []);

  // Listen for OAuth callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'gmail-success') {
        const { accessToken, refreshToken, expiresAt, email } = event.data;

        // Save tokens to DB
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('gmail_tokens').upsert({
          user_id: user.id,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          email,
        }, { onConflict: 'user_id' });

        setGmailConnected(true);
        setGmailEmail(email);
        setTokens({ accessToken, refreshToken });
        setConnecting(false);
        toast({ title: '✅ Gmail conectado', description: `Cuenta: ${email}` });
      } else if (event.data?.type === 'gmail-error') {
        setConnecting(false);
        toast({ title: 'Error', description: 'No se pudo conectar Gmail', variant: 'destructive' });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast]);

  const connectGmail = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { returnUrl: window.location.origin },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, 'gmail-auth', 'width=500,height=600,left=200,top=100');
      }
    } catch (err) {
      console.error(err);
      setConnecting(false);
      toast({ title: 'Error', description: 'No se pudo iniciar la conexión', variant: 'destructive' });
    }
  };

  const disconnectGmail = async () => {
    await supabase.from('gmail_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setGmailConnected(false);
    setGmailEmail('');
    setTokens(null);
    setFoundOrders([]);
    toast({ title: 'Gmail desconectado' });
  };

  const scanEmails = async () => {
    if (!tokens) return;
    setScanning(true);
    setFoundOrders([]);

    try {
      const { data, error } = await supabase.functions.invoke('gmail-scan', {
        body: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
      });

      if (error) throw error;

      if (data?.newAccessToken) {
        setTokens(prev => prev ? { ...prev, accessToken: data.newAccessToken } : null);
        // Update stored token
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('gmail_tokens').update({ access_token: data.newAccessToken }).eq('user_id', user.id);
        }
      }

      if (data?.orders?.length) {
        setFoundOrders(data.orders);
        toast({ title: `📧 ${data.orders.length} pedido(s) encontrado(s)`, description: 'Selecciona los que quieras importar' });
      } else {
        toast({ title: '📭 Sin pedidos nuevos', description: 'No se encontraron pedidos en los últimos 30 días' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudieron escanear los correos', variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const importOrder = (orderData: any) => {
    const validStores: Store[] = ['AliExpress', 'Shein', 'Temu', 'Amazon'];
    const store: Store = validStores.includes(orderData.store) ? orderData.store : 'AliExpress';

    const order: Order = {
      id: Math.random().toString(36).substring(2, 15),
      category: 'personal',
      productName: orderData.productName || 'Pedido importado',
      productPhoto: '',
      store,
      pricePaid: orderData.pricePaid || 0,
      orderDate: orderData.orderDate || new Date().toISOString().split('T')[0],
      estimatedArrival: orderData.estimatedArrival || '',
      orderNumber: orderData.orderNumber || '',
      notes: 'Importado desde Gmail',
      createdAt: new Date().toISOString(),
      status: 'Pedido',
    };

    onImportOrders([order]);
    setFoundOrders(prev => prev.filter(o => o !== orderData));
    toast({ title: '✅ Pedido importado', description: order.productName });
  };

  const importAll = () => {
    const validStores: Store[] = ['AliExpress', 'Shein', 'Temu', 'Amazon'];

    const ordersToImport: Order[] = foundOrders.map(orderData => ({
      id: Math.random().toString(36).substring(2, 15),
      category: 'personal' as const,
      productName: orderData.productName || 'Pedido importado',
      productPhoto: '',
      store: validStores.includes(orderData.store) ? orderData.store : 'AliExpress' as Store,
      pricePaid: orderData.pricePaid || 0,
      orderDate: orderData.orderDate || new Date().toISOString().split('T')[0],
      estimatedArrival: orderData.estimatedArrival || '',
      orderNumber: orderData.orderNumber || '',
      notes: 'Importado desde Gmail',
      createdAt: new Date().toISOString(),
      status: 'Pedido' as const,
    }));

    onImportOrders(ordersToImport);
    setFoundOrders([]);
    toast({ title: `✅ ${ordersToImport.length} pedido(s) importado(s)` });
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Importar desde Gmail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!gmailConnected ? (
          <Button onClick={connectGmail} disabled={connecting} variant="outline" className="w-full">
            {connecting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Conectando...</>
            ) : (
              <><Mail className="h-4 w-4 mr-2" /> Conectar Gmail</>
            )}
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Check className="h-3 w-3 text-secondary" />
                {gmailEmail}
              </span>
              <Button variant="ghost" size="sm" onClick={disconnectGmail} className="text-xs h-7">
                Desconectar
              </Button>
            </div>

            <Button onClick={scanEmails} disabled={scanning} className="w-full" size="sm">
              {scanning ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Escaneando correos...</>
              ) : (
                <><Mail className="h-4 w-4 mr-2" /> Escanear pedidos</>
              )}
            </Button>

            {foundOrders.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{foundOrders.length} pedido(s) encontrado(s)</span>
                  <Button variant="secondary" size="sm" onClick={importAll} className="text-xs h-7">
                    <Plus className="h-3 w-3 mr-1" /> Importar todos
                  </Button>
                </div>

                {foundOrders.map((order, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{order.productName || 'Sin nombre'}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.store || '?'} · ${order.pricePaid || '?'}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button variant="ghost" size="sm" onClick={() => importOrder(order)} className="h-7 w-7 p-0">
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setFoundOrders(prev => prev.filter((_, j) => j !== i))} className="h-7 w-7 p-0 text-muted-foreground">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
