import React from 'react';

interface PwaInstallBannerProps {
  open: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({ open, onInstall, onDismiss }) => {
  if (!open) return null;
  return (
    <div className="nex-pwa-banner" role="dialog" aria-label="Instalar NEX Music">
      <div>
        <strong>Instalá NEX Music</strong>
        <p>Acceso rápido desde el inicio · suena mejor como app</p>
      </div>
      <div className="nex-pwa-actions">
        <button type="button" className="nex-pwa-install" onClick={onInstall}>Instalar</button>
        <button type="button" className="nex-pwa-dismiss" onClick={onDismiss}>Ahora no</button>
      </div>
      <style>{`
        .nex-pwa-banner {
          position: fixed;
          top: calc(12px + env(safe-area-inset-top, 0px));
          left: 50%;
          transform: translateX(-50%);
          width: min(440px, calc(100vw - 24px));
          z-index: 150;
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          background: #101010;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 12px 14px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.45);
        }
        .nex-pwa-banner strong { display:block; font-size: 13px; }
        .nex-pwa-banner p { margin: 2px 0 0; font-size: 12px; color: rgba(255,255,255,0.55); }
        .nex-pwa-actions { display:flex; gap:6px; flex-shrink:0; }
        .nex-pwa-install {
          background:#1db954; color:#000; border:none; border-radius:999px;
          padding:8px 12px; font-size:12px; font-weight:700; cursor:pointer;
        }
        .nex-pwa-dismiss {
          background:transparent; color:rgba(255,255,255,0.55); border:none;
          font-size:12px; cursor:pointer;
        }
      `}</style>
    </div>
  );
};

export default PwaInstallBanner;
