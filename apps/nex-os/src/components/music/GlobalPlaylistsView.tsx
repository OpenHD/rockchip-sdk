import React, { useMemo, useState } from 'react';
import {
  Play24Filled,
  MusicNote224Filled,
  Globe24Regular,
  Star24Filled,
  Star24Regular,
  CloudArrowUp24Regular,
  ArrowShuffle24Filled,
  Clock24Regular,
  Share24Regular,
} from '@fluentui/react-icons';
import {
  REACTION_EMOJIS,
  useGlobalPlaylists,
  type CloudPlaylistView,
} from '../../hooks/useGlobalPlaylists';
import { useUserProfiles, useVerifiedMap } from '../../hooks/useUserProfiles';
import { isSupabaseConfigured, getSupabaseErrorMessage } from '../../lib/supabase';
import type { CloudPlayMode } from '../../utils/cloudPlaylist';
import type { Playlist, Track } from '../../types/music';
import {
  buildCloudPlaylistShareUrl,
  shareOrCopy,
  shareResultToast,
} from '../../utils/share';
import {
  fetchPlaylistComments,
  postPlaylistComment,
  toggleFollowCreator,
} from '../../utils/socialCloud';
import { NicknameWithBadge } from './VerifiedBadge';
import StaffVerifyPanel from './StaffVerifyPanel';

interface SupabaseAuthProps {
  supabaseUserId: string | null;
  supabaseAuthReady: boolean;
  supabaseAuthError: string | null;
  supabaseRetry?: () => void;
}

interface GlobalPlaylistsViewProps extends SupabaseAuthProps {
  nickname: string;
  localFallback: Playlist[];
  playCloudPlaylist: (
    tracks: Track[],
    mode: CloudPlayMode,
    meta?: { playlistId?: string; playlistName?: string },
  ) => void;
  voteForPlaylist?: (playlistId: string) => void;
  unvoteForPlaylist?: (playlistId: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'premium') => void;
  onOpenSpotifyImport?: () => void;
  spotifyImportLabel?: string;
}

export const PublishToCloudButton: React.FC<{
  playlist: Playlist;
  nickname: string;
  showToast: GlobalPlaylistsViewProps['showToast'];
} & SupabaseAuthProps> = ({
  playlist,
  nickname,
  showToast,
  supabaseUserId,
  supabaseAuthReady,
  supabaseAuthError,
  supabaseRetry,
}) => {
  const { enabled, publishPlaylist, getCloudId } = useGlobalPlaylists(nickname, supabaseUserId);
  const [publishing, setPublishing] = useState(false);
  const [cloudId, setCloudId] = useState(() => getCloudId(playlist.id));

  if (!enabled) return null;

  if (playlist.isPrivate) {
    return (
      <button
        type="button"
        className="spotify-btn-secondary publish-cloud-btn publish-cloud-disabled-hint"
        onClick={() => showToast('Hacé la lista pública (🌐) antes de publicar en la nube', 'info')}
        title="La lista debe ser pública"
      >
        <CloudArrowUp24Regular />
        Publicar en nube
      </button>
    );
  }

  const handlePublish = async () => {
    if (!nickname?.trim()) {
      showToast('Configurá tu nickname primero', 'info');
      return;
    }
    if (!supabaseAuthReady) {
      showToast('Conectando con Supabase… esperá unos segundos', 'info');
      return;
    }
    if (supabaseAuthError) {
      showToast(supabaseAuthError, 'error');
      supabaseRetry?.();
      return;
    }
    if (playlist.tracks.length === 0) {
      showToast('Agregá canciones a la lista antes de publicar', 'info');
      return;
    }

    setPublishing(true);
    const wasUpdate = Boolean(cloudId);
    try {
      const id = await publishPlaylist(playlist);
      setCloudId(id);
      showToast(
        wasUpdate ? 'Lista actualizada en la nube ☁️' : 'Lista publicada en la comunidad ☁️',
        'success',
      );
      const shareUrl = buildCloudPlaylistShareUrl(id);
      const result = await shareOrCopy({
        title: `${playlist.name} · NEX Music`,
        text: `Escuchá "${playlist.name}" en NEX Music`,
        url: shareUrl,
      });
      const msg = shareResultToast(result);
      if (msg) showToast(msg, 'success');
    } catch (err) {
      console.error('[NEX Music] publish:', err);
      showToast(getSupabaseErrorMessage(err, 'No se pudo publicar. Revisá Supabase.'), 'error');
      if (!supabaseUserId) supabaseRetry?.();
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`spotify-btn-secondary publish-cloud-btn${publishing ? ' publish-cloud-loading' : ''}`}
        disabled={publishing}
        onClick={() => void handlePublish()}
        title="Publicar en listas globales (tiempo real)"
      >
        <CloudArrowUp24Regular />
        {publishing ? 'Publicando…' : cloudId ? 'Actualizar nube' : 'Publicar en nube'}
      </button>
      {cloudId && (
        <button
          type="button"
          className="spotify-btn-secondary publish-cloud-btn"
          onClick={() => {
            void (async () => {
              const result = await shareOrCopy({
                title: `${playlist.name} · NEX Music`,
                text: `Escuchá "${playlist.name}" en NEX Music`,
                url: buildCloudPlaylistShareUrl(cloudId),
              });
              const msg = shareResultToast(result);
              if (msg) showToast(msg, 'success');
            })();
          }}
          title="Compartir enlace de la nube"
        >
          <Share24Regular />
          Compartir enlace
        </button>
      )}
    </>
  );
};

