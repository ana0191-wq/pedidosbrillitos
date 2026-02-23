import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Decode state
    let returnUrl = '';
    let userId = '';
    try {
      if (stateParam) {
        const stateData = JSON.parse(atob(stateParam));
        returnUrl = stateData.returnUrl || '';
        userId = stateData.userId || '';
      }
    } catch {
      console.error('Failed to decode state');
    }

    // Default returnUrl fallback
    if (!returnUrl) returnUrl = 'https://lovable.dev';

    if (error) {
      const msg = error === 'access_denied' 
        ? 'Acceso denegado' 
        : `Error: ${error}`;
      const redirectTo = `${returnUrl}?gmail_error=${encodeURIComponent(msg)}`;
      return Response.redirect(redirectTo, 302);
    }

    if (!code) {
      const redirectTo = `${returnUrl}?gmail_error=${encodeURIComponent('No se recibió código de autorización')}`;
      return Response.redirect(redirectTo, 302);
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      const redirectTo = `${returnUrl}?gmail_error=${encodeURIComponent('Faltan credenciales de Google')}`;
      return Response.redirect(redirectTo, 302);
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-callback`;

    console.log('Exchanging code for tokens...');

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
      console.error('Token exchange failed:', JSON.stringify(tokens));
      let userMessage = 'Error al obtener tokens de Google.';
      if (tokens.error === 'invalid_grant') {
        userMessage = 'El código expiró. Intenta conectar de nuevo.';
      } else if (tokens.error === 'invalid_client') {
        userMessage = 'Credenciales inválidas.';
      }
      const redirectTo = `${returnUrl}?gmail_error=${encodeURIComponent(userMessage)}`;
      return Response.redirect(redirectTo, 302);
    }

    // Get user email
    const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    const email = profile.emailAddress || '';
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    console.log('Gmail connected for:', email);

    // Store tokens server-side using service role
    if (userId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { error: dbError } = await supabase.from('gmail_tokens').upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '',
        expires_at: expiresAt,
        email,
      }, { onConflict: 'user_id' });

      if (dbError) {
        console.error('DB error:', dbError);
        const redirectTo = `${returnUrl}?gmail_error=${encodeURIComponent('Error al guardar tokens')}`;
        return Response.redirect(redirectTo, 302);
      }
    }

    // Redirect back to app with success
    const redirectTo = `${returnUrl}?gmail_success=true&gmail_email=${encodeURIComponent(email)}`;
    return Response.redirect(redirectTo, 302);

  } catch (error) {
    console.error('Callback error:', error);
    return new Response(`<html><body><p>Error inesperado. Puedes cerrar esta ventana.</p></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});
