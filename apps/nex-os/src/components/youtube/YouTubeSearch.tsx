import React, { useState, useCallback, useRef } from 'react';
import { Search24Regular, Play24Filled } from '@fluentui/react-icons';

interface YouTubeResult {
  id: string;
  kind: 'video' | 'playlist';
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
  description: string;
}

interface YouTubeSearchProps {
  /** Se llama cuando el usuario elige un resultado, con la URL de embed ya armada */
  onPlay: (embedUrl: string, titleHint: string) => void;
  /** Endpoint de tu backend, ej: '/api/youtube/search' */
  searchEndpoint?: string;
}

function buildEmbedUrlFromResult(result: YouTubeResult): string {
  const base = result.kind === 'playlist'
    ? 'https://www.youtube-nocookie.com/embed/videoseries'
    : `https://www.youtube-nocookie.com/embed/${result.id}`;

  const params = new URLSearchParams({ rel: '0', modestbranding: '1', enablejsapi: '1' });
  if (result.kind === 'playlist') params.set('list', result.id);

  return `${base}?${params.toString()}`;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Hoy';
  if (days < 30) return `Hace ${days} día${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Hace ${months} mes${months === 1 ? '' : 'es'}`;
  const years = Math.floor(months / 12);
  return `Hace ${years} año${years === 1 ? '' : 's'}`;
}

export const YouTubeSearch: React.FC<YouTubeSearchProps> = ({
  onPlay,
  searchEndpoint = '/api/youtube/search',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch(`${searchEndpoint}?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'No se pudo completar la búsqueda');
      }

      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message || 'Error de conexión');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchEndpoint]);

  const handlePlay = (result: YouTubeResult) => {
    onPlay(buildEmbedUrlFromResult(result), result.title);
  };

  return (
    <div className="yt-search-root">
      <div className="yt-search-header">
        <div className="yt-logo">
          <span className="yt-logo-play">▶</span>
          <span className="yt-logo-text">YouTube</span>
        </div>
        <div className="yt-search-bar">
          <Search24Regular className="yt-search-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch(query)}
            placeholder="Buscar videos, artistas, canales..."
            autoFocus
          />
          <button onClick={() => runSearch(query)} disabled={!query.trim()}>
            Buscar
          </button>
        </div>
      </div>

      <div className="yt-search-body">
        {loading && (
          <div className="yt-state">
            <div className="yt-spinner" />
            <p>Buscando...</p>
          </div>
        )}

        {!loading && error && (
          <div className="yt-state yt-error">
            <p>{error}</p>
            <button onClick={() => runSearch(query)}>Reintentar</button>
          </div>
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <div className="yt-state">
            <p>No se encontraron resultados para "{query}"</p>
          </div>
        )}

        {!loading && !error && !hasSearched && (
          <div className="yt-state yt-empty">
            <Search24Regular />
            <p>Buscá un video, artista o canal para empezar</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="yt-grid">
            {results.map((r) => (
              <button key={r.id} className="yt-card" onClick={() => handlePlay(r)}>
                <div className="yt-thumb-wrap">
                  {r.thumbnail && <img src={r.thumbnail} alt={r.title} className="yt-thumb" />}
                  <div className="yt-play-overlay">
                    <Play24Filled />
                  </div>
                  {r.kind === 'playlist' && <span className="yt-badge">Lista</span>}
                </div>
                <div className="yt-card-info">
                  <p className="yt-card-title">{r.title}</p>
                  <p className="yt-card-meta">
                    {r.channelTitle} · {formatRelativeDate(r.publishedAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .yt-search-root {
          position: absolute;
          inset: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #fff;
          font-family: 'Roboto', 'Segoe UI', system-ui, sans-serif;
          z-index: 2;
        }

        .yt-search-header {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 12px 24px;
          border-bottom: 1px solid #e5e5e5;
          flex-shrink: 0;
        }

        .yt-logo {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .yt-logo-play {
          color: #ff0000;
          font-size: 22px;
        }

        .yt-logo-text {
          font-size: 18px;
          font-weight: 500;
          color: #0f0f0f;
          letter-spacing: -0.5px;
        }

        .yt-search-bar {
          flex: 1;
          max-width: 600px;
          display: flex;
          align-items: center;
          border: 1px solid #ccc;
          border-radius: 24px;
          overflow: hidden;
        }

        .yt-search-icon {
          color: #909090;
          margin-left: 16px;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .yt-search-bar input {
          flex: 1;
          border: none;
          outline: none;
          padding: 10px 12px;
          font-size: 14px;
        }

        .yt-search-bar button {
          background: #f8f8f8;
          border: none;
          border-left: 1px solid #ccc;
          padding: 0 20px;
          height: 38px;
          cursor: pointer;
          font-size: 14px;
          color: #0f0f0f;
        }

        .yt-search-bar button:hover:not(:disabled) { background: #f0f0f0; }
        .yt-search-bar button:disabled { color: #aaa; cursor: default; }

        .yt-search-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .yt-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          height: 100%;
          color: #606060;
          text-align: center;
        }

        .yt-empty svg { width: 40px; height: 40px; color: #ccc; }

        .yt-error button {
          background: #ff0000;
          color: #fff;
          border: none;
          border-radius: 18px;
          padding: 8px 20px;
          cursor: pointer;
          font-size: 13px;
        }

        .yt-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e5e5e5;
          border-top-color: #ff0000;
          border-radius: 50%;
          animation: yt-spin 0.8s linear infinite;
        }

        @keyframes yt-spin { to { transform: rotate(360deg); } }

        .yt-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 20px;
        }

        .yt-card {
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .yt-thumb-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          border-radius: 12px;
          overflow: hidden;
          background: #eee;
        }

        .yt-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .yt-play-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0);
          opacity: 0;
          transition: opacity 0.15s, background 0.15s;
          color: #fff;
        }

        .yt-card:hover .yt-play-overlay {
          opacity: 1;
          background: rgba(0,0,0,0.35);
        }

        .yt-play-overlay svg { width: 36px; height: 36px; }

        .yt-badge {
          position: absolute;
          bottom: 6px;
          right: 6px;
          background: rgba(0,0,0,0.75);
          color: #fff;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .yt-card-info {
          padding: 0 2px;
        }

        .yt-card-title {
          font-size: 14px;
          font-weight: 500;
          color: #0f0f0f;
          margin: 0 0 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .yt-card-meta {
          font-size: 12px;
          color: #606060;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default YouTubeSearch;