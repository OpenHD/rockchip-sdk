import React, { useCallback, useEffect, useRef, useState } from 'react';
import { People24Regular, Search24Regular } from '@fluentui/react-icons';
import { useUserProfiles } from '../../hooks/useUserProfiles';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  searchUserProfiles,
  verifiedReasonLabel,
  type ProfilePublic,
  type VerifiedReason,
} from '../../utils/userProfiles';
import {
  loadStaffKey,
  staffUnlock,
  staffVerifyNickname,
  staffUnverifyNickname,
} from '../../utils/staffVerify';
import { toggleFollowCreator } from '../../utils/socialCloud';
import { NicknameWithBadge } from './VerifiedBadge';
import StaffVerifyPanel from './StaffVerifyPanel';
import ProfileView from './ProfileView';
import type { CloudPlayMode } from '../../utils/cloudPlaylist';
import type { Track } from '../../types/music';

interface UsersDirectoryViewProps {
  nickname: string;
  supabaseUserId: string | null;
  supabaseAuthReady: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'premium') => void;
  /** Open directly on this nickname (deep link / Mi perfil) */
  initialProfileNick?: string | null;
  /** Force own profile mode */
  forceOwnProfile?: boolean;
  /** Called when leaving a profile (clears deep link, etc.) */
  onProfileClosed?: () => void;
  /** Back from Mi perfil tab */
  onLeaveOwnProfile?: () => void;
  playCloudPlaylist?: (
    tracks: Track[],
    mode: CloudPlayMode,
    meta?: { playlistId?: string; playlistName?: string },
  ) => void;
}

