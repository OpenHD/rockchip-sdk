export type SlidesMode = 'embed' | 'present';

export interface ResolvedUrl {
  /** URL shown in the address bar */
  displayUrl: string;
  /** URL loaded inside the iframe */
  iframeUrl: string;
  /** Human-readable page title hint */
  titleHint: string;
  contentType: 'slides' | 'docs' | 'sheets' | 'youtube' | 'generic';
  slidesMode?: SlidesMode;
  /**
   * true cuando displayUrl es un dominio de YouTube pero NO apunta a un
   * video/short/playlist concreto (ej: la home, /results de búsqueda).
   * BrowserApp usa esto para mostrar el buscador propio en vez de intentar
   * embeber la página de YouTube (que está bloqueada para iframes).
   */
  needsYoutubeSearch?: boolean;
}

const SLIDES_ID_RE = /docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;
const DOCS_ID_RE = /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;
const SHEETS_ID_RE = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;

// Soporta: youtube.com/watch?v=ID, youtu.be/ID, m.youtube.com/watch?v=ID,
// youtube.com/shorts/ID, youtube.com/embed/ID, youtube.com/live/ID,
// con o sin www., y parámetro opcional de tiempo (t= o start=).
const YOUTUBE_VIDEO_RE =
  /(?:m\.|www\.)?youtu(?:be\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|\.be\/)([a-zA-Z0-9_-]{6,})/;
const YOUTUBE_PLAYLIST_RE = /youtube\.com\/playlist\?(?:.*&)?list=([a-zA-Z0-9_-]+)/;
const YOUTUBE_DOMAIN_RE = /(?:^|\/\/)(?:www\.|m\.)?youtu(?:be\.com|\.be)/;

function parseTimeParam(url: string): number | undefined {
  const match = url.match(/[?&](?:t|start)=([0-9hms]+)/);
  if (!match) return undefined;
  const value = match[1];
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  const parts = value.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!parts) return undefined;
  const [, h, m, s] = parts;
  if (!h && !m && !s) return undefined;
  return (parseInt(h || '0', 10) * 3600) + (parseInt(m || '0', 10) * 60) + parseInt(s || '0', 10);
}

function normalizeInput(raw: string): string {
  const input = raw.trim();
  if (!input) return '';

  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }

  if (/^(?!-)[A-Za-z0-9-]+(\.[a-z0-9]+)+\.[A-Za-z]{2,}(:[0-9]{1,5})?(\/.*)?$/.test(input)) {
    return `https://${input}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(input)}&igu=1`;
}

function slidesUrls(id: string, mode: SlidesMode): { iframeUrl: string; titleHint: string } {
  if (mode === 'present') {
    return {
      iframeUrl: `https://docs.google.com/presentation/d/${id}/present?rm=minimal`,
      titleHint: 'Google Slides — Presentación',
    };
  }
  return {
    iframeUrl: `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&delayms=3000`,
    titleHint: 'Google Slides',
  };
}

/** Resolve a raw address into display + iframe URLs. */
export function resolveBrowserUrl(raw: string, options?: { slidesMode?: SlidesMode }): ResolvedUrl {
  const displayUrl = normalizeInput(raw);
  const slidesMode = options?.slidesMode ?? 'embed';

  if (!displayUrl) {
    return { displayUrl: '', iframeUrl: '', titleHint: 'Nueva pestaña', contentType: 'generic' };
  }

  // Video o short puntual -> sí se puede embeber, vía youtube-nocookie.com
  const ytMatch = displayUrl.match(YOUTUBE_VIDEO_RE);
  if (ytMatch) {
    const startSeconds = parseTimeParam(displayUrl);
    const params = new URLSearchParams({ rel: '0', modestbranding: '1', enablejsapi: '1' });
    if (startSeconds) params.set('start', String(startSeconds));
    return {
      displayUrl,
      iframeUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?${params.toString()}`,
      titleHint: 'YouTube',
      contentType: 'youtube',
    };
  }

  // Playlist puntual
  const ytPlaylistMatch = displayUrl.match(YOUTUBE_PLAYLIST_RE);
  if (ytPlaylistMatch) {
    return {
      displayUrl,
      iframeUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${ytPlaylistMatch[1]}&rel=0&modestbranding=1&enablejsapi=1`,
      titleHint: 'YouTube — Lista de reproducción',
      contentType: 'youtube',
    };
  }

  // Dominio de YouTube sin video/playlist específico (home, /results, canal, etc.)
  // No se puede embeber: BrowserApp debe mostrar el buscador propio en este caso.
  if (YOUTUBE_DOMAIN_RE.test(displayUrl)) {
    return {
      displayUrl,
      iframeUrl: '',
      titleHint: 'YouTube',
      contentType: 'youtube',
      needsYoutubeSearch: true,
    };
  }

  const slidesMatch = displayUrl.match(SLIDES_ID_RE);
  if (slidesMatch) {
    const canonical = `https://docs.google.com/presentation/d/${slidesMatch[1]}/edit`;
    const { iframeUrl, titleHint } = slidesUrls(slidesMatch[1], slidesMode);
    return {
      displayUrl: canonical,
      iframeUrl,
      titleHint,
      contentType: 'slides',
      slidesMode,
    };
  }

  const docsMatch = displayUrl.match(DOCS_ID_RE);
  if (docsMatch) {
    const id = docsMatch[1];
    return {
      displayUrl: `https://docs.google.com/document/d/${id}/edit`,
      iframeUrl: `https://docs.google.com/document/d/${id}/preview`,
      titleHint: 'Google Docs',
      contentType: 'docs',
    };
  }

  const sheetsMatch = displayUrl.match(SHEETS_ID_RE);
  if (sheetsMatch) {
    const id = sheetsMatch[1];
    return {
      displayUrl: `https://docs.google.com/spreadsheets/d/${id}/edit`,
      iframeUrl: `https://docs.google.com/spreadsheets/d/${id}/preview?rm=minimal`,
      titleHint: 'Google Sheets',
      contentType: 'sheets',
    };
  }

  try {
    const hostname = new URL(displayUrl).hostname.replace(/^www\./, '');
    return {
      displayUrl,
      iframeUrl: displayUrl,
      titleHint: hostname,
      contentType: 'generic',
    };
  } catch {
    return {
      displayUrl,
      iframeUrl: displayUrl,
      titleHint: 'Página web',
      contentType: 'generic',
    };
  }
}

export function isGoogleSlides(url: string): boolean {
  return SLIDES_ID_RE.test(url);
}

export function isYouTube(url: string): boolean {
  return YOUTUBE_DOMAIN_RE.test(url);
}

export function getSlidesPresentUrl(url: string): string | null {
  const match = url.match(SLIDES_ID_RE);
  if (!match) return null;
  return `https://docs.google.com/presentation/d/${match[1]}/present?rm=minimal`;
}

export function getSlidesEmbedUrl(url: string): string | null {
  const match = url.match(SLIDES_ID_RE);
  if (!match) return null;
  return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
}

const BLOCKED_SITES = [
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'steamcommunity.com',
  'counter-strike.net',
];

export function isBlockedByIframe(url: string): boolean {
  if (!url) return false;
  // YouTube nunca se marca "bloqueado": para videos puntuales se resuelve
  // con youtube-nocookie.com en resolveBrowserUrl; para la home/búsqueda,
  // BrowserApp muestra el buscador propio en vez de esta pantalla.
  if (isYouTube(url)) return false;
  const lower = url.toLowerCase();
  return BLOCKED_SITES.some((site) => lower.includes(site));
}

export function getFavicon(url: string): string | null {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}