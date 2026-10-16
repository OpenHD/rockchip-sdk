import React from 'react';

interface MusicOnboardingBannerProps {
  open: boolean;
  onDismiss: () => void;
  onConnectSpotify: () => void;
  onExploreGlobal: () => void;
  onCreateRoom: () => void;
}

const MusicOnboardingBanner: React.FC<MusicOnboardingBannerProps> = ({
  open,
  onDismiss,
  onConnectSpotify,
  onExploreGlobal,
  onCreateRoom,
}) => {
  if (!open) return null;

  return (
    <div className="nex-onboarding" role="dialog" aria-label="Bienvenida NEX Music">
      <button type="button" className="nex-onboarding-close" onClick={onDismiss} aria-label="Cerrar">
        ✕
      </button>
      <div className="nex-onboarding-copy">
        <strong>Bienvenido a NEX Music</strong>
        <p>
          Importá Spotify, explorá lo que suena en la comunidad o creá una sala e invitá amigos con un link corto.
        </p>
      </div>
      <div className="nex-onboarding-actions">
        <button type="button" className="nex-onboarding-btn primary" onClick={onConnectSpotify}>
          Conectar Spotify
        </button>
        <button type="button" className="nex-onboarding-btn" onClick={onExploreGlobal}>
          Explorar listas
        </button>
        <button type="button" className="nex-onboarding-btn" onClick={onCreateRoom}>
          Crear sala live
        </button>
      </div>
      <style>{`
        .nex-onboarding {
          position: fixed;
          left: 50%;
          bottom: calc(88px + env(safe-area-inset-bottom, 0px));
          transform: translateX(-50%);
          width: min(560px, calc(100vw - 24px));
          z-index: 140;
          background: linear-gradient(145deg, #121212 0%, #0a1f12 100%);
          border: 1px solid rgba(30, 215, 96, 0.35);
          border-radius: 16px;
          padding: 16px 16px 14px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.55);
        }
        .nex-onboarding-close {
          position: absolute;
          top: 10px;
          right: 10px;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.55);
          cursor: pointer;
          font-size: 14px;
        }
        .nex-onboarding-copy strong {
          display: block;
          font-size: 15px;
          margin-bottom: 4px;
        }
        .nex-onboarding-copy p {
          margin: 0 28px 12px 0;
          font-size: 13px;
          line-height: 1.4;
          color: rgba(255,255,255,0.65);
        }
        .nex-onboarding-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .nex-onboarding-btn {
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          color: #fff;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .nex-onboarding-btn.primary {
          background: #1db954;
          color: #000;
          border-color: #1db954;
        }
        @media (max-width: 640px) {
          .nex-onboarding {
            bottom: calc(72px + env(safe-area-inset-bottom, 0px));
          }
        }
      `}</style>
    </div>
  );
};

export default MusicOnboardingBanner;
