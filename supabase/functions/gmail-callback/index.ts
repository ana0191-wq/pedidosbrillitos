Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // returnUrl
    const error = url.searchParams.get('error');

    if (error) {
      const errorMsg = error === 'access_denied' 
        ? 'Acceso denegado. Asegúrate de aceptar los permisos de Gmail.'
        : `Error de Google: ${error}`;
      return new Response(`<html><body><script>window.opener?.postMessage({type:'gmail-error',error:'${error}',message:'${errorMsg}'},'*');setTimeout(()=>window.close(),3000);</script><p>${errorMsg}</p><p>Puedes cerrar esta ventana.</p></body></html>`, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!code) {
      return new Response('<html><body><script>window.opener?.postMessage({type:"gmail-error",error:"no_code",message:"No se recibió código de autorización"},"*");setTimeout(()=>window.close(),3000);</script><p>Error: No se recibió código. Puedes cerrar esta ventana.</p></body></html>', {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return new Response('<html><body><script>window.opener?.postMessage({type:"gmail-error",error:"config_error",message:"Faltan credenciales de Google. Contacta al administrador."},"*");setTimeout(()=>window.close(),3000);</script><p>Error de configuración. Puedes cerrar esta ventana.</p></body></html>', {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-callback`;

    console.log('Exchanging code for tokens...');
    console.log('Redirect URI:', redirectUri);

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
        userMessage = 'El código de autorización expiró. Por favor intenta conectar de nuevo.';
      } else if (tokens.error === 'invalid_client') {
        userMessage = 'Credenciales de Google inválidas. Contacta al administrador.';
      } else if (tokens.error === 'redirect_uri_mismatch') {
        userMessage = 'Error de configuración de URI. Contacta al administrador.';
      }

      return new Response(`<html><body><script>window.opener?.postMessage({type:'gmail-error',error:'${tokens.error}',message:'${userMessage}'},'*');setTimeout(()=>window.close(),3000);</script><p>${userMessage}</p><p>Puedes cerrar esta ventana.</p></body></html>`, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Get user email from Gmail
    const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const email = profile.emailAddress || '';

    console.log('Gmail connected successfully for:', email);

    // Use JSON.stringify to safely pass data
    return new Response(`<html><body><script>
      try {
        window.opener?.postMessage({
          type: 'gmail-success',
          accessToken: ${JSON.stringify(tokens.access_token)},
          refreshToken: ${JSON.stringify(tokens.refresh_token || '')},
          expiresAt: ${JSON.stringify(expiresAt)},
          email: ${JSON.stringify(email)}
        }, '*');
        setTimeout(() => window.close(), 1500);
      } catch(e) {
        document.body.innerHTML = '<p>Conectado! Puedes cerrar esta ventana manualmente.</p>';
      }
    </script><p>¡Conectado! Esta ventana se cerrará automáticamente...</p></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Callback error:', error);
    return new Response(`<html><body><script>window.opener?.postMessage({type:'gmail-error',error:'unknown',message:'Error inesperado. Intenta de nuevo.'},'*');setTimeout(()=>window.close(),3000);</script><p>Error inesperado. Puedes cerrar esta ventana.</p></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});