const UsersDirectoryView: React.FC<UsersDirectoryViewProps> = ({
  nickname,
  supabaseUserId,
  supabaseAuthReady,
  showToast,
  initialProfileNick = null,
  forceOwnProfile = false,
  onProfileClosed,
  onLeaveOwnProfile,
  playCloudPlaylist,
}) => {
  const { myProfile, isVerified } = useUserProfiles(nickname, supabaseUserId);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfilePublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [staffReady, setStaffReady] = useState(false);
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [busyNick, setBusyNick] = useState<string | null>(null);
  const deepLinkAppliedRef = useRef<string | null>(null);
  const [selectedNick, setSelectedNick] = useState<string | null>(() => {
    if (forceOwnProfile && nickname) return nickname;
    return initialProfileNick;
  });

  useEffect(() => {
    if (forceOwnProfile && nickname) setSelectedNick(nickname);
  }, [forceOwnProfile, nickname]);

  // Apply deep link once — don't re-open profile after Volver
  useEffect(() => {
    if (!initialProfileNick) {
      deepLinkAppliedRef.current = null;
      return;
    }
    if (deepLinkAppliedRef.current === initialProfileNick) return;
    deepLinkAppliedRef.current = initialProfileNick;
    setSelectedNick(initialProfileNick);
  }, [initialProfileNick]);

  const closeProfile = useCallback(() => {
    setSelectedNick(null);
    onProfileClosed?.();
    if (forceOwnProfile) onLeaveOwnProfile?.();
  }, [forceOwnProfile, onLeaveOwnProfile, onProfileClosed]);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const rows = await searchUserProfiles(q);
      setResults(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseAuthReady) return;
    if (selectedNick) return;
    const t = window.setTimeout(() => {
      void runSearch(query);
    }, query ? 280 : 0);
    return () => clearTimeout(t);
  }, [query, runSearch, supabaseAuthReady, selectedNick]);

  useEffect(() => {
    const key = loadStaffKey();
    if (!key) return;
    void staffUnlock(key)
      .then(setStaffReady)
      .catch(() => setStaffReady(false));
  }, [showStaffPanel]);

  const staffKey = loadStaffKey();
  const viewingOwn =
    Boolean(selectedNick && nickname) &&
    selectedNick!.toLowerCase() === nickname.toLowerCase();

  if (selectedNick) {
    return (
      <ProfileView
        targetNickname={selectedNick}
        myNickname={nickname}
        myUserId={supabaseUserId}
        isOwn={viewingOwn}
        onBack={closeProfile}
        showToast={showToast}
        playCloudPlaylist={playCloudPlaylist}
      />
    );
  }

  return (
    <div className="spotify-list-view users-directory">
      <div className="spotify-list-header">
        <div className="users-directory-header">
          <div>
            <h2>Usuarios</h2>
            <p>Buscá creators · abrí su perfil · seguilos</p>
          </div>
          <button type="button" className="users-staff-link" onClick={() => setShowStaffPanel(true)}>
            Staff
          </button>
        </div>

        {nickname && supabaseUserId && (
          <button
            type="button"
            className="users-me-card users-me-card-btn"
            onClick={() => setSelectedNick(nickname)}
          >
            <div>
              <NicknameWithBadge
                name={nickname}
                verified={isVerified || myProfile?.verified}
                reason={myProfile?.verifiedReason}
                size="md"
              />
              <div className="users-me-sub">
                {isVerified || myProfile?.verified
                  ? verifiedReasonLabel(myProfile?.verifiedReason)
                  : 'Tocá para ver / editar tu perfil'}
              </div>
            </div>
            <span className="users-open-profile">Mi perfil →</span>
          </button>
        )}

        <div className="users-search-box">
          <Search24Regular />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar usuarios…"
            autoFocus
          />
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="spotify-empty">
          <p>Configurá Supabase para ver usuarios</p>
        </div>
      )}

      {isSupabaseConfigured && !supabaseAuthReady && (
        <div className="spotify-loading">
          <div className="spotify-spinner" />
          <p>Conectando…</p>
        </div>
      )}

      {loading && <div className="users-loading">Buscando…</div>}

      {!loading && results.length === 0 && supabaseAuthReady && (
        <div className="spotify-empty">
          <People24Regular />
          <p>
            {query.trim()
              ? 'No hay usuarios con ese nombre'
              : 'Todavía no hay perfiles · abrí la app con un nickname para aparecer'}
          </p>
        </div>
      )}

      <div className="users-list">
        {results.map((u) => {
          const isMe = nickname && u.nickname.toLowerCase() === nickname.toLowerCase();
          return (
            <div key={u.nickname} className="users-row">
              <button
                type="button"
                className="users-row-main users-row-open"
                onClick={() => setSelectedNick(u.nickname)}
              >
                <div className="users-avatar" aria-hidden>
                  {(u.displayName || u.nickname).slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="users-row-name">
                    <NicknameWithBadge
                      name={u.displayName || u.nickname}
                      verified={u.verified}
                      reason={u.verifiedReason}
                    />
                    {isMe ? <span className="users-you">vos</span> : null}
                  </div>
                  <div className="users-row-meta">
                    @{u.nickname}
                    {u.bio ? ` · ${u.bio.slice(0, 48)}${u.bio.length > 48 ? '…' : ''}` : u.verified ? ` · ${verifiedReasonLabel(u.verifiedReason)}` : ''}
                  </div>
                </div>
              </button>
              <div className="users-row-actions">
                {!isMe && nickname && (
                  <button
                    type="button"
                    disabled={busyNick === u.nickname}
                    onClick={(e) => {
                      e.stopPropagation();
                      void (async () => {
                        setBusyNick(u.nickname);
                        try {
                          const on = await toggleFollowCreator(nickname, u.nickname);
                          showToast(on ? `Seguís a ${u.nickname}` : `Dejaste de seguir`, 'success');
                        } catch {
                          showToast('No se pudo seguir (schema social)', 'info');
                        } finally {
                          setBusyNick(null);
                        }
                      })();
                    }}
                  >
                    Seguir
                  </button>
                )}
                {staffReady && staffKey && (
                  u.verified ? (
                    <button
                      type="button"
                      className="danger"
                      disabled={busyNick === u.nickname}
                      onClick={(e) => {
                        e.stopPropagation();
                        void (async () => {
                          setBusyNick(u.nickname);
                          try {
                            await staffUnverifyNickname(u.nickname, staffKey);
                            showToast(`✓ quitado a ${u.nickname}`, 'info');
                            await runSearch(query);
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : 'Error', 'error');
                          } finally {
                            setBusyNick(null);
                          }
                        })();
                      }}
                    >
                      Quitar ✓
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="verify"
                      disabled={busyNick === u.nickname}
                      onClick={(e) => {
                        e.stopPropagation();
                        void (async () => {
                          setBusyNick(u.nickname);
                          try {
                            await staffVerifyNickname(u.nickname, 'creator' as VerifiedReason, staffKey);
                            showToast(`${u.nickname} verificado ✓`, 'premium');
                            await runSearch(query);
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : 'Error', 'error');
                          } finally {
                            setBusyNick(null);
                          }
                        })();
                      }}
                    >
                      Dar ✓
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <StaffVerifyPanel
        open={showStaffPanel}
        onClose={() => setShowStaffPanel(false)}
        showToast={showToast}
      />

      <style>{`
        .users-directory-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .users-directory-header p {
          margin: 6px 0 0;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
        }
        .users-staff-link {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.45);
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 11px;
          cursor: pointer;
        }
        .users-me-card {
          margin-top: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          background: rgba(29,155,240,0.08);
          border: 1px solid rgba(29,155,240,0.22);
          border-radius: 12px;
          padding: 12px 14px;
          width: 100%;
          text-align: left;
          color: inherit;
          cursor: pointer;
        }
        .users-me-card-btn { font: inherit; }
        .users-open-profile {
          font-size: 12px;
          font-weight: 700;
          color: #1d9bf0;
          white-space: nowrap;
        }
        .users-me-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
          margin-top: 4px;
        }
        .users-search-box {
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 10px 14px;
        }
        .users-search-box input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-size: 15px;
        }
        .users-loading {
          padding: 16px;
          color: rgba(255,255,255,0.45);
          font-size: 13px;
        }
        .users-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px 0 24px;
        }
        .users-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 8px 8px 8px 4px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .users-row-main {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .users-row-open {
          flex: 1;
          background: transparent;
          border: none;
          color: inherit;
          text-align: left;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 10px;
          font: inherit;
        }
        .users-row-open:hover { background: rgba(255,255,255,0.04); }
        .users-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1d9bf0, #12d6c5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #041018;
          flex-shrink: 0;
        }
        .users-row-name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 14px;
        }
        .users-you {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #1d9bf0;
          background: rgba(29,155,240,0.15);
          padding: 2px 6px;
          border-radius: 999px;
        }
        .users-row-meta {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 220px;
        }
        .users-row-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .users-row-actions button {
          border: none;
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          background: rgba(255,255,255,0.1);
          color: #fff;
        }
        .users-row-actions button.verify { background: #1d9bf0; }
        .users-row-actions button.danger { background: rgba(255,80,80,0.85); }
      `}</style>
    </div>
  );
};

export default UsersDirectoryView;
