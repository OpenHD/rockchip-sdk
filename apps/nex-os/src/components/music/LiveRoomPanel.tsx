import React, { useState } from 'react';
import {
  Dismiss24Regular,
  People24Regular,
  Copy24Regular,
  Send24Regular,
  Share24Regular,
} from '@fluentui/react-icons';
import type { ChatMessage, DjEqSettings, DjModeState, DjVoteEntry, LiveReaction, RoomUser } from '../../types/music';
import DjVotePanel from './DjVotePanel';
import { buildRoomInviteUrl, shareOrCopy, shareResultToast } from '../../utils/share';
import { qrImageUrl } from '../../utils/qr';

interface LiveRoomPanelProps {
  open: boolean;
  onClose: () => void;
  connected: boolean;
  connectionError: string | null;
  roomCode: string | null;
  isHost: boolean;
  roomUsers: RoomUser[];
  chatMessages: ChatMessage[];
  reactions: LiveReaction[];
  djMode: DjModeState;
  djPool: DjVoteEntry[];
  djEq: DjEqSettings;
  onCreateRoom: (username: string, enableDj?: boolean) => void;
  onJoinRoom: (code: string, username: string) => void;
  onLeaveRoom: () => void;
  onSendChat: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onToggleDj: (enabled: boolean) => void;
  onToggleDjAutoPlay: (autoPlay: boolean) => void;
  onUpdateDjEq: (eq: DjEqSettings) => void;
  onVoteDj: (entryId: string) => void;
  onPlayTopDj: () => void;
  onClearDj: () => void;
}

const REACTIONS = ['🔥', '❤️', '🎵', '👏', '😂', '🎧'];

