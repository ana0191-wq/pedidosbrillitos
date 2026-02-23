import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Mail, Loader2, Check, X, Plus, CalendarIcon, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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
  const [errorMessage, setErrorMessage] = useState('');

  // Date range - default last 7 days
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [dateTo, setDateTo] = useState<Date>(new Date());

  // Check if Gmail is already connected + handle URL params from callback
  useEffect(() => {
    const checkConnection = async () => {
      // Check URL params for callback result
      const params = new URLSearchParams(window.location.search);
      const gmailSuccess = params.get('gmail_success');
      const gmailError = params.get('gmail_error');
      const gmailEmailParam = params.get('gmail_email');

      // Clean URL params
      if (gmailSuccess || gmailError) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }

      if (gmailError) {
        setErrorMessage(gmailError);
        toast({ title: 'Error de Gmail', description: gmailError, variant: 'destructive' });
      }

      if (gmailSuccess && gmailEmailParam) {
        setGmailConnected(true);
        setGmailEmail(gmailEmailParam);
        setErrorMessage('');
        toast({ title: '✅ Gmail conectado', description: `Cuenta: ${gmailEmailParam}` });
        return;
      }

      // Check DB for existing connection
      const { data } = await supabase
        .from('gmail_tokens')
        .select('email')
        .maybeSingle();

      if (data) {
        setGmailConnected(true);
        setGmailEmail(data.email || '');
      }
    };
    checkConnection();
  }, [toast]);

  const connectGmail = async () => {
    setConnecting(true);
    setErrorMessage('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMessage('Debes iniciar sesión primero');
        setConnecting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { returnUrl: window.location.origin, userId: user.id },
      });

      if (error) throw error;
      if (data?.url) {
        // Redirect in same window (not popup) for reliable callback
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error(err);
      setConnecting(false);
      setErrorMessage(err.message || 'No se pudo iniciar la conexión');
      toast({ title: 'Error', description: 'No se pudo iniciar la conexión con Gmail', variant: 'destructive' });
    }
  };

  const disconnectGmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('gmail_tokens').delete().eq('user_id', user.id);
    }
    setGmailConnected(false);
    setGmailEmail('');
    setFoundOrders([]);
    setErrorMessage('');
    toast({ title: 'Gmail desconectado' });
  };

  const scanEmails = async () => {
    setScanning(true);
    setFoundOrders([]);
    setErrorMessage('');

    try {
      // Get tokens from DB
      const { data: tokenData } = await supabase
        .from('gmail_tokens')
        .select('access_token, refresh_token')
        .maybeSingle();

      if (!tokenData) {
        setGmailConnected(false);
        setErrorMessage('No hay tokens. Reconecta Gmail.');
        setScanning(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('gmail-scan', {
        body: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          dateFrom: format(dateFrom, 'yyyy/MM/dd'),
          dateTo: format(dateTo, 'yyyy/MM/dd'),
        },
      });

      if (error) throw error;

      if (data?.needsReconnect) {
        setGmailConnected(false);
        setErrorMessage('La sesión de Gmail expiró. Reconecta tu cuenta.');
        toast({ title: '🔄 Reconecta Gmail', description: 'La sesión expiró.', variant: 'destructive' });
        return;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Error desconocido');
      }

      if (data?.newAccessToken) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('gmail_tokens').update({ access_token: data.newAccessToken }).eq('user_id', user.id);
        }
      }

      if (data?.orders?.length) {
        setFoundOrders(data.orders);
        toast({ title: `📧 ${data.orders.length} pedido(s) encontrado(s)` });
      } else {
        toast({ title: '📭 Sin pedidos nuevos', description: `No se encontraron pedidos entre ${format(dateFrom, 'dd/MM/yyyy')} y ${format(dateTo, 'dd/MM/yyyy')}` });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'No se pudieron escanear los correos');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
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
      productPhoto: orderData.productImageUrl || '',
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
      productPhoto: orderData.productImageUrl || '',
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
        {errorMessage && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

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

            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal text-xs h-8", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yy') : 'Desde'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal text-xs h-8", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {dateTo ? format(dateTo, 'dd/MM/yy') : 'Hasta'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
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
                  <span className="text-xs text-muted-foreground">{foundOrders.length} pedido(s)</span>
                  <Button variant="secondary" size="sm" onClick={importAll} className="text-xs h-7">
                    <Plus className="h-3 w-3 mr-1" /> Importar todos
                  </Button>
                </div>

                {foundOrders.map((order, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                    {order.productImageUrl ? (
                      <img src={order.productImageUrl} alt="" className="h-12 w-12 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{order.productName || 'Sin nombre'}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.store || '?'} · ${order.pricePaid || '?'}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
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
