import React from 'react';
import type { CloudSyncStatus } from '../../hooks/useCloudLibrary';

interface CloudSyncBadgeProps {
  status: CloudSyncStatus;
  compact?: boolean;
}

const CloudSyncBadge: React.FC<CloudSyncBadgeProps> = ({ status, compact }) => {
  if (status === 'off') return null;

  const label =
    status === 'connecting'
      ? 'Conectando…'
      : status === 'saving'
        ? 'Guardando en la nube…'
        : status === 'error'
          ? 'Error de sync'
          : 'Biblioteca sincronizada';

  return (
    <div
      className={`cloud-sync-badge cloud-sync-${status}${compact ? ' cloud-sync-compact' : ''}`}
      title={
        status === 'error'
          ? 'No se pudo sincronizar con Supabase. Revisá auth anónima y variables de entorno.'
          : 'Favoritos e historial respaldados en Supabase'
      }
      role="status"
      aria-live="polite"
    >
      <span className="cloud-sync-icon" aria-hidden="true">☁️</span>
      {!compact && <span className="cloud-sync-label">{label}</span>}
      <style>{`
        .cloud-sync-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid transparent;
          transition: all 0.25s ease;
        }
        .cloud-sync-compact {
          margin-top: 0;
          padding: 3px 8px;
          font-size: 11px;
        }
        .cloud-sync-connecting {
          color: rgba(255,255,255,0.65);
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.1);
        }
        .cloud-sync-connecting .cloud-sync-icon {
          animation: cloudPulse 1.2s ease-in-out infinite;
        }
        .cloud-sync-saving {
          color: #fde68a;
          background: rgba(251,191,36,0.12);
          border-color: rgba(251,191,36,0.3);
        }
        .cloud-sync-saving .cloud-sync-icon {
          animation: cloudPulse 0.8s ease-in-out infinite;
        }
        .cloud-sync-synced {
          color: #a5f3fc;
          background: rgba(56,189,248,0.12);
          border-color: rgba(56,189,248,0.35);
          box-shadow: 0 0 12px rgba(56,189,248,0.15);
        }
        .cloud-sync-error {
          color: #fecaca;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }
        .cloud-sync-synced .cloud-sync-icon {
          animation: cloudGlow 2.5s ease-in-out infinite;
        }
        @keyframes cloudPulse {
          0%, 100% { opacity: 0.5; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes cloudGlow {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(56,189,248,0.4)); }
          50% { filter: drop-shadow(0 0 6px rgba(56,189,248,0.8)); }
        }
      `}</style>
    </div>
  );
};

export default CloudSyncBadge;
