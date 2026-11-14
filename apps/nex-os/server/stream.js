import { spawn } from 'child_process';
import { createRequire } from 'module';
import { existsSync } from 'fs';
import { resolve as pathResolve } from 'path';
import { Readable } from 'stream';

const require = createRequire(import.meta.url);

/** @type {Map<string, { url: string; expires: number; mimeType: string; title?: string; source?: string }>} */
const cache = new Map();
const CACHE_TTL_MS = 45 * 60 * 1000;

const PIPED_INSTANCES = ['https://api.piped.private.coffee'];

function findYtDlpBinary() {
  if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH;
  try {
    const ytdl = require('youtube-dl-exec');
    const fromConstants = ytdl?.constants?.YOUTUBE_DL_PATH;
    if (fromConstants) return fromConstants;
  } catch {
    /* ignore */
  }
  return null;
}

/** Clients that honor Netscape cookies (avoid ios — it ignores them). */
const DEFAULT_PLAYER_CLIENTS = 'web,mweb,tv,android';
const FALLBACK_PLAYER_CLIENTS = [
  'web,mweb',
  'mweb',
  'tv',
  'web',
];

/** Cookie / JS-runtime flags for YouTube bot walls. */
function ytDlpAuthArgs(playerClients) {
  const args = [];

  // Signature / n-challenge solver (required by recent yt-dlp)
  const jsRuntime = (process.env.YT_DLP_JS_RUNTIME || 'node').trim();
  if (jsRuntime && jsRuntime !== 'off') {
    args.push('--js-runtimes', jsRuntime);
  }

  const cookiesFile = (process.env.YT_DLP_COOKIES || '').trim();
  if (cookiesFile) {
    const candidates = [
      pathResolve(cookiesFile),
      pathResolve(process.cwd(), cookiesFile),
      pathResolve(process.cwd(), '..', cookiesFile),
    ];
    const abs = candidates.find((p) => existsSync(p));
    if (abs) {
      args.push('--cookies', abs);
    } else {
      console.warn('[stream] YT_DLP_COOKIES no existe:', cookiesFile);
    }
  } else {
    const fromBrowser = (process.env.YT_DLP_COOKIES_FROM_BROWSER || '').trim();
    if (fromBrowser) {
      // e.g. chrome, edge, brave, chromium — close the browser first on Windows
      args.push('--cookies-from-browser', fromBrowser);
    }
  }

  const extractorArgs = (process.env.YT_DLP_EXTRACTOR_ARGS || '').trim();
  if (extractorArgs) {
    args.push('--extractor-args', extractorArgs);
  } else {
    const clients = (playerClients || DEFAULT_PLAYER_CLIENTS).trim();
    if (clients) {
      args.push('--extractor-args', `youtube:player_client=${clients}`);
    }
  }

  return args;
}

function cookiesConfigured() {
  const file = (process.env.YT_DLP_COOKIES || '').trim();
  if (file) {
    const candidates = [
      pathResolve(file),
      pathResolve(process.cwd(), file),
      pathResolve(process.cwd(), '..', file),
    ];
    const abs = candidates.find((p) => existsSync(p));
    if (abs) return { mode: 'file', value: abs };
  }
  const browser = (process.env.YT_DLP_COOKIES_FROM_BROWSER || '').trim();
  if (browser) return { mode: 'browser', value: browser };
  return { mode: 'none', value: null };
}