const RANKING_TABS: { id: 'trending' | 'weekly' | 'alltime'; label: string }[] = [
  { id: 'trending', label: '🔥 Trending' },
  { id: 'weekly', label: '📅 Esta semana' },
  { id: 'alltime', label: '⭐ Top histórico' },
];

const GlobalPlaylistsView: React.FC<GlobalPlaylistsViewProps> = ({
  nickname,
  localFallback,
  playCloudPlaylist,
  voteForPlaylist,
  unvoteForPlaylist,
  showToast,
  supabaseUserId,
  supabaseAuthReady,
  supabaseAuthError,
  supabaseRetry,
  onOpenSpotifyImport,
  spotifyImportLabel = 'Importar de Spotify',
}) => {
  const cloud = useGlobalPlaylists(nickname, supabaseUserId);
  const { myProfile, requestVerify, isVerified } = useUserProfiles(nickname, supabaseUserId);
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, { id: string; user_nickname: string; body: string }[]>>({});
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null);
  const [requestingVerify, setRequestingVerify] = useState(false);
  const [showStaffPanel, setShowStaffPanel] = useState(false);

  const localPublic = localFallback
    .filter((p) => !p.isPrivate)
    .sort((a, b) => b.votes.length - a.votes.length);

  const usingCloud = cloud.enabled && supabaseAuthReady && !!supabaseUserId;
  const displayCloud = usingCloud ? cloud.playlists : [];
  const isEmpty = usingCloud ? displayCloud.length === 0 && !cloud.loading : localPublic.length === 0;

  const nicknamesForBadges = useMemo(() => {
    const names = new Set<string>();
    if (nickname) names.add(nickname);
    displayCloud.forEach((p) => names.add(p.ownerName));
    Object.values(comments).forEach((rows) => rows.forEach((c) => names.add(c.user_nickname)));
    return [...names];
  }, [nickname, displayCloud, comments]);

  const { isVerified: nickIsVerified, reasonFor } = useVerifiedMap(nicknamesForBadges);

  const handleCloudPlay = (playlist: CloudPlaylistView, mode: CloudPlayMode) => {
    if (playlist.tracks.length === 0) return;
    playCloudPlaylist(playlist.tracks, mode, {
      playlistId: playlist.id,
      playlistName: playlist.name,
    });
    const labels: Record<CloudPlayMode, string> = {
      full: `Reproduciendo "${playlist.name}"`,
      shuffle: `Shuffle: "${playlist.name}"`,
      preview: `Preview 30s: "${playlist.name}"`,
    };
    showToast(labels[mode], 'info');
  };

  const renderCard = (
    playlist: CloudPlaylistView | Playlist,
    opts: { isCloud: boolean; cloudView?: CloudPlaylistView },
  ) => {
    const id = playlist.id;
    const isCloud = opts.isCloud;
    const cloudView = opts.cloudView;
    const hasVoted = isCloud && cloudView
      ? cloud.hasVoted(cloudView)
      : playlist.votes.includes(nickname);
    const voteCount = isCloud ? (cloudView?.votes.length ?? 0) : playlist.votes.length;
    const cover = playlist.cover ?? playlist.tracks[0]?.cover;
    const isLive = cloud.liveReaction?.playlistId === id;

    return (
      <div key={id} className={`spotify-card global-playlist-card ${isLive ? 'reaction-live' : ''}`}>
        {isLive && (
          <div className="global-live-reaction">
            {cloud.liveReaction!.emoji} {cloud.liveReaction!.user}
          </div>
        )}

        {isCloud && cloudView && cloud.ranking === 'trending' && cloudView.trendingScore > 0 && (
          <span className="global-trending-badge">Trending</span>
        )}

        <div className="spotify-card-image">
          {cover ? (
            <img src={cover} alt={playlist.name} />
          ) : (
            <div className="spotify-hero-placeholder">
              <MusicNote224Filled />
            </div>
          )}
          <button
            type="button"
            className="spotify-play-btn"
            onClick={() => {
              if (isCloud && cloudView) {
                handleCloudPlay(cloudView, 'full');
              } else if (playlist.tracks.length > 0) {
                playCloudPlaylist(playlist.tracks, 'full');
              }
            }}
          >
            <Play24Filled />
          </button>
        </div>

        <div className="spotify-card-info">
          <div className="spotify-card-title">{playlist.name}</div>
          <div className="spotify-card-artist">
            Por{' '}
            <NicknameWithBadge
              name={playlist.ownerName}
              verified={nickIsVerified(playlist.ownerName)}
              reason={reasonFor(playlist.ownerName)}
            />
          </div>
        </div>

        {isCloud && cloudView && (
          <div className="global-play-actions">
            <button
              type="button"
              className="global-action-btn"
              title="Preview 30 segundos"
              onClick={() => handleCloudPlay(cloudView, 'preview')}
            >
              <Clock24Regular /> 30s
            </button>
            <button
              type="button"
              className="global-action-btn"
              title="Reproducir en shuffle"
              onClick={() => handleCloudPlay(cloudView, 'shuffle')}
            >
              <ArrowShuffle24Filled />
            </button>
            <button
              type="button"
              className="global-action-btn"
              title="Compartir lista"
              onClick={() => {
                void (async () => {
                  const result = await shareOrCopy({
                    title: `${cloudView.name} · NEX Music`,
                    text: `Escuchá "${cloudView.name}" de ${cloudView.ownerName} en NEX Music`,
                    url: buildCloudPlaylistShareUrl(cloudView.id),
                  });
                  const msg = shareResultToast(result);
                  if (msg) showToast(msg, 'success');
                })();
              }}
            >
              <Share24Regular />
            </button>
          </div>
        )}

        <div className="playlist-meta global-card-meta">
          <div className="playlist-votes">
            <button
              type="button"
              onClick={async () => {
                if (!nickname) {
                  showToast('Configurá tu nickname para votar', 'info');
                  return;
                }
                if (isCloud) {
                  if (!supabaseUserId) {
                    showToast(supabaseAuthError ?? 'Conectando…', 'info');
                    return;
                  }
                  await cloud.toggleVote(id, hasVoted);
                } else if (hasVoted) {
                  unvoteForPlaylist?.(id);
                } else {
                  voteForPlaylist?.(id);
                }
              }}
              className={`vote-btn ${hasVoted ? 'voted' : ''}`}
            >
              {hasVoted ? <Star24Filled /> : <Star24Regular />}
              <span>{voteCount}</span>
            </button>
            <span className="global-track-count">{playlist.tracks.length} canciones</span>
            {isCloud && cloudView && cloudView.playCount > 0 && (
              <span className="play-count-badge">{cloudView.playCount} plays</span>
            )}
          </div>

          {isCloud && cloudView && (
            <div className="global-social-row">
              <button
                type="button"
                className="global-action-btn"
                onClick={() => {
                  void (async () => {
                    if (!nickname) {
                      showToast('Configurá tu nickname', 'info');
                      return;
                    }
                    try {
                      const nowFollowing = await toggleFollowCreator(nickname, cloudView.ownerName);
                      showToast(
                        nowFollowing
                          ? `Seguís a ${cloudView.ownerName}`
                          : `Dejaste de seguir a ${cloudView.ownerName}`,
                        'success',
                      );
                    } catch {
                      showToast('Ejecutá schema-social-v3.sql en Supabase para follows', 'info');
                    }
                  })();
                }}
              >
                Seguir
              </button>
              <button
                type="button"
                className="global-action-btn"
                onClick={() => {
                  const open = showCommentsFor === id ? null : id;
                  setShowCommentsFor(open);
                  if (open) {
                    void fetchPlaylistComments(id).then((rows) => {
                      setComments((prev) => ({ ...prev, [id]: rows as never }));
                    });
                  }
                }}
              >
                Comentarios
              </button>
            </div>
          )}

          {isCloud && showCommentsFor === id && (
            <div className="global-comments">
              {(comments[id] || []).slice(0, 5).map((c) => (
                <div key={c.id} className="global-comment">
                  <strong>
                    @
                    <NicknameWithBadge
                      name={c.user_nickname}
                      verified={nickIsVerified(c.user_nickname)}
                      reason={reasonFor(c.user_nickname)}
                    />
                  </strong>{' '}
                  {c.body}
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = (commentDraft[id] || '').trim();
                  if (!body || !nickname) return;
                  void postPlaylistComment(id, nickname, body)
                    .then(async () => {
                      setCommentDraft((prev) => ({ ...prev, [id]: '' }));
                      const rows = await fetchPlaylistComments(id);
                      setComments((prev) => ({ ...prev, [id]: rows as never }));
                      showToast('Comentario publicado', 'success');
                    })
                    .catch(() => showToast('Ejecutá schema-social-v3.sql para comentarios', 'info'));
                }}
              >
                <input
                  value={commentDraft[id] || ''}
                  onChange={(e) => setCommentDraft((prev) => ({ ...prev, [id]: e.target.value }))}
                  placeholder="Comentá en 1 línea…"
                  maxLength={280}
                />
              </form>
            </div>
          )}

          {isCloud && (
            <div className="global-reactions">
              <button
                type="button"
                className="reaction-toggle-btn"
                aria-expanded={showReactionsFor === id}
                onClick={() => setShowReactionsFor(showReactionsFor === id ? null : id)}
              >
                {showReactionsFor === id ? 'Cerrar' : 'Reaccionar'}
              </button>
              <div className="reaction-pills">
                {Object.entries(cloudView?.reactionSummary ?? {}).map(([emoji, count]) => (
                  <span key={emoji} className="reaction-pill">
                    {emoji} {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isCloud && showReactionsFor === id && (
            <div className="reaction-picker">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="reaction-emoji-btn"
                  onClick={async () => {
                    if (!nickname || !supabaseUserId) {
                      showToast(supabaseAuthError ?? 'Conectando con la nube…', 'info');
                      return;
                    }
                    await cloud.sendReaction(id, emoji);
                    setShowReactionsFor(null);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="spotify-list-view">
      <div className="spotify-list-header global-list-header">
        <div className="global-list-header-top">
          <div>
            <h2>Listas Globales</h2>
            <p>
              {usingCloud
                ? 'Escuchá sin importar · votá y reaccioná en tiempo real'
                : cloud.enabled && supabaseAuthReady && !supabaseUserId
                  ? 'Modo local — no se pudo conectar a la nube'
                  : 'Las listas más votadas por la comunidad (local)'}
            </p>
          </div>
          {onOpenSpotifyImport && (
            <button
              type="button"
              className="global-spotify-import-btn"
              onClick={onOpenSpotifyImport}
            >
              {spotifyImportLabel}
            </button>
          )}
        </div>
        {!isSupabaseConfigured && (
          <p className="global-setup-hint">
            Conectá VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env + ejecutá schema.sql
          </p>
        )}
        {supabaseAuthError && (
          <div className="global-error-banner">
            {supabaseAuthError}
            {supabaseRetry && (
              <button type="button" className="global-retry-btn" onClick={supabaseRetry}>
                Reintentar
              </button>
            )}
          </div>
        )}
        {usingCloud && (
          <div className="global-ranking-tabs">
            {RANKING_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`global-ranking-tab ${cloud.ranking === tab.id ? 'active' : ''}`}
                onClick={() => cloud.setRanking(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {usingCloud && nickname && (
          <div className="global-verify-row">
            {isVerified || myProfile?.verified ? (
              <span className="global-verify-status">
                <NicknameWithBadge name={nickname} verified reason={myProfile?.verifiedReason} size="md" />
                <span> Cuenta verificada</span>
              </span>
            ) : (
              <button
                type="button"
                className="global-verify-btn"
                disabled={requestingVerify}
                onClick={() => {
                  void (async () => {
                    setRequestingVerify(true);
                    try {
                      await requestVerify('Quiero el check de creador en NEX Music');
                      showToast('Solicitud enviada · te avisamos cuando te verifiquen', 'premium');
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'No se pudo solicitar', 'info');
                    } finally {
                      setRequestingVerify(false);
                    }
                  })();
                }}
              >
                {requestingVerify ? 'Enviando…' : 'Solicitar verificación ✓'}
              </button>
            )}
            <button
              type="button"
              className="global-staff-btn"
              title="Panel staff"
              onClick={() => setShowStaffPanel(true)}
            >
              Staff
            </button>
          </div>
        )}
      </div>

      <StaffVerifyPanel
        open={showStaffPanel}
        onClose={() => setShowStaffPanel(false)}
        showToast={showToast}
      />

      {cloud.loading && usingCloud && (
        <div className="spotify-loading">
          <div className="spotify-spinner" />
          <p>Sincronizando con la nube…</p>
        </div>
      )}

      {cloud.error && (
        <div className="global-error-banner">{cloud.error}</div>
      )}

      {isEmpty && !cloud.loading ? (
        <div className="spotify-empty">
          <Globe24Regular />
          <p>
            {usingCloud
              ? 'Aún no hay listas en la nube. Publicá una desde Mis Listas.'
              : 'No hay listas públicas aún. Creá una y hacela pública.'}
          </p>
          {onOpenSpotifyImport && (
            <button type="button" className="global-spotify-import-btn global-spotify-import-btn-empty" onClick={onOpenSpotifyImport}>
              {spotifyImportLabel}
            </button>
          )}
        </div>
      ) : (
        <div className="spotify-grid">
          {usingCloud
            ? displayCloud.map((p) => renderCard(p, { isCloud: true, cloudView: p }))
            : localPublic.map((p) => renderCard(p, { isCloud: false }))}
        </div>
      )}

      <style>{`
        .global-retry-btn {
          margin-left: 12px;
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.25);
          color: #fff;
          border-radius: 8px;
          padding: 4px 12px;
          cursor: pointer;
          font-size: 13px;
        }
        .global-retry-btn:hover { background: rgba(255,255,255,0.25); }
        .global-list-header-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          width: 100%;
        }
        .global-spotify-import-btn {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(30, 215, 96, 0.45);
          background: rgba(30, 215, 96, 0.1);
          color: #1ed760;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .global-spotify-import-btn:hover {
          background: rgba(30, 215, 96, 0.18);
          border-color: rgba(30, 215, 96, 0.65);
        }
        .global-spotify-import-btn-empty { margin-top: 8px; }
        .global-playlist-card {
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }
        .global-playlist-card .spotify-card-info {
          min-width: 0;
          width: 100%;
        }
        .global-playlist-card .spotify-card-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .global-playlist-card .global-card-meta {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
          width: 100%;
          margin-top: auto;
          padding-top: 8px;
        }
        .global-playlist-card .playlist-votes {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          width: 100%;
        }
        .global-playlist-card .global-track-count {
          color: rgba(255,255,255,0.6);
          font-size: 12px;
        }
        .global-playlist-card.reaction-live { animation: reactionPulse 0.6s ease; }
        @keyframes reactionPulse {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: 0 0 24px rgba(56,189,248,0.45); }
        }
        .global-trending-badge {
          position: absolute; top: 8px; left: 8px; z-index: 5;
          background: linear-gradient(135deg, #f97316, #ef4444);
          padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
        }
        .global-live-reaction {
          position: absolute; top: 8px; right: 8px; z-index: 5;
          background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
          padding: 4px 10px; border-radius: 999px; font-size: 13px;
          animation: floatUp 2s ease forwards;
        }
        @keyframes floatUp {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-20px); }
        }
        .global-ranking-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .global-ranking-tab {
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.75); border-radius: 999px; padding: 8px 14px;
          font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .global-ranking-tab.active { background: #fff; color: #000; border-color: #fff; }
        .global-verify-row {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .global-verify-btn {
          background: rgba(29, 155, 240, 0.15);
          border: 1px solid rgba(29, 155, 240, 0.45);
          color: #8ecdf8;
          border-radius: 999px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .global-verify-btn:disabled { opacity: 0.6; cursor: wait; }
        .global-verify-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: rgba(255,255,255,0.75);
        }
        .global-staff-btn {
          margin-left: auto;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.4);
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 11px;
          cursor: pointer;
        }
        .global-staff-btn:hover { color: #8ecdf8; border-color: rgba(29,155,240,0.4); }
        .global-play-actions { display: flex; gap: 8px; padding: 0; width: 100%; margin-top: 4px; }
        .global-action-btn {
          flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
          color: #fff; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer;
          min-width: 0;
        }
        .global-social-row { display: flex; gap: 6px; margin-top: 8px; width: 100%; }
        .global-social-row .global-action-btn { flex: 1; }
        .global-comments { width: 100%; margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
        .global-comment { font-size: 12px; color: rgba(255,255,255,0.75); line-height: 1.35; }
        .global-comments input {
          width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.35);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
          color: #fff; padding: 8px 10px; font-size: 12px;
        }
        .global-action-btn:hover { background: rgba(255,255,255,0.15); }
        .play-count-badge, .weekly-badge { font-size: 11px; color: rgba(255,255,255,0.5); }
        .weekly-badge { color: #fbbf24; }
        .global-reactions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          width: 100%;
        }
        .reaction-pills {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }
        .reaction-toggle-btn {
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
          color: #fff; border-radius: 999px; padding: 5px 12px; font-size: 12px; cursor: pointer;
          flex-shrink: 0;
        }
        .reaction-toggle-btn:hover { background: rgba(255,255,255,0.14); }
        .reaction-pill {
          font-size: 12px; background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 999px;
          white-space: nowrap;
        }
        .reaction-picker {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          width: 100%;
          padding: 8px 0 0;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .reaction-emoji-btn {
          background: rgba(255,255,255,0.08); border: none; border-radius: 10px;
          font-size: 20px; padding: 6px 10px; cursor: pointer;
        }
        .global-setup-hint { color: rgba(255,255,255,0.45); font-size: 13px; margin-top: 4px; }
        .global-error-banner {
          background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35);
          color: #fecaca; padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 14px;
          display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
        }
        .publish-cloud-btn { display: inline-flex; align-items: center; gap: 8px; }
        .publish-cloud-loading { opacity: 0.7; cursor: wait; }
        .publish-cloud-disabled-hint { opacity: 0.85; }
      `}</style>
    </div>
  );
};

export default GlobalPlaylistsView;