export const LiveRoomPanel: React.FC<LiveRoomPanelProps> = ({
  open,
  onClose,
  connected,
  connectionError,
  roomCode,
  isHost,
  roomUsers,
  chatMessages,
  reactions,
  djMode,
  djPool,
  djEq,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onSendChat,
  onSendReaction,
  onToggleDj,
  onToggleDjAutoPlay,
  onUpdateDjEq,
  onVoteDj,
  onPlayTopDj,
  onClearDj,
}) => {
  const [username, setUsername] = useState(() => localStorage.getItem('nexMusicUsername') || '');
  const [joinCode, setJoinCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [createWithDj, setCreateWithDj] = useState(true);

  if (!open) return null;

  const saveName = (name: string) => {
    localStorage.setItem('nexMusicUsername', name);
    setUsername(name);
  };

  const copyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const inviteFriends = async () => {
    if (!roomCode || inviteBusy) return;
    setInviteBusy(true);
    try {
      const url = buildRoomInviteUrl(roomCode);
      const result = await shareOrCopy({
        title: `Sala ${roomCode} · NEX Music`,
        text: `Unite a mi sala en NEX Music (${roomCode})`,
        url,
      });
      const msg = shareResultToast(result);
      if (msg) {
        (window as any).__nexShowToast?.(msg, 'success');
      }
    } finally {
      setInviteBusy(false);
    }
  };

  const submitChat = () => {
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  return (
    <div className="live-panel-overlay" onClick={onClose}>
      <div className="live-panel" onClick={(e) => e.stopPropagation()}>
        <div className="live-panel-header">
          <div>
            <h2>Salas en vivo</h2>
            <p>Sincronizá música en tiempo real con Socket.io</p>
          </div>
          <button type="button" className="live-close" onClick={onClose} aria-label="Cerrar">
            <Dismiss24Regular />
          </button>
        </div>

        <div className={`live-status ${connected ? 'online' : 'offline'}`}>
          {connected ? '● Conectado al servidor' : '○ Sin conexión al servidor'}
        </div>

        {connectionError && !roomCode && (
          <div className="live-error">{connectionError}</div>
        )}

        {!roomCode ? (
          <div className="live-join-form">
            <label>
              Tu nombre
              <input
                value={username}
                onChange={(e) => saveName(e.target.value)}
                placeholder="Ej: Salvador"
                maxLength={24}
              />
            </label>

            <button
              type="button"
              className="live-btn primary"
              disabled={!connected}
              onClick={() => onCreateRoom(username, createWithDj)}
            >
              Crear sala
            </button>

            <label className="live-dj-create">
              <input
                type="checkbox"
                checked={createWithDj}
                onChange={(e) => setCreateWithDj(e.target.checked)}
              />
              Crear con Modo DJ (votación de cola)
            </label>

            <div className="live-divider">o unirse con código</div>

            <label>
              Código de sala
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
              />
            </label>

            <button
              type="button"
              className="live-btn"
              disabled={!connected || joinCode.trim().length < 4}
              onClick={() => onJoinRoom(joinCode, username)}
            >
              Unirse
            </button>
          </div>
        ) : (
          <>
            <div className="live-room-info">
              <div className="live-room-code">
                <span>Sala</span>
                <strong>{roomCode}</strong>
                <button type="button" className="live-copy" onClick={copyCode} title="Copiar código">
                  <Copy24Regular />
                  {copied ? 'Copiado' : 'Código'}
                </button>
                <button
                  type="button"
                  className="live-copy live-invite"
                  onClick={() => void inviteFriends()}
                  disabled={inviteBusy}
                  title="Invitar amigos con enlace"
                >
                  <Share24Regular />
                  {inviteBusy ? '…' : 'Invitar'}
                </button>
              </div>
              {roomCode && (
                <div className="live-qr-wrap">
                  <img
                    src={qrImageUrl(buildRoomInviteUrl(roomCode), 160)}
                    alt={`QR ${roomCode}`}
                    className="live-qr"
                  />
                  <span>Escaneá para unirte</span>
                </div>
              )}
              <span className={`live-role ${isHost ? 'host' : 'guest'}`}>
                {isHost ? 'Anfitrión' : 'Oyente'}
              </span>
              <button type="button" className="live-btn danger" onClick={onLeaveRoom}>
                Salir de la sala
              </button>
            </div>

            <div className="live-users">
              <div className="live-section-title">
                <People24Regular />
                <span>{roomUsers.length} conectados</span>
              </div>
              <ul>
                {roomUsers.map((user) => (
                  <li key={user.id}>
                    <span className="live-user-dot" />
                    {user.name}
                    {user.isHost && <em>host</em>}
                  </li>
                ))}
              </ul>
            </div>

            <DjVotePanel
              djMode={djMode}
              djPool={djPool}
              djEq={djEq}
              isHost={isHost}
              onToggleDj={onToggleDj}
              onToggleAutoPlay={onToggleDjAutoPlay}
              onUpdateDjEq={onUpdateDjEq}
              onVote={onVoteDj}
              onPlayTop={onPlayTopDj}
              onClear={onClearDj}
            />

            <div className="live-reactions">
              {REACTIONS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => onSendReaction(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>

            {reactions.length > 0 && (
              <div className="live-reaction-feed">
                {reactions.slice(-6).map((r) => (
                  <span key={r.key} className="live-reaction-bubble">
                    {r.emoji} <small>{r.user}</small>
                  </span>
                ))}
              </div>
            )}

            <div className="live-chat">
              <div className="live-chat-messages">
                {chatMessages.length === 0 ? (
                  <p className="live-chat-empty">Escribí algo para el chat de la sala…</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className={`live-chat-msg ${msg.user === 'Sistema' ? 'system' : ''}`}>
                      <strong>{msg.user}</strong>
                      <span>{msg.text}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="live-chat-input">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitChat()}
                  placeholder="Mensaje…"
                  maxLength={300}
                />
                <button type="button" onClick={submitChat} aria-label="Enviar">
                  <Send24Regular />
                </button>
              </div>
            </div>

            {!isHost && (
              <p className="live-hint">
                {djMode.enabled
                  ? 'Modo DJ activo: sugerí canciones desde la búsqueda y votá la cola.'
                  : 'Estás escuchando la sesión del anfitrión. Play, pausa y cola se sincronizan automáticamente.'}
              </p>
            )}
          </>
        )}

        <style>{`
          .live-panel-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.65);
            backdrop-filter: blur(6px);
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
          }

          .live-panel {
            width: min(420px, 100%);
            max-height: 90vh;
            overflow-y: auto;
            background: #121212;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            padding: 20px;
            color: #fff;
            display: flex;
            flex-direction: column;
            gap: 14px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          }

          .live-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
          }

          .live-panel-header h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 800;
          }

          .live-panel-header p {
            margin: 4px 0 0;
            font-size: 12px;
            color: rgba(255,255,255,0.55);
          }

          .live-close {
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.7);
            cursor: pointer;
            padding: 4px;
            border-radius: 8px;
          }

          .live-close:hover { background: rgba(255,255,255,0.08); color: #fff; }

          .live-status {
            font-size: 12px;
            font-weight: 600;
            padding: 8px 12px;
            border-radius: 8px;
          }

          .live-status.online {
            background: rgba(29, 185, 84, 0.15);
            color: #1db954;
          }

          .live-status.offline {
            background: rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.6);
          }

          .live-error {
            background: rgba(255, 80, 80, 0.12);
            border: 1px solid rgba(255, 80, 80, 0.35);
            color: #ffb4b4;
            font-size: 12px;
            padding: 10px 12px;
            border-radius: 8px;
            line-height: 1.4;
          }

          .live-join-form {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .live-join-form label {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 12px;
            color: rgba(255,255,255,0.65);
          }

          .live-join-form input {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            padding: 10px 12px;
            color: #fff;
            font-size: 14px;
            outline: none;
          }

          .live-join-form input:focus {
            border-color: #1db954;
          }

          .live-divider {
            text-align: center;
            font-size: 11px;
            color: rgba(255,255,255,0.45);
            margin: 4px 0;
          }

          .live-dj-create {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: rgba(255,255,255,0.7);
            cursor: pointer;
          }

          .live-btn {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            color: #fff;
            border-radius: 999px;
            padding: 10px 16px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.15s;
          }

          .live-btn:hover:not(:disabled) { background: rgba(255,255,255,0.14); }
          .live-btn:disabled { opacity: 0.4; cursor: not-allowed; }

          .live-btn.primary {
            background: #1db954;
            border-color: #1db954;
            color: #000;
          }

          .live-btn.primary:hover:not(:disabled) { background: #1ed760; }

          .live-btn.danger {
            background: transparent;
            border-color: rgba(255,100,100,0.5);
            color: #ff8a8a;
          }

          .live-room-info {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .live-room-code {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(255,255,255,0.05);
            padding: 12px;
            border-radius: 10px;
          }

          .live-room-code span {
            font-size: 11px;
            color: rgba(255,255,255,0.5);
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .live-room-code strong {
            font-size: 22px;
            letter-spacing: 4px;
          }

          .live-copy {
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 4px;
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.7);
            cursor: pointer;
            font-size: 11px;
          }

          .live-invite {
            margin-left: 0;
            background: rgba(29,185,84,0.18);
            border: 1px solid rgba(29,185,84,0.45);
            border-radius: 999px;
            padding: 6px 10px;
            color: #1ed760;
          }

          .live-qr-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            margin: 4px 0 8px;
          }
          .live-qr {
            width: 140px;
            height: 140px;
            border-radius: 12px;
            background: #fff;
            padding: 6px;
          }
          .live-qr-wrap span {
            font-size: 11px;
            color: rgba(255,255,255,0.5);
          }

          .live-role {
            font-size: 12px;
            font-weight: 700;
            align-self: flex-start;
            padding: 4px 10px;
            border-radius: 999px;
          }

          .live-role.host { background: rgba(29,185,84,0.2); color: #1db954; }
          .live-role.guest { background: rgba(96,205,255,0.15); color: #60cdff; }

          .live-section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 8px;
          }

          .live-users ul {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .live-users li {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            padding: 6px 8px;
            border-radius: 6px;
            background: rgba(255,255,255,0.04);
          }

          .live-users em {
            margin-left: auto;
            font-size: 10px;
            font-style: normal;
            color: #1db954;
            text-transform: uppercase;
          }

          .live-user-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #1db954;
          }

          .live-reactions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .live-reactions button {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 8px 10px;
            font-size: 18px;
            cursor: pointer;
          }

          .live-reactions button:hover {
            background: rgba(255,255,255,0.12);
            transform: scale(1.08);
          }

          .live-reaction-feed {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .live-reaction-bubble {
            background: rgba(255,255,255,0.08);
            padding: 4px 8px;
            border-radius: 999px;
            font-size: 14px;
          }

          .live-reaction-bubble small {
            margin-left: 4px;
            color: rgba(255,255,255,0.55);
            font-size: 10px;
          }

          .live-chat {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-height: 140px;
          }

          .live-chat-messages {
            flex: 1;
            max-height: 160px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 8px;
            background: rgba(0,0,0,0.25);
            border-radius: 10px;
          }

          .live-chat-empty {
            margin: 0;
            font-size: 12px;
            color: rgba(255,255,255,0.45);
            text-align: center;
            padding: 20px 0;
          }

          .live-chat-msg {
            display: flex;
            flex-direction: column;
            gap: 2px;
            font-size: 13px;
          }

          .live-chat-msg strong {
            color: #1db954;
            font-size: 11px;
          }

          .live-chat-msg.system strong { color: #60cdff; }

          .live-chat-input {
            display: flex;
            gap: 8px;
          }

          .live-chat-input input {
            flex: 1;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 999px;
            padding: 10px 14px;
            color: #fff;
            outline: none;
          }

          .live-chat-input button {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background: #1db954;
            color: #000;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .live-hint {
            margin: 0;
            font-size: 11px;
            color: rgba(255,255,255,0.5);
            line-height: 1.4;
          }
        `}</style>
      </div>
    </div>
  );
};

export default LiveRoomPanel;
