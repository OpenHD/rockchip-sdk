import React, { useCallback, useEffect, useRef, useState } from 'react';
import { hasMusicServer, searchYoutube, type YoutubeSearchResult } from '../../../utils/youtubeStream';
import type { DjTrackRef } from './types';

type Props = {
  onLoad: (deck: 'A' | 'B', track: DjTrackRef) => void;
};

type LibTab = 'local' | 'youtube';

const AUDIO_ACCEPT =
  'audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.webm,.opus,.aiff,.aif';

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || name;
}

function localId(file: File) {
  return `local:${file.name}:${file.size}:${file.lastModified}`;
}

function fileToTrack(file: File): DjTrackRef {
  return {
    videoId: localId(file),
    title: stripExt(file.name),
    artist: 'Local',
    cover: '',
    source: 'local',
    playUrl: URL.createObjectURL(file),
  };
}

function fmtSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const LibraryPanel: React.FC<Props> = ({ onLoad }) => {
  const [tab, setTab] = useState<LibTab>('local');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<YoutubeSearchResult[]>([]);
  const [localTracks, setLocalTracks] = useState<DjTrackRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const localTracksRef = useRef<DjTrackRef[]>([]);

  useEffect(() => {
    localTracksRef.current = localTracks;
  }, [localTracks]);

  useEffect(() => {
    return () => {
      for (const t of localTracksRef.current) {
        if (t.playUrl?.startsWith('blob:')) URL.revokeObjectURL(t.playUrl);
      }
    };
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter(
      (f) =>
        f.type.startsWith('audio/') ||
        AUDIO_ACCEPT.split(',').some((ext) => {
          const e = ext.trim();
          return e.startsWith('.') && f.name.toLowerCase().endsWith(e);
        }),
    );
    if (!list.length) {
      setError('Solo audio: mp3, wav, flac, ogg, m4a…');
      return;
    }
    setError(null);
    setTab('local');
    setLocalTracks((prev) => {
      const byId = new Map(prev.map((t) => [t.videoId, t]));
      for (const file of list) {
        const id = localId(file);
        if (byId.has(id)) continue;
        byId.set(id, fileToTrack(file));
      }
      return Array.from(byId.values());
    });
  }, []);

  const clearLocal = useCallback(() => {
    for (const t of localTracksRef.current) {
      if (t.playUrl?.startsWith('blob:')) URL.revokeObjectURL(t.playUrl);
    }
    setLocalTracks([]);
  }, []);

  const sizeFromTrackId = (id: string) => {
    const parts = id.split(':');
    const n = Number(parts[parts.length - 2]);
    return Number.isFinite(n) ? n : 0;
  };

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setTab('youtube');
    try {
      const results = await searchYoutube(q);
      setHits(results.filter((r) => r.kind === 'video' && r.id));
    } catch (err) {
      setError((err as Error).message);
      setHits([]);
    } finally {
      setLoading(false);
    }
  };

  const toTrack = (hit: YoutubeSearchResult): DjTrackRef => ({
    videoId: hit.id,
    title: hit.title,
    artist: hit.channelTitle || 'YouTube',
    cover: hit.thumbnail || '',
    source: 'youtube',
  });

  const load = (deck: 'A' | 'B', track: DjTrackRef) => {
    setFlashId(`${track.videoId}:${deck}`);
    window.setTimeout(() => setFlashId(null), 420);
    onLoad(deck, track);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`vdj-lib ${dragOver ? 'drag-over' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <div className="vdj-lib-header">
        <span>LIBRARY</span>
        <span className={`vdj-dsp-pill ${localTracks.length ? 'ok' : hasMusicServer() ? 'ok' : 'warn'}`}>
          {localTracks.length ? `${localTracks.length} FILE${localTracks.length > 1 ? 'S' : ''}` : 'READY'}
        </span>
      </div>

      <div className="vdj-lib-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'local'}
          className={`vdj-lib-tab ${tab === 'local' ? 'active' : ''}`}
          onClick={() => setTab('local')}
        >
          Local
          {localTracks.length > 0 && <em>{localTracks.length}</em>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'youtube'}
          className={`vdj-lib-tab ${tab === 'youtube' ? 'active' : ''}`}
          onClick={() => setTab('youtube')}
        >
          YouTube
        </button>
      </div>

      {tab === 'local' ? (
        <>
          <div
            className={`vdj-dropzone ${dragOver ? 'hot' : ''} ${localTracks.length ? 'compact' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={AUDIO_ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="vdj-dropzone-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4v10m0-10l-3.5 3.5M12 4l3.5 3.5M5 16.5V18a2 2 0 002 2h10a2 2 0 002-2v-1.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <strong>Importar audio</strong>
            <span>Arrastrá mp3 · wav · flac · m4a</span>
          </div>

          {localTracks.length > 0 && (
            <div className="vdj-lib-toolbar">
              <span>{localTracks.length} en cola</span>
              <button type="button" className="vdj-btn tiny ghost" onClick={clearLocal}>
                Limpiar
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="vdj-lib-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search();
            }}
            placeholder="Buscar en YouTube…"
          />
          <button type="button" className="vdj-btn primary" onClick={() => void search()} disabled={loading}>
            {loading ? '…' : 'GO'}
          </button>
        </div>
      )}

      {error && <p className="vdj-lib-error">{error}</p>}

      <div className="vdj-lib-list">
        {tab === 'local' &&
          localTracks.map((track) => (
            <div
              key={track.videoId}
              className={`vdj-lib-row local ${flashId?.startsWith(track.videoId) ? 'flash' : ''}`}
            >
              <div className="vdj-lib-ph local" aria-hidden>
                <span>♪</span>
              </div>
              <div className="vdj-lib-info">
                <div className="vdj-lib-title" title={track.title}>
                  {track.title}
                </div>
                <div className="vdj-lib-ch">
                  Local
                  {sizeFromTrackId(track.videoId) ? ` · ${fmtSize(sizeFromTrackId(track.videoId))}` : ''}
                </div>
              </div>
              <button
                type="button"
                className={`vdj-load-a ${flashId === `${track.videoId}:A` ? 'pulse' : ''}`}
                onClick={() => load('A', track)}
                title="Cargar en deck A"
              >
                A
              </button>
              <button
                type="button"
                className={`vdj-load-b ${flashId === `${track.videoId}:B` ? 'pulse' : ''}`}
                onClick={() => load('B', track)}
                title="Cargar en deck B"
              >
                B
              </button>
            </div>
          ))}

        {tab === 'youtube' &&
          hits.map((hit) => (
            <div
              key={hit.id}
              className={`vdj-lib-row ${flashId?.startsWith(hit.id) ? 'flash' : ''}`}
            >
              {hit.thumbnail ? <img src={hit.thumbnail} alt="" /> : <div className="vdj-lib-ph" />}
              <div className="vdj-lib-info">
                <div className="vdj-lib-title" title={hit.title}>
                  {hit.title}
                </div>
                <div className="vdj-lib-ch">{hit.channelTitle}</div>
              </div>
              <button
                type="button"
                className={`vdj-load-a ${flashId === `${hit.id}:A` ? 'pulse' : ''}`}
                onClick={() => load('A', toTrack(hit))}
              >
                A
              </button>
              <button
                type="button"
                className={`vdj-load-b ${flashId === `${hit.id}:B` ? 'pulse' : ''}`}
                onClick={() => load('B', toTrack(hit))}
              >
                B
              </button>
            </div>
          ))}

        {tab === 'local' && localTracks.length === 0 && (
          <div className="vdj-lib-empty-card">
            <p>Tu crate local</p>
            <span>Importá tracks y cargalos al platter A o B. Sin YouTube, sin server.</span>
          </div>
        )}

        {tab === 'youtube' && !loading && hits.length === 0 && (
          <div className="vdj-lib-empty-card">
            <p>Búsqueda YouTube</p>
            <span>Opcional. Si falla el stream, usá archivos locales.</span>
          </div>
        )}

        {tab === 'youtube' && loading && <div className="vdj-lib-empty">Buscando…</div>}
      </div>
    </div>
  );
};

export default LibraryPanel;
