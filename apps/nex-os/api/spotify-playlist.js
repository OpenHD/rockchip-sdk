/**
 * GET /api/spotify-playlist?id=... | ?url=...
 * Requiere sesión OAuth (cookie nex_spotify_session).
 * Spotify (feb 2026+) solo permite leer items de playlists propias/colaborativas.
 */

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const MAX_TRACKS = 500;
const PAGE_SIZE = 100;

function parsePlaylistId(raw) {
  const input = String(raw || '').trim();
  if (!input) return null;
  if (/^[a-zA-Z0-9]{10,30}$/.test(input)) return input;
  try {
    const url = new URL(input);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('playlist');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].split('?')[0];
  } catch {}
  const uriMatch = input.match(/^spotify:playlist:([a-zA-Z0-9]+)$/i);
  return uriMatch ? uriMatch[1] : null;
}

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

function setSessionCookie(res, session) {
  const cookieValue = Buffer.from(JSON.stringify(session)).toString('base64url');
  res.setHeader(
    'Set-Cookie',
    `nex_spotify_session=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
  );
}

async function refreshAccessToken(refreshToken) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body,
  });
  const data = await tokenRes.json();
  if (!tokenRes.ok || !data.access_token) {
    throw new Error('SESSION_EXPIRED');
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000 - 60_000,
  };
}

async function getUserAccessToken(req, res) {
  let session = readSession(req);
  if (!session?.access_token) {
    throw new Error('NOT_CONNECTED');
  }

  if (session.expires_at && Date.now() > session.expires_at) {
    if (!session.refresh_token) throw new Error('SESSION_EXPIRED');
    session = await refreshAccessToken(session.refresh_token);
    setSessionCookie(res, session);
  }

  return session.access_token;
}

function mapTrackItem(entry, fallbackCover) {
  const track = entry?.item || entry?.track;
  if (!track || !track.id) return null;
  return {
    id: track.id,
    title: track.name,
    artist: (track.artists || []).map((a) => a.name).join(', '),
    cover:
      (track.album && track.album.images && track.album.images[0] && track.album.images[0].url) ||
      fallbackCover ||
      '',
    duration: track.duration_ms,
    uri: track.uri,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  if (req.query.debug === '1') {
    const session = readSession(req);
    return res.status(200).json({
      ok: true,
      hasClientId: Boolean(process.env.SPOTIFY_CLIENT_ID),
      hasClientSecret: Boolean(process.env.SPOTIFY_CLIENT_SECRET),
      connected: Boolean(session?.access_token),
    });
  }

  const idParam = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const urlParam = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  const playlistId = parsePlaylistId(idParam || urlParam || '');

  if (!playlistId) {
    return res.status(400).json({
      error: 'URL o ID de playlist inválido. Ej: https://open.spotify.com/playlist/...',
    });
  }

  try {
    const token = await getUserAccessToken(req, res);

    const metaRes = await fetch(`${SPOTIFY_API_BASE}/playlists/${encodeURIComponent(playlistId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!metaRes.ok) {
      const body = await metaRes.text();
      return res.status(502).json({
        error:
          metaRes.status === 404
            ? 'Playlist no encontrada'
            : metaRes.status === 403
              ? 'Sin permiso. Conectá Spotify y usá una playlist tuya o colaborativa.'
              : `Spotify respondió ${metaRes.status}`,
        details: body.slice(0, 200),
      });
    }

    const meta = await metaRes.json();
    const cover = (meta.images && meta.images[0] && meta.images[0].url) || '';
    const tracks = [];
    let offset = 0;
    let pagesOk = 0;

    while (tracks.length < MAX_TRACKS) {
      const itemsRes = await fetch(
        `${SPOTIFY_API_BASE}/playlists/${encodeURIComponent(playlistId)}/items?limit=${PAGE_SIZE}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (itemsRes.status === 403) {
        return res.status(403).json({
          error:
            'Spotify solo permite importar playlists que vos creaste o donde colaborás. Conectá tu cuenta y usá una lista tuya.',
          needsSpotifyAuth: true,
          playlistId,
          name: meta.name,
        });
      }

      if (!itemsRes.ok) {
        // Fallback: endpoint viejo /tracks por compatibilidad
        const legacyRes = await fetch(
          `${SPOTIFY_API_BASE}/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${PAGE_SIZE}&offset=${offset}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!legacyRes.ok) {
          const body = await itemsRes.text();
          return res.status(502).json({
            error: `No se pudieron leer las canciones (${itemsRes.status})`,
            details: body.slice(0, 200),
            needsSpotifyAuth: itemsRes.status === 401,
          });
        }
        const legacyPage = await legacyRes.json();
        pagesOk += 1;
        for (const entry of legacyPage.items || []) {
          const mapped = mapTrackItem(entry, cover);
          if (mapped) tracks.push(mapped);
          if (tracks.length >= MAX_TRACKS) break;
        }
        if (!legacyPage.next || !(legacyPage.items || []).length) break;
        offset += PAGE_SIZE;
        continue;
      }

      const page = await itemsRes.json();
      pagesOk += 1;
      for (const entry of page.items || []) {
        const mapped = mapTrackItem(entry, cover);
        if (mapped) tracks.push(mapped);
        if (tracks.length >= MAX_TRACKS) break;
      }
      if (!page.next || !(page.items || []).length) break;
      offset += PAGE_SIZE;
    }

    if (tracks.length === 0) {
      return res.status(502).json({
        error:
          pagesOk === 0
            ? 'No se pudieron leer las canciones. Conectá Spotify e intentá de nuevo.'
            : 'La playlist no tiene canciones disponibles',
        needsSpotifyAuth: true,
        playlistId,
        name: meta.name,
      });
    }

    return res.status(200).json({
      id: playlistId,
      name: meta.name,
      cover: cover || tracks[0].cover || '',
      trackCount: tracks.length,
      importedCount: tracks.length,
      truncated: false,
      tracks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'NOT_CONNECTED' || message === 'SESSION_EXPIRED') {
      return res.status(401).json({
        error: 'Conectá tu cuenta de Spotify para importar playlists',
        needsSpotifyAuth: true,
      });
    }
    console.error('spotify-playlist', err);
    return res.status(500).json({ error: message });
  }
}
