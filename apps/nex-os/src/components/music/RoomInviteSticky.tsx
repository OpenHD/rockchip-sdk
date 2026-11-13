import React from 'react';
import { qrImageUrl } from '../../utils/qr';

interface RoomInviteStickyProps {
  roomCode: string;
  inviteUrl: string;
  onInvite: () => void;
  onOpenPanel: () => void;
}

const RoomInviteSticky: React.FC<RoomInviteStickyProps> = ({
  roomCode,
  inviteUrl,
  onInvite,
  onOpenPanel,
}) => (
  <div className="nex-room-sticky">
    <button type="button" className="nex-room-sticky-main" onClick={onOpenPanel}>
      <span className="live-dot" />
      Sala {roomCode}
    </button>
    <button type="button" className="nex-room-sticky-invite" onClick={onInvite}>
      Invitar
    </button>
    <img
      className="nex-room-sticky-qr"
      src={qrImageUrl(inviteUrl, 64)}
      alt={`QR sala ${roomCode}`}
      title="Escaneá para unirte"
    />
    <style>{`
      .nex-room-sticky {
        position: fixed;
        top: calc(12px + env(safe-area-inset-top, 0px));
        right: 12px;
        z-index: 130;
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(10,10,10,0.92);
        border: 1px solid rgba(29,185,84,0.4);
        border-radius: 999px;
        padding: 6px 8px 6px 12px;
        backdrop-filter: blur(10px);
      }
      .nex-room-sticky-main {
        display:flex; align-items:center; gap:6px;
        background:transparent; border:none; color:#fff;
        font-size:12px; font-weight:700; cursor:pointer;
      }
      .live-dot {
        width:8px; height:8px; border-radius:50%;
        background:#1db954; box-shadow:0 0 8px #1db954;
      }
      .nex-room-sticky-invite {
        background:#1db954; color:#000; border:none; border-radius:999px;
        padding:6px 10px; font-size:11px; font-weight:700; cursor:pointer;
      }
      .nex-room-sticky-qr {
        width:36px; height:36px; border-radius:8px; background:#fff;
      }
      @media (max-width: 640px) {
        .nex-room-sticky { top: calc(56px + env(safe-area-inset-top, 0px)); }
      }
    `}</style>
  </div>
);

export default RoomInviteSticky;
