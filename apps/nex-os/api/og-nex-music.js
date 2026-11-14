/**
 * GET /share?room=CODE | /share?cloud=UUID | /p/:code | /api/og-nex-music?...
 * Also: /api/og-nex-music?img=1&title=&subtitle=&kind=  → SVG OG image
 * (merged to stay under Hobby's 12-function limit)
 * Serves Open Graph HTML for social crawlers; redirects humans to /nex-music.
 */

const BOT_UA =
  /bot|crawl|slurp|spider|facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|Discordbot|LinkedInBot|SkypeUriPreview|Slackbot|vkShare|W3C_Validator|redditbot|Applebot/i;

function isBot(ua = '') {
  return BOT_UA.test(ua);
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function appBase(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'anex-os.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function ogSvg({ title, subtitle, kind }) {
  const safeTitle = escapeHtml((title || 'NEX Music').toString().slice(0, 60));
  const safeSubtitle = escapeHtml((subtitle || 'Escuchá juntos').toString().slice(0, 80));
  const accent = kind === 'room' ? '#60cdff' : '#1db954';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050505"/>
      <stop offset="100%" stop-color="#0d1f14"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1040" cy="120" r="220" fill="${accent}" fill-opacity="0.18"/>
  <circle cx="160" cy="520" r="180" fill="${accent}" fill-opacity="0.12"/>
  <text x="80" y="120" fill="${accent}" font-family="Arial, sans-serif" font-size="36" font-weight="700">NEX MUSIC</text>
  <text x="80" y="300" fill="#ffffff" font-family="Arial, sans-serif" font-size="64" font-weight="800">${safeTitle}</text>
  <text x="80" y="380" fill="rgba(255,255,255,0.7)" font-family="Arial, sans-serif" font-size="32">${safeSubtitle}</text>
  <text x="80" y="560" fill="rgba(255,255,255,0.45)" font-family="Arial, sans-serif" font-size="24">anex-os.vercel.app/nex-music</text>
</svg>`;
}

function ogImageUrl(base, title, subtitle, kind = 'playlist') {
  return `${base}/api/og-nex-music?img=1&title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(subtitle)}&kind=${encodeURIComponent(kind)}`;
}

async function supabaseCreds() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPBASE_URL;
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPBASE_PUBLISHABLE_KEY;
  return { url, key };
}

async function fetchCloudMeta(id) {
  const { url, key } = await supabaseCreds();
  if (!url || !key || !id) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/global_playlists?id=eq.${encodeURIComponent(id)}&select=name,cover,owner_nickname`,
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
  } catch {
    return null;
  }
}

async function fetchShortShareMeta(code) {
  const { url, key } = await supabaseCreds();
  if (!url || !key || !code) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/playlist_shares?code=eq.${encodeURIComponent(code)}&select=name,cover,owner_nickname&limit=1`,
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
  } catch {
    return null;
  }
}

function ogHtml({ title, description, image, url, redirect }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);
  const safeRedirect = escapeHtml(redirect);
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="NEX Music" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeImage}" />
  <meta http-equiv="refresh" content="0;url=${safeRedirect}" />
  <link rel="canonical" href="${safeRedirect}" />
</head>
<body style="margin:0;background:#020208;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <p>Abriendo NEX Music… <a href="${safeRedirect}" style="color:#1db954">Continuar</a></p>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // SVG OG image mode (replaces former /api/og-image)
  if (req.query.img === '1' || req.query.img === 'true') {
    const svg = ogSvg({
      title: req.query.title,
      subtitle: req.query.subtitle,
      kind: req.query.kind,
    });
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(svg);
  }

  const base = appBase(req);
  const room = typeof req.query.room === 'string' ? req.query.room.trim().toUpperCase() : '';
  const cloud = typeof req.query.cloud === 'string' ? req.query.cloud.trim() : '';
  const shortCode =
    (typeof req.query.p === 'string' && req.query.p.trim()) ||
    (typeof req.query.code === 'string' && req.query.code.trim()) ||
    '';

  let title = 'NEX Music';
  let description = 'Escuchá juntos · YouTube + Spotify · salas en vivo y listas globales.';
  let image = ogImageUrl(base, 'NEX Music', 'Escuchá juntos', 'playlist');
  let appTarget = `${base}/nex-music`;

  if (room && /^[A-Z0-9]{4,6}$/.test(room)) {
    title = `Unite a mi sala ${room} · NEX Music`;
    description = `Escuchá en vivo conmigo en NEX Music. Código: ${room}`;
    appTarget = `${base}/nex-music?room=${encodeURIComponent(room)}`;
    image = ogImageUrl(base, `Sala ${room}`, 'Unite en un tap', 'room');
  } else if (shortCode && /^[A-Za-z0-9]{6,12}$/.test(shortCode)) {
    const meta = await fetchShortShareMeta(shortCode);
    if (meta?.name) {
      title = `${meta.name} · NEX Music`;
      description = meta.owner_nickname
        ? `Lista de ${meta.owner_nickname} en NEX Music. Tocá para escuchar.`
        : 'Lista compartida en NEX Music. Tocá para escuchar.';
      image = meta.cover
        || ogImageUrl(base, meta.name, meta.owner_nickname || 'Lista compartida', 'playlist');
    } else {
      title = 'Lista compartida · NEX Music';
      description = 'Abrí esta lista en NEX Music y escuchá al toque.';
    }
    appTarget = `${base}/nex-music?p=${encodeURIComponent(shortCode)}`;
  } else if (cloud) {
    const meta = await fetchCloudMeta(cloud);
    if (meta?.name) {
      title = `${meta.name} · NEX Music`;
      description = meta.owner_nickname
        ? `Lista de ${meta.owner_nickname} en NEX Music. Tocá para escuchar.`
        : 'Lista compartida en NEX Music. Tocá para escuchar.';
      image = meta.cover
        || ogImageUrl(base, meta.name, meta.owner_nickname || 'Lista', 'playlist');
    } else {
      title = 'Lista compartida · NEX Music';
      description = 'Abrí esta lista en NEX Music y escuchá al toque.';
    }
    appTarget = `${base}/nex-music?cloud=${encodeURIComponent(cloud)}`;
  }

  const shareUrl =
    shortCode && /^[A-Za-z0-9]{6,12}$/.test(shortCode)
      ? `${base}/p/${shortCode}`
      : `${base}/share${req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;

  if (!isBot(req.headers['user-agent'] || '')) {
    res.writeHead(302, { Location: appTarget, 'Cache-Control': 'public, max-age=60' });
    return res.end();
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send(
    ogHtml({
      title,
      description,
      image,
      url: shareUrl,
      redirect: appTarget,
    }),
  );
}
