import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftRegular,
  MusicNote224Filled,
  Play24Filled,
  Share24Regular,
} from '@fluentui/react-icons';
import {
  fetchPlaylistsByOwnerNickname,
  fetchProfileByNickname,
  requestVerification,
  updateMyProfileFields,
  verifiedReasonLabel,
  type OwnerPlaylistSummary,
  type UserProfile,
} from '../../utils/userProfiles';
import { isFollowingCreator, toggleFollowCreator, fetchFollowStats, fetchFollowerNicknames, fetchFollowingNicknames } from '../../utils/socialCloud';
import { useVerifiedMap } from '../../hooks/useUserProfiles';
import {
  buildCloudPlaylistShareUrl,
  buildNexMusicHomeUrl,
  shareOrCopy,
  shareResultToast,
} from '../../utils/share';
import { NicknameWithBadge } from './VerifiedBadge';
import type { CloudPlayMode } from '../../utils/cloudPlaylist';
import type { Track } from '../../types/music';

interface ProfileViewProps {
  /** Nickname to show. If omitted / matches me → own profile editor. */
  targetNickname: string;
  myNickname: string;
  myUserId: string | null;
  isOwn: boolean;
  onBack?: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'premium') => void;
  playCloudPlaylist?: (
    tracks: Track[],
    mode: CloudPlayMode,
    meta?: { playlistId?: string; playlistName?: string },
  ) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({
  targetNickname,
  myNickname,
  myUserId,
  isOwn,
  onBack,
  showToast,
  playCloudPlaylist,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [playlists, setPlaylists] = useState<OwnerPlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [listMode, setListMode] = useState<'followers' | 'following' | null>(null);
  const [listNames, setListNames] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const { isVerified: nickIsVerified, reasonFor } = useVerifiedMap(listNames);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, lists, stats] = await Promise.all([
        fetchProfileByNickname(targetNickname),
        fetchPlaylistsByOwnerNickname(targetNickname),
        fetchFollowStats(targetNickname),
      ]);
      setProfile(p);
      setPlaylists(lists);
      setFollowers(stats.followers);
      setFollowingCount(stats.following);
      if (p) {
        setDisplayName(p.displayName || p.nickname);
        setBio(p.bio || '');
      }
      if (!isOwn && myNickname) {
        setFollowing(await isFollowingCreator(myNickname, targetNickname));
      }
    } finally {
      setLoading(false);
    }
  }, [targetNickname, isOwn, myNickname]);

  useEffect(() => {
    void load();
  }, [load]);

  const openFollowList = async (mode: 'followers' | 'following') => {
    setListMode(mode);
    setListLoading(true);
    try {
      const names =
        mode === 'followers'
          ? await fetchFollowerNicknames(targetNickname)
          : await fetchFollowingNicknames(targetNickname);
      setListNames(names);
    } finally {
      setListLoading(false);
    }
  };

  const shareProfile = async () => {
    const url = `${buildNexMusicHomeUrl()}?user=${encodeURIComponent(targetNickname)}`;
    const result = await shareOrCopy({
      title: `${profile?.displayName || targetNickname} · NEX Music`,
      text: `Perfil de @${targetNickname} en NEX Music`,
      url,
    });
    const msg = shareResultToast(result);
    if (msg) showToast(msg, 'success');
  };

  if (loading) {
    return (
      <div className="spotify-list-view">
        <div className="spotify-loading">
          <div className="spotify-spinner" />
          <p>Cargando perfil…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="spotify-list-view profile-view">
        {onBack && (
          <button type="button" className="profile-back" onClick={onBack}>
            <ArrowLeftRegular /> Volver
          </button>
        )}
        <div className="spotify-empty">
          <p>No encontramos el perfil de @{targetNickname}</p>
          <p className="profile-empty-hint">Tiene que abrir NEX Music una vez con ese nickname</p>
        </div>
      </div>
    );
  }

  return (
    <div className="spotify-list-view profile-view">
      {onBack && (
        <button type="button" className="profile-back" onClick={onBack}>
          <ArrowLeftRegular /> Volver
        </button>
      )}

      <div className="profile-hero">
        <div className="profile-avatar" aria-hidden>
          {(profile.displayName || profile.nickname).slice(0, 1).toUpperCase()}
        </div>
        <div className="profile-hero-text">
          <h2>
            <NicknameWithBadge
              name={profile.displayName || profile.nickname}
              verified={profile.verified}
              reason={profile.verifiedReason}
              size="md"
            />
          </h2>
          <div className="profile-handle">@{profile.nickname}</div>
          {profile.verified && (
            <div className="profile-verified-line">{verifiedReasonLabel(profile.verifiedReason)}</div>
          )}
          {profile.bio ? <p className="profile-bio">{profile.bio}</p> : null}
          <div className="profile-stats">
            <button type="button" className="profile-stat" onClick={() => void openFollowList('followers')}>
              <strong>{followers}</strong>
              <span>seguidores</span>
            </button>
            <button type="button" className="profile-stat" onClick={() => void openFollowList('following')}>
              <strong>{followingCount}</strong>
              <span>siguiendo</span>
            </button>
            <div className="profile-stat profile-stat-static">
              <strong>{playlists.length}</strong>
              <span>listas</span>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-actions">
        <button type="button" onClick={() => void shareProfile()}>
          <Share24Regular /> Compartir perfil
        </button>
        {isOwn ? (
          <>
            <button type="button" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Cerrar edición' : 'Editar perfil'}
            </button>
            {!profile.verified && (
              <button
                type="button"
                className="profile-verify-btn"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      await requestVerification(profile.nickname, 'Quiero el check de creador');
                      showToast('Solicitud de verificación enviada', 'premium');
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Error', 'info');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Solicitar ✓
              </button>
            )}
          </>
        ) : (
          myNickname && (
            <button
              type="button"
              className={following ? 'following' : ''}
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const on = await toggleFollowCreator(myNickname, targetNickname);
                    setFollowing(on);
                    setFollowers((n) => Math.max(0, n + (on ? 1 : -1)));
                    showToast(on ? `Seguís a ${targetNickname}` : 'Dejaste de seguir', 'success');
                  } catch {
                    showToast('No se pudo seguir', 'info');
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {following ? 'Siguiendo' : 'Seguir'}
            </button>
          )
        )}
      </div>

      {listMode && (
        <div className="profile-follow-sheet" role="dialog" aria-label={listMode === 'followers' ? 'Seguidores' : 'Siguiendo'}>
          <div className="profile-follow-sheet-inner">
            <div className="profile-follow-sheet-head">
              <strong>{listMode === 'followers' ? 'Seguidores' : 'Siguiendo'}</strong>
              <button type="button" onClick={() => setListMode(null)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            {listLoading ? (
              <p className="profile-follow-empty">Cargando…</p>
            ) : listNames.length === 0 ? (
              <p className="profile-follow-empty">
                {listMode === 'followers' ? 'Todavía no tiene seguidores' : 'Todavía no sigue a nadie'}
              </p>
            ) : (
              <ul className="profile-follow-list">
                {listNames.map((n) => (
                  <li key={n}>
                    <NicknameWithBadge name={n} verified={nickIsVerified(n)} reason={reasonFor(n)} />
                    <span className="profile-follow-at">@{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {isOwn && editing && (
        <form
          className="profile-edit"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              setSaving(true);
              try {
                const updated = await updateMyProfileFields({ displayName, bio });
                if (updated) setProfile(updated);
                setEditing(false);
                showToast('Perfil actualizado', 'success');
              } catch (err) {
                showToast(err instanceof Error ? err.message : 'No se pudo guardar', 'error');
              } finally {
                setSaving(false);
              }
            })();
          }}
        >
          <label>
            Nombre para mostrar
            <input
              value={displayName}
              maxLength={48}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label>
            Bio
            <textarea
              value={bio}
              maxLength={160}
              rows={3}
              placeholder="Contá quién sos / qué tipo de música subís…"
              onChange={(e) => setBio(e.target.value)}
            />
            <span className="profile-bio-count">{bio.length}/160</span>
          </label>
          <button type="submit" disabled={saving || !myUserId}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}

      <div className="profile-section">
        <h3>Listas públicas</h3>
        {playlists.length === 0 ? (
          <p className="profile-empty-lists">
            {isOwn
              ? 'Publicá una lista en Globales para que aparezca acá'
              : 'Todavía no publicó listas en la nube'}
          </p>
        ) : (
          <div className="profile-playlists">
            {playlists.map((pl) => (
              <div key={pl.id} className="profile-playlist-card">
                <div className="profile-playlist-cover">
                  {pl.cover ? (
                    <img src={pl.cover} alt="" />
                  ) : (
                    <MusicNote224Filled />
                  )}
                </div>
                <div className="profile-playlist-info">
                  <strong>{pl.name}</strong>
                  <span>
                    {pl.trackCount} temas · {pl.playCount} plays
                  </span>
                </div>
                <div className="profile-playlist-actions">
                  {playCloudPlaylist && (
                    <button
                      type="button"
                      title="Reproducir"
                      onClick={() => {
                        // Fetch full playlist tracks via share util path — use play count entry
                        void (async () => {
                          try {
                            const { fetchCloudPlaylistById } = await import('../../utils/fetchCloudPlaylist');
                            const full = await fetchCloudPlaylistById(pl.id);
                            if (full?.tracks?.length) {
                              playCloudPlaylist(full.tracks, 'full', {
                                playlistId: pl.id,
                                playlistName: pl.name,
                              });
                              showToast(`Reproduciendo "${pl.name}"`, 'info');
                            }
                          } catch {
                            showToast('No se pudo abrir la lista', 'error');
                          }
                        })();
                      }}
                    >
                      <Play24Filled />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Compartir"
                    onClick={() => {
                      void (async () => {
                        const result = await shareOrCopy({
                          title: `${pl.name} · NEX Music`,
                          text: `Lista de @${targetNickname}`,
                          url: buildCloudPlaylistShareUrl(pl.id),
                        });
                        const msg = shareResultToast(result);
                        if (msg) showToast(msg, 'success');
                      })();
                    }}
                  >
                    <Share24Regular />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .profile-view { padding-bottom: 32px; }
        .profile-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          font-size: 13px;
          margin-bottom: 12px;
          padding: 0;
        }
        .profile-hero {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }
        .profile-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1d9bf0, #12d6c5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 800;
          color: #041018;
          flex-shrink: 0;
        }
        .profile-hero-text h2 {
          margin: 0;
          font-size: 22px;
          display: flex;
          align-items: center;
        }
        .profile-handle {
          color: rgba(255,255,255,0.5);
          font-size: 14px;
          margin-top: 4px;
        }
        .profile-verified-line {
          margin-top: 6px;
          font-size: 12px;
          color: #1d9bf0;
          font-weight: 600;
        }
        .profile-bio {
          margin: 10px 0 0;
          font-size: 14px;
          line-height: 1.45;
          color: rgba(255,255,255,0.8);
        }
        .profile-stats {
          display: flex;
          gap: 8px;
          margin-top: 14px;
          flex-wrap: wrap;
        }
        .profile-stat {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 8px 14px;
          color: #fff;
          cursor: pointer;
          font: inherit;
          min-width: 88px;
        }
        .profile-stat-static { cursor: default; }
        .profile-stat strong { font-size: 16px; font-weight: 800; }
        .profile-stat span { font-size: 11px; color: rgba(255,255,255,0.5); }
        .profile-follow-sheet {
          position: fixed;
          inset: 0;
          z-index: 350;
          background: rgba(0,0,0,0.55);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 16px;
        }
        .profile-follow-sheet-inner {
          width: min(420px, 100%);
          max-height: min(60vh, 480px);
          overflow: auto;
          background: #12161c;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px 16px 12px 12px;
          padding: 14px;
        }
        .profile-follow-sheet-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .profile-follow-sheet-head button {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          font-size: 16px;
        }
        .profile-follow-empty {
          font-size: 13px;
          color: rgba(255,255,255,0.45);
          margin: 8px 0;
        }
        .profile-follow-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .profile-follow-list li {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 10px;
          border-radius: 10px;
          background: rgba(255,255,255,0.04);
          font-weight: 700;
          font-size: 14px;
        }
        .profile-follow-at {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255,255,255,0.4);
        }
        .profile-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 16px 0;
        }
        .profile-actions button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: none;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          background: rgba(255,255,255,0.1);
          color: #fff;
        }
        .profile-actions button.following {
          background: rgba(29,155,240,0.2);
          color: #8ecdf8;
        }
        .profile-verify-btn { background: #1d9bf0 !important; }
        .profile-edit {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 18px;
        }
        .profile-edit label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          color: rgba(255,255,255,0.55);
        }
        .profile-edit input,
        .profile-edit textarea {
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          color: #fff;
          padding: 10px 12px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
        }
        .profile-bio-count {
          align-self: flex-end;
          font-size: 11px;
          color: rgba(255,255,255,0.35);
        }
        .profile-edit button[type="submit"] {
          align-self: flex-start;
          background: #1db954;
          color: #04120a;
          border: none;
          border-radius: 999px;
          padding: 10px 16px;
          font-weight: 800;
          cursor: pointer;
        }
        .profile-section h3 {
          margin: 8px 0 12px;
          font-size: 15px;
        }
        .profile-empty-lists, .profile-empty-hint {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
        }
        .profile-playlists {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .profile-playlist-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .profile-playlist-cover {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          overflow: hidden;
          background: #222;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .profile-playlist-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .profile-playlist-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .profile-playlist-info strong {
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .profile-playlist-info span {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
        }
        .profile-playlist-actions {
          display: flex;
          gap: 4px;
        }
        .profile-playlist-actions button {
          background: rgba(255,255,255,0.08);
          border: none;
          color: #fff;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default ProfileView;
