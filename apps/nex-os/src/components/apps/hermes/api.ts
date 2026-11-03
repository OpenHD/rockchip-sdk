/**
 * Hermes API Client
 * Communicates with the local Hermes backend (default: http://localhost:9119)
 * Port can be overridden via VITE_HERMES_URL env var.
 *
 * Authentication: Hermes injects a session token into its own index.html.
 * We scrape that token and attach it to every /api/ request.
 */

// Use the Vite proxy to avoid CORS issues
const RAW_URL = '/hermes';
// Strip trailing slashes
export const HERMES_BASE = RAW_URL;

// ─── Session Token ────────────────────────────────────────────────────────────
// Hermes injects `window.__HERMES_SESSION_TOKEN__ = "..."` into index.html.
// We fetch that page, extract the token, and cache it for all subsequent calls.

let _sessionToken: string | null = null;
let _tokenFetchPromise: Promise<string | null> | null = null;

const TOKEN_RE = /window\.__HERMES_SESSION_TOKEN__\s*=\s*"([^"]+)"/;

async function fetchSessionToken(): Promise<string | null> {
  if (_sessionToken) return _sessionToken;
  if (_tokenFetchPromise) return _tokenFetchPromise;

  _tokenFetchPromise = (async () => {
    try {
      const res = await fetch(`${HERMES_BASE}/`, {
        headers: { accept: 'text/html' },
        signal: AbortSignal.timeout(4000),
      });
      const html = await res.text();
      const match = html.match(TOKEN_RE);
      if (match) {
        _sessionToken = match[1];
        return _sessionToken;
      }
    } catch {
      // Hermes not running or unreachable
    }
    return null;
  })();

  return _tokenFetchPromise;
}

/** Invalidate the cached token (e.g. after a 401) */
function invalidateToken() {
  _sessionToken = null;
  _tokenFetchPromise = null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatusResponse {
  status: string;
  version?: string;
  model?: string;
  provider?: string;
  profile?: string;
  gateway?: {
    status: string;
    platforms?: string[];
  };
  uptime_seconds?: number;
  active_sessions?: number;
}

export interface SessionInfo {
  id: string;
  title?: string | null;
  preview?: string | null;
  model?: string | null;
  source?: string | null;
  message_count: number;
  tool_call_count: number;
  last_active: string;
  is_active?: boolean;
}

export interface SessionMessage {
  role: string;
  content?: string | null;
  tool_name?: string | null;
  tool_calls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
  timestamp?: string | null;
}

export interface ModelInfo {
  provider: string;
  model: string;
  name?: string;
  context_length?: number;
  supports_tools?: boolean;
  supports_vision?: boolean;
}

export interface ModelOption {
  provider: string;
  model: string;
  name?: string;
  context_length?: number;
  supports_tools?: boolean;
  supports_vision?: boolean;
  is_active?: boolean;
}

export interface LogsResponse {
  lines: string[];
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

export class HermesConnectionError extends Error {
  constructor(message = 'No se puede conectar con Hermes') {
    super(message);
    this.name = 'HermesConnectionError';
  }
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  // Get or fetch the session token
  const token = await fetchSessionToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['X-Hermes-Session-Token'] = token;
  }

  const url = `${HERMES_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new HermesConnectionError();
  }

  // Token rotated (server restarted) → invalidate and retry once
  if (res.status === 401) {
    invalidateToken();
    const freshToken = await fetchSessionToken();
    if (freshToken && freshToken !== token) {
      headers['X-Hermes-Session-Token'] = freshToken;
      try {
        res = await fetch(url, { ...init, headers, credentials: 'include' });
      } catch {
        throw new HermesConnectionError();
      }
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── API Surface ──────────────────────────────────────────────────────────────

export const hermesApi = {
  /** Check if Hermes backend is reachable (status endpoint is public, no token needed) */
  ping: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${HERMES_BASE}/api/status`, {
        signal: AbortSignal.timeout(3000),
      });
      // 200 = running; 401 = running but auth required
      return res.status === 200 || res.status === 401;
    } catch {
      return false;
    }
  },

  getStatus: () => fetchJSON<StatusResponse>('/api/status'),

  // Sessions
  getSessions: (limit = 20, offset = 0) =>
    fetchJSON<{ sessions: SessionInfo[]; total: number }>(
      `/api/sessions?limit=${limit}&offset=${offset}&order=recent`
    ),

  getSessionMessages: (id: string) =>
    fetchJSON<{ messages: SessionMessage[] }>(
      `/api/sessions/${encodeURIComponent(id)}/messages`
    ),

  deleteSession: (id: string) =>
    fetchJSON<{ ok: boolean }>(
      `/api/sessions/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    ),

  renameSession: (id: string, title: string) =>
    fetchJSON<{ ok: boolean; title: string }>(
      `/api/sessions/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }
    ),

  searchSessions: (q: string) =>
    fetchJSON<{ results: Array<{ session: SessionInfo; snippet?: string }> }>(
      `/api/sessions/search?q=${encodeURIComponent(q)}`
    ),

  // Logs
  getLogs: (params: { file?: string; lines?: number; level?: string; component?: string }) => {
    const qs = new URLSearchParams();
    if (params.file) qs.set('file', params.file);
    if (params.lines) qs.set('lines', String(params.lines));
    if (params.level && params.level !== 'ALL') qs.set('level', params.level);
    if (params.component && params.component !== 'all') qs.set('component', params.component);
    return fetchJSON<LogsResponse>(`/api/logs?${qs.toString()}`);
  },

  // Models
  getModelInfo: () =>
    fetchJSON<{ provider: string; model: string; name?: string }>('/api/model/info'),

  getModelOptions: () =>
    fetchJSON<{ models: ModelOption[] }>('/api/model/options?include_unconfigured=1'),

  setModel: (provider: string, model: string) =>
    fetchJSON<{ ok: boolean }>('/api/model/set', {
      method: 'POST',
      body: JSON.stringify({ provider, model }),
    }),

  // Config
  getConfigRaw: () =>
    fetchJSON<{ yaml: string; path?: string }>('/api/config/raw'),

  saveConfigRaw: (yaml_text: string) =>
    fetchJSON<{ ok: boolean }>('/api/config/raw', {
      method: 'PUT',
      body: JSON.stringify({ yaml_text }),
    }),

  // WebSocket URL builder for PTY chat
  buildPtyWsUrl: (channel: string, resume?: string): string => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const base = `${protocol}//${host}${HERMES_BASE}`;
    const params = new URLSearchParams({ channel });
    if (resume) params.set('resume', resume);
    // Append session token as query param for WS (headers not supported on WS)
    if (_sessionToken) params.set('token', _sessionToken);
    return `${base}/api/pty?${params.toString()}`;
  },
};
