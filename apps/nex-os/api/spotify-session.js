/**
 * GET /api/spotify-session
 * Estado de la sesión Spotify del usuario.
 */

function readSession(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(/(?:^|;\s*)nex_spotify_session=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'DELETE') {
    res.setHeader(
      'Set-Cookie',
      'nex_spotify_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    );
    return res.status(200).json({ connected: false });
  }

  const session = readSession(req);
  if (!session?.access_token) {
    return res.status(200).json({ connected: false });
  }

  const expired = session.expires_at && Date.now() > session.expires_at;
  return res.status(200).json({
    connected: true,
    expired: Boolean(expired),
  });
}
