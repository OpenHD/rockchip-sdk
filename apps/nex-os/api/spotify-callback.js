/**
 * GET /api/spotify-callback?code=...&state=...
 * Intercambia el code por tokens y guarda cookie httpOnly.
 */

function getRedirectUri(req) {
  if (process.env.SPOTIFY_REDIRECT_URI) return process.env.SPOTIFY_REDIRECT_URI;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/spotify-callback`;
}

function cookieOptions(maxAge) {
  return [
    `Path=/`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ].join('; ');
}

export default async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(503).send('Spotify credentials missing');
  }

  const { code, state, error } = req.query;
  let returnTo = '/nex-music';

  try {
    if (state) {
      const parsed = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));
      if (parsed.returnTo) returnTo = String(parsed.returnTo);
    }
  } catch {}

  if (error) {
    res.writeHead(302, { Location: `${returnTo}?spotify=error` });
    return res.end();
  }

  if (!code) {
    res.writeHead(302, { Location: `${returnTo}?spotify=missing_code` });
    return res.end();
  }

  try {
    const redirectUri = getRedirectUri(req);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body,
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('spotify token exchange', tokenData);
      res.writeHead(302, { Location: `${returnTo}?spotify=token_error` });
      return res.end();
    }

    const payload = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000 - 60_000,
    };

    const cookieValue = Buffer.from(JSON.stringify(payload)).toString('base64url');
    res.setHeader('Set-Cookie', [
      `nex_spotify_session=${cookieValue}; ${cookieOptions(60 * 60 * 24 * 30)}`,
    ]);
    res.writeHead(302, { Location: `${returnTo}?spotify=connected` });
    res.end();
  } catch (err) {
    console.error('spotify-callback', err);
    res.writeHead(302, { Location: `${returnTo}?spotify=error` });
    res.end();
  }
}
