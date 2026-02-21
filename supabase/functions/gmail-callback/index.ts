import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // returnUrl
    const error = url.searchParams.get('error');

    if (error) {
      return new Response(`<html><body><script>window.opener?.postMessage({type:'gmail-error',error:'${error}'},'*');window.close();</script><p>Error: ${error}. Puedes cerrar esta ventana.</p></body></html>`, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!code) {
      return new Response('Missing code', { status: 400 });
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('Token exchange failed:', tokens);
      return new Response(`<html><body><script>window.opener?.postMessage({type:'gmail-error',error:'token_exchange_failed'},'*');window.close();</script><p>Error al obtener tokens. Puedes cerrar esta ventana.</p></body></html>`, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Get user email from Gmail
    const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    // Return tokens to the opener window via postMessage
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    return new Response(`<html><body><script>
      window.opener?.postMessage({
        type: 'gmail-success',
        accessToken: '${tokens.access_token}',
        refreshToken: '${tokens.refresh_token}',
        expiresAt: '${expiresAt}',
        email: '${profile.emailAddress || ''}'
      }, '*');
      window.close();
    </script><p>¡Conectado! Puedes cerrar esta ventana.</p></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Callback error:', error);
    return new Response(`<html><body><script>window.opener?.postMessage({type:'gmail-error',error:'unknown'},'*');window.close();</script><p>Error. Puedes cerrar esta ventana.</p></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});
