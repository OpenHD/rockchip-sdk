/**
 * POST /api/playlist-share — crea un link corto
 * GET  /api/playlist-share?code=xxxx — recupera la playlist
 *
 * Requiere tabla public.playlist_shares (supabase/schema-playlist-shares.sql)
 */

function supabaseEnv() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPBASE_URL;
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPBASE_PUBLISHABLE_KEY;
  return { url, key };
}

function makeCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function compactTracks(tracks) {
  if (!Array.isArray(tracks)) return [];
  return tracks.slice(0, 200).map((t) => ({
    id: String(t.id ?? ''),
    title: String(t.title ?? ''),
    artist: String(t.artist ?? ''),
    cover: String(t.cover ?? ''),
    videoId: t.videoId ? String(t.videoId) : undefined,
    service: t.service || undefined,
  }));
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

async function insertShare(url, key, row) {
  const res = await fetch(`${url}/rest/v1/playlist_shares`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function fetchShare(url, key, code) {
  const res = await fetch(
    `${url}/rest/v1/playlist_shares?code=eq.${encodeURIComponent(code)}&select=code,name,cover,tracks,owner_nickname,created_at,open_count&limit=1`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function appBase(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'anex-os.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { url, key } = supabaseEnv();
  if (!url || !key) {
    return res.status(503).json({
      error: 'Supabase no configurado en el servidor',
    });
  }

  if (req.method === 'GET') {
    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    if (!/^[A-Za-z0-9]{6,12}$/.test(code)) {
      return res.status(400).json({ error: 'Código inválido' });
    }
    const row = await fetchShare(url, key, code);
    if (!row) return res.status(404).json({ error: 'Link no encontrado o expirado' });

    // Best-effort open counter
    try {
      await fetch(
        `${url}/rest/v1/rpc/increment_share_opens`,
        {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ share_code: code }),
        },
      ).catch(() => null);
      // Fallback patch if RPC missing
      await fetch(
        `${url}/rest/v1/playlist_shares?code=eq.${encodeURIComponent(code)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ open_count: (row.open_count || 0) + 1 }),
        },
      ).catch(() => null);
    } catch { /* ignore */ }

    return res.status(200).json({
      code: row.code,
      name: row.name,
      cover: row.cover,
      tracks: row.tracks,
      ownerName: row.owner_nickname,
      createdAt: row.created_at,
      openCount: (row.open_count || 0) + 1,
    });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'JSON inválido' });
      }
    }

    const name = String(body?.name || '').trim().slice(0, 120);
    const tracks = compactTracks(body?.tracks);
    const ownerName = String(body?.ownerName || body?.owner_nickname || 'Anonymous').slice(0, 48);
    const cover = body?.cover ? String(body.cover).slice(0, 500) : tracks[0]?.cover || null;

    if (!name || tracks.length === 0) {
      return res.status(400).json({ error: 'La lista necesita nombre y canciones' });
    }

    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = makeCode(8);
      const { ok, status, data } = await insertShare(url, key, {
        code,
        name,
        cover,
        tracks,
        owner_nickname: ownerName,
      });

      if (ok) {
        const base = appBase(req);
        return res.status(201).json({
          code,
          url: `${base}/p/${code}`,
          shareUrl: `${base}/share?p=${code}`,
        });
      }

      lastError = { status, data };
      // unique violation → retry new code
      if (status !== 409 && status !== 23505) break;
    }

    const msg =
      typeof lastError?.data === 'object' && lastError?.data?.message
        ? lastError.data.message
        : 'No se pudo crear el link corto. Ejecutá schema-playlist-shares.sql en Supabase.';

    return res.status(502).json({ error: msg, detail: lastError });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
