import React, { useCallback, useEffect, useState } from 'react';
import type { VerifiedReason } from '../../utils/userProfiles';
import {
  loadStaffKey,
  saveStaffKey,
  staffListPending,
  staffRejectRequest,
  staffSetKey,
  staffUnlock,
  staffUnverifyNickname,
  staffVerifyNickname,
  type PendingVerification,
} from '../../utils/staffVerify';

interface StaffVerifyPanelProps {
  open: boolean;
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'premium') => void;
}

const REASONS: { id: VerifiedReason; label: string }[] = [
  { id: 'creator', label: 'Creador' },
  { id: 'artist', label: 'Artista' },
  { id: 'staff', label: 'Staff' },
  { id: 'partner', label: 'Partner' },
];

const StaffVerifyPanel: React.FC<StaffVerifyPanelProps> = ({ open, onClose, showToast }) => {
  const [keyInput, setKeyInput] = useState(() => loadStaffKey());
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingVerification[]>([]);
  const [nick, setNick] = useState('');
  const [reason, setReason] = useState<VerifiedReason>('creator');
  const [newKey, setNewKey] = useState('');

  const refreshPending = useCallback(async (key: string) => {
    const rows = await staffListPending(key);
    setPending(rows);
  }, []);

  useEffect(() => {
    if (!open) return;
    const stored = loadStaffKey();
    if (!stored) return;
    void staffUnlock(stored)
      .then(async (ok) => {
        setUnlocked(ok);
        if (ok) await refreshPending(stored);
      })
      .catch(() => setUnlocked(false));
  }, [open, refreshPending]);

  if (!open) return null;

  const key = loadStaffKey() || keyInput;

  return (
    <div className="staff-verify-overlay" role="dialog" aria-label="Staff verificación">
      <div className="staff-verify-panel">
        <div className="staff-verify-header">
          <strong>Staff · Verificaciones</strong>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {!unlocked ? (
          <form
            className="staff-verify-unlock"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                setBusy(true);
                try {
                  const ok = await staffUnlock(keyInput.trim());
                  if (!ok) throw new Error('Clave incorrecta');
                  saveStaffKey(keyInput.trim());
                  setUnlocked(true);
                  await refreshPending(keyInput.trim());
                  showToast('Staff desbloqueado', 'success');
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'No se pudo desbloquear', 'error');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <p className="staff-verify-hint">
              Clave staff (una sola vez en Supabase). Default inicial:{' '}
              <code>nex-staff-cambia-esto</code>
            </p>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Clave staff"
              autoFocus
            />
            <button type="submit" disabled={busy || keyInput.trim().length < 6}>
              {busy ? '…' : 'Entrar'}
            </button>
          </form>
        ) : (
          <>
            <section className="staff-verify-section">
              <h4>Solicitudes pendientes</h4>
              {pending.length === 0 ? (
                <p className="staff-verify-empty">No hay solicitudes</p>
              ) : (
                <ul className="staff-pending-list">
                  {pending.map((row) => (
                    <li key={row.id}>
                      <div>
                        <strong>{row.nickname}</strong>
                        {row.message ? <span> — {row.message}</span> : null}
                        <div className="staff-pending-date">
                          {new Date(row.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="staff-pending-actions">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void (async () => {
                              setBusy(true);
                              try {
                                await staffVerifyNickname(row.nickname, 'creator', key);
                                await refreshPending(key);
                                showToast(`${row.nickname} verificado ✓`, 'premium');
                              } catch (err) {
                                showToast(err instanceof Error ? err.message : 'Error', 'error');
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={busy}
                          onClick={() => {
                            void (async () => {
                              setBusy(true);
                              try {
                                await staffRejectRequest(row.id, key);
                                await refreshPending(key);
                                showToast('Solicitud rechazada', 'info');
                              } catch (err) {
                                showToast(err instanceof Error ? err.message : 'Error', 'error');
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          Rechazar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="staff-refresh"
                disabled={busy}
                onClick={() => {
                  void refreshPending(key).catch((err) =>
                    showToast(err instanceof Error ? err.message : 'Error', 'error'),
                  );
                }}
              >
                Actualizar lista
              </button>
            </section>

            <section className="staff-verify-section">
              <h4>Verificar nickname</h4>
              <div className="staff-verify-row">
                <input
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  placeholder="Nickname"
                />
                <select value={reason} onChange={(e) => setReason(e.target.value as VerifiedReason)}>
                  {REASONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="staff-verify-row">
                <button
                  type="button"
                  disabled={busy || !nick.trim()}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        await staffVerifyNickname(nick, reason, key);
                        setNick('');
                        await refreshPending(key);
                        showToast(`${nick.trim()} verificado ✓`, 'premium');
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Error', 'error');
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Dar ✓
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={busy || !nick.trim()}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        await staffUnverifyNickname(nick, key);
                        showToast(`${nick.trim()} ya no está verificado`, 'info');
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Error', 'error');
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Quitar ✓
                </button>
              </div>
            </section>

            <section className="staff-verify-section">
              <h4>Cambiar clave staff</h4>
              <div className="staff-verify-row">
                <input
                  type="password"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Nueva clave (mín. 8)"
                />
                <button
                  type="button"
                  disabled={busy || newKey.trim().length < 8}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        await staffSetKey(key, newKey.trim());
                        saveStaffKey(newKey.trim());
                        setKeyInput(newKey.trim());
                        setNewKey('');
                        showToast('Clave staff actualizada', 'success');
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Error', 'error');
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Guardar
                </button>
              </div>
              <button
                type="button"
                className="staff-logout"
                onClick={() => {
                  saveStaffKey('');
                  setUnlocked(false);
                  setKeyInput('');
                }}
              >
                Cerrar sesión staff
              </button>
            </section>
          </>
        )}
      </div>

      <style>{`
        .staff-verify-overlay {
          position: fixed;
          inset: 0;
          z-index: 400;
          background: rgba(0,0,0,0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .staff-verify-panel {
          width: min(440px, 100%);
          max-height: min(85vh, 640px);
          overflow: auto;
          background: linear-gradient(165deg, #141820 0%, #0c1218 100%);
          border: 1px solid rgba(29,155,240,0.35);
          border-radius: 16px;
          padding: 16px;
          color: #fff;
        }
        .staff-verify-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
        .staff-verify-header button {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          font-size: 16px;
        }
        .staff-verify-hint {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          margin: 0 0 10px;
          line-height: 1.4;
        }
        .staff-verify-hint code {
          color: #8ecdf8;
          font-size: 11px;
        }
        .staff-verify-unlock input,
        .staff-verify-row input,
        .staff-verify-row select {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          color: #fff;
          padding: 10px 12px;
          font-size: 14px;
        }
        .staff-verify-unlock button,
        .staff-verify-row button,
        .staff-refresh,
        .staff-logout,
        .staff-pending-actions button {
          border: none;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          background: #1d9bf0;
          color: #fff;
        }
        .staff-verify-unlock {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .staff-verify-section {
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .staff-verify-section h4 {
          margin: 0 0 10px;
          font-size: 13px;
          color: rgba(255,255,255,0.7);
        }
        .staff-verify-empty {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          margin: 0 0 8px;
        }
        .staff-pending-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .staff-pending-list li {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
          background: rgba(255,255,255,0.04);
          border-radius: 10px;
          padding: 10px;
          font-size: 13px;
        }
        .staff-pending-date {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          margin-top: 4px;
        }
        .staff-pending-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .staff-pending-actions button.danger,
        .staff-verify-row button.danger {
          background: rgba(255,80,80,0.85);
        }
        .staff-verify-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }
        .staff-refresh, .staff-logout {
          background: rgba(255,255,255,0.1);
          margin-top: 8px;
        }
        .staff-logout { width: 100%; }
      `}</style>
    </div>
  );
};

export default StaffVerifyPanel;