function runYtDlp(args, timeoutMs = 35000) {
  return new Promise((resolve, reject) => {
    const bin = findYtDlpBinary() || 'yt-dlp';
    const child = spawn(bin, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('yt-dlp timeout'));
    }, timeoutMs);
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        // Keep enough of the traceback for cookie/bot debugging in Render logs + API
        reject(new Error(stderr.trim().slice(0, 1800) || `yt-dlp exit ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function isBotWallError(msg) {
  return /sign in to confirm|not a bot|cookies-from-browser|HTTP Error 429/i.test(msg);
}

/**
 * Resolve via Piped when yt-dlp is bot-walled (still proxied by our /audio route).
 * @param {string} videoId
 */
async function resolveFromPiped(videoId) {
  const errors = [];
  for (const base of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`${base.replace(/\/$/, '')}/streams/${encodeURIComponent(videoId)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!res.ok) {
        errors.push(`${base}:${res.status}`);
        continue;
      }
      const data = await res.json();
      const audios = (data.audioStreams || [])
        .filter((s) => s?.url && s.videoOnly !== true)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      if (audios[0]?.url) {
        return {
          url: audios[0].url,
          mimeType: audios[0].mimeType || 'audio/mp4',
          title: data.title || undefined,
          source: `piped:${base}`,
        };
      }
      const muxed = (data.videoStreams || []).find(
        (s) => s?.url && s.videoOnly === false && String(s.mimeType || '').includes('mp4'),
      );
      if (muxed?.url) {
        return {
          url: muxed.url,
          mimeType: muxed.mimeType || 'video/mp4',
          title: data.title || undefined,
          source: `piped:${base}`,
        };
      }
      errors.push(`${base}:empty`);
    } catch (err) {
      errors.push(`${base}:${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(errors.slice(0, 2).join(' | ') || 'piped fail');
}

/**
 * Resolve a direct audio media URL via yt-dlp (+ Piped fallback).
 * @param {string} videoId
 */
export async function resolveAudioUrl(videoId) {
  const cached = cache.get(videoId);
  if (cached && cached.expires > Date.now()) return cached;

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const customExtractor = Boolean((process.env.YT_DLP_EXTRACTOR_ARGS || '').trim());
  const clientAttempts = customExtractor
    ? [undefined]
    : [DEFAULT_PLAYER_CLIENTS, ...FALLBACK_PLAYER_CLIENTS];
  let lastErr = null;

  for (const clients of clientAttempts) {
    const auth = ytDlpAuthArgs(clients);
    try {
      const raw = await runYtDlp([
        ...auth,
        '-f',
        'ba/bestaudio/best',
        '-g',
        '--no-playlist',
        '--no-warnings',
        watchUrl,
      ]);
      const url = raw.split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith('http'));
      if (!url) throw new Error('yt-dlp no devolvió URL');

      let title;
      try {
        title = await runYtDlp(
          [...auth, '--print', '%(title)s', '--no-playlist', '--no-warnings', watchUrl],
          15000,
        );
      } catch {
        title = undefined;
      }

      const mimeType =
        url.includes('mime=audio%2Fwebm') || url.includes('webm') ? 'audio/webm' : 'audio/mp4';

      const entry = {
        url,
        mimeType,
        title: title || undefined,
        source: 'yt-dlp',
        expires: Date.now() + CACHE_TTL_MS,
      };
      cache.set(videoId, entry);
      if (clients && clients !== DEFAULT_PLAYER_CLIENTS) {
        console.log('[stream] yt-dlp OK via player_client=', clients, videoId);
      }
      return entry;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const bot = isBotWallError(lastErr.message);
      console.warn(
        '[stream] yt-dlp failed',
        videoId,
        clients ? `(${clients})` : '',
        lastErr.message.slice(0, 200),
      );
      if (!bot || customExtractor) break;
    }
  }

  try {
    const piped = await resolveFromPiped(videoId);
    const entry = {
      ...piped,
      expires: Date.now() + CACHE_TTL_MS,
    };
    cache.set(videoId, entry);
    console.log('[stream] fallback Piped OK', videoId, piped.source);
    return entry;
  } catch (pipedErr) {
    const pipedMsg = pipedErr instanceof Error ? pipedErr.message : String(pipedErr);
    const cookies = cookiesConfigured();
    const authHint =
      cookies.mode === 'none'
        ? ' Configurá YT_DLP_COOKIES (cookies.txt) o YT_DLP_COOKIES_FROM_BROWSER=chrome (cerrá Chrome antes).'
        : ' Cookies montadas pero YouTube las rechazó (sesión inválida/IP de datacenter). Reexportá con: yt-dlp --cookies-from-browser chrome --cookies youtube-cookies.txt --skip-download "https://www.youtube.com"';
    const bot = lastErr && isBotWallError(lastErr.message);
    const ytdlpBit = (lastErr?.message || 'fail').slice(0, 900);
    throw new Error(
      bot
        ? `YouTube bot-wall / 429.${authHint} yt-dlp: ${ytdlpBit} | piped: ${pipedMsg}`
        : `yt-dlp: ${ytdlpBit} | piped: ${pipedMsg}`,
    );
  }
}

export function ytDlpAvailable() {
  return new Promise((resolve) => {
    const bin = findYtDlpBinary() || 'yt-dlp';
    const child = spawn(bin, ['--version'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.on('error', () => resolve({ ok: false, bin, cookies: cookiesConfigured() }));
    child.on('close', (code) =>
      resolve({
        ok: code === 0,
        bin,
        version: out.trim() || null,
        cookies: cookiesConfigured(),
        jsRuntime: process.env.YT_DLP_JS_RUNTIME || 'node',
      }),
    );
  });
}

/**
 * Pipe upstream media to Express response with CORS + Range.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} upstreamUrl
 * @param {string} mimeType
 */
export async function proxyMedia(req, res, upstreamUrl, mimeType) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: '*/*',
  };
  if (req.headers.range) headers.Range = req.headers.range;

  const upstream = await fetch(upstreamUrl, { headers, redirect: 'follow' });
  if (!upstream.ok && upstream.status !== 206) {
    res.status(upstream.status).json({ error: 'Upstream media failed', status: upstream.status });
    return;
  }

  res.status(upstream.status);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
  res.setHeader('Content-Type', upstream.headers.get('content-type') || mimeType);
  const len = upstream.headers.get('content-length');
  if (len) res.setHeader('Content-Length', len);
  const cr = upstream.headers.get('content-range');
  if (cr) res.setHeader('Content-Range', cr);
  res.setHeader('Cache-Control', 'private, max-age=60');

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  if (!upstream.body) {
    res.end();
    return;
  }

  // Node 18+ fetch body → Web ReadableStream → Node Readable
  // @ts-expect-error undici stream
  const nodeStream = Readable.fromWeb(upstream.body);
  nodeStream.pipe(res);
  nodeStream.on('error', () => {
    try {
      res.destroy();
    } catch {
      /* ignore */
    }
  });
}

/**
 * @param {import('express').Express} app
 * @param {{ publicBase: string }} opts
 */
export function mountStreamRoutes(app, opts) {
  const publicBase = opts.publicBase.replace(/\/$/, '');

  app.options('/stream/:videoId', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Accept');
    res.status(204).end();
  });

  app.options('/stream/:videoId/audio', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Accept');
    res.status(204).end();
  });

  /** JSON resolve — browser points MediaElement at our CORS proxy. */
  app.get('/stream/:videoId', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const videoId = String(req.params.videoId || '').trim();
    if (!/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      res.status(400).json({ error: 'videoId inválido' });
      return;
    }
    try {
      const resolved = await resolveAudioUrl(videoId);
      res.json({
        url: `${publicBase}/stream/${videoId}/audio`,
        mimeType: resolved.mimeType,
        quality: 'bestaudio',
        kind: 'audio',
        title: resolved.title,
        source: resolved.source || 'yt-dlp',
      });
    } catch (err) {
      console.error('[stream] resolve failed', videoId, err);
      res.status(502).json({
        error: 'No se pudo resolver audio',
        detail: err instanceof Error ? err.message : String(err),
        hint:
          cookiesConfigured().mode === 'none'
            ? 'YouTube pide cookies. Exportá cookies.txt (extensión "Get cookies.txt LOCALLY") y poné YT_DLP_COOKIES=ruta\\al\\archivo.txt en .env.local, o cerrá Chrome y usá YT_DLP_COOKIES_FROM_BROWSER=chrome'
            : undefined,
      });
    }
  });

  app.get('/stream/:videoId/audio', async (req, res) => {
    const videoId = String(req.params.videoId || '').trim();
    if (!/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      res.status(400).json({ error: 'videoId inválido' });
      return;
    }
    try {
      const resolved = await resolveAudioUrl(videoId);
      await proxyMedia(req, res, resolved.url, resolved.mimeType);
    } catch (err) {
      console.error('[stream] proxy failed', videoId, err);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Proxy de audio falló',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });
}
