/**
 * GET /api/spotify/search?q=...
 */

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

let accessToken = null;
let tokenExpiresAt = 0;

const requestLog = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > MAX_REQUESTS;
}

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured');
  }

  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authHeader}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to get Spotify access token');
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000;
  return accessToken;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Demasiadas búsquedas, esperá un momento.' });
  }

  const query = (Array.isArray(req.query.q) ? req.query.q[0] : req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Falta el parámetro de búsqueda "q"' });
  }
  if (query.length > 100) {
    return res.status(400).json({ error: 'Búsqueda demasiado larga' });
  }

  try {
    const token = await getSpotifyAccessToken();
    const params = new URLSearchParams({ q: query, type: 'track', limit: '10', market: 'AR' });
    const spotifyResponse = await fetch(`${SPOTIFY_API_BASE}/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!spotifyResponse.ok) {
      const errBody = await spotifyResponse.text();
      console.error('Spotify search:', spotifyResponse.status, errBody);
      return res.status(502).json({ error: 'No se pudo completar la búsqueda' });
    }

    const data = await spotifyResponse.json();
    const results = (data.tracks?.items || []).map((item) => ({
      id: item.id,
      title: item.name,
      artist: (item.artists || []).map((a) => a.name).join(', '),
      album: item.album?.name || '',
      thumbnail: item.album?.images?.[0]?.url || '',
      duration: item.duration_ms,
      uri: item.uri,
      service: 'spotify',
    }));

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(200).json({ results });
  } catch (err) {
    console.error('Error consultando Spotify:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Error interno al buscar',
    });
  }
}
