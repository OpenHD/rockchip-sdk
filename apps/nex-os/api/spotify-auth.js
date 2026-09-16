/**
 * GET /api/spotify-auth
 * Inicia OAuth de Spotify (Authorization Code).
 * Query: ?returnTo=/nex-music
 */

function getRedirectUri(req) {
  if (process.env.SPOTIFY_REDIRECT_URI) return process.env.SPOTIFY_REDIRECT_URI;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/spotify-callback`;
}

export default async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: 'Falta SPOTIFY_CLIENT_ID en Vercel' });
  }

  const returnTo = String(req.query.returnTo || '/nex-music');
  const state = Buffer.from(JSON.stringify({ returnTo, t: Date.now() })).toString('base64url');
  const redirectUri = getRedirectUri(req);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'playlist-read-private playlist-read-collaborative',
    state,
    show_dialog: 'false',
  });

  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, {
    Location: `https://accounts.spotify.com/authorize?${params}`,
  });
  res.end();
}
