import React, { useState, useEffect, useCallback, useRef } from 'react';
import { hermesApi, type StatusResponse } from './api';

export default function StatusView() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await hermesApi.getStatus();
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStatus]);

  const statusColor = (s: string) => {
    if (s === 'running' || s === 'ok' || s === 'active') return '#34d399';
    if (s === 'idle') return '#fbbf24';
    return '#f87171';
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.pageIcon}>⚡</span>
          <div>
            <div style={styles.pageTitle}>Estado del Sistema</div>
            <div style={styles.pageSubtitle}>Información en tiempo real del agente Hermes</div>
          </div>
        </div>
        <button style={styles.refreshBtn} onClick={fetchStatus}>
          ↻ Actualizar
        </button>
      </div>

      {loading && !status && (
        <div style={styles.loadingState}>
          <div style={styles.spinner} />
          <span style={{ color: '#ffe6cb99', fontSize: 14 }}>Cargando estado...</span>
        </div>
      )}

      {error && (
        <div style={styles.errorCard}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <div style={{ color: '#f87171', fontWeight: 600 }}>Error al obtener estado</div>
            <div style={{ color: '#ffe6cb80', fontSize: 13, marginTop: 4 }}>{error}</div>
          </div>
        </div>
      )}

      {status && (
        <div style={styles.grid}>
          {/* Agent Status */}
          <div style={styles.card}>
            <div style={styles.cardLabel}>Estado del Agente</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                background: statusColor(status.status),
                boxShadow: `0 0 8px ${statusColor(status.status)}`,
                animation: status.status === 'running' ? 'hPulse 2s infinite' : 'none',
              }} />
              <span style={{ color: '#ffe6cb', fontSize: 20, fontWeight: 700, textTransform: 'capitalize' }}>
                {status.status}
              </span>
            </div>
            {status.version && (
              <div style={styles.cardMeta}>Versión: {status.version}</div>
            )}
            {status.uptime_seconds != null && (
              <div style={styles.cardMeta}>
                Uptime: {formatUptime(status.uptime_seconds)}
              </div>
            )}
          </div>

          {/* Model */}
          {(status.model || status.provider) && (
            <div style={styles.card}>
              <div style={styles.cardLabel}>Modelo Activo</div>
              <div style={{ color: '#ffe6cb', fontSize: 18, fontWeight: 700, marginTop: 8 }}>
                {status.model?.split('/').pop() ?? '—'}
              </div>
              {status.provider && (
                <div style={styles.cardMeta}>Provider: {status.provider}</div>
              )}
              {status.profile && (
                <div style={styles.cardMeta}>Perfil: {status.profile}</div>
              )}
            </div>
          )}

          {/* Sessions */}
          {status.active_sessions != null && (
            <div style={styles.card}>
              <div style={styles.cardLabel}>Sesiones Activas</div>
              <div style={{ color: '#34d399', fontSize: 36, fontWeight: 700, marginTop: 8 }}>
                {status.active_sessions}
              </div>
            </div>
          )}

          {/* Gateway */}
          {status.gateway && (
            <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
              <div style={styles.cardLabel}>Gateway</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                  background: statusColor(status.gateway.status),
                }} />
                <span style={{ color: '#ffe6cb', fontWeight: 600, textTransform: 'capitalize' }}>
                  {status.gateway.status}
                </span>
              </div>
              {status.gateway.platforms && status.gateway.platforms.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {status.gateway.platforms.map(p => (
                    <span key={p} style={styles.platformBadge}>{p}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes hPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #34d399; }
          50% { opacity: 0.5; box-shadow: 0 0 16px #34d399; }
        }
      `}</style>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    padding: '4px 0',
    overflowY: 'auto',
    flex: 1,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  pageIcon: {
    fontSize: 28,
  },
  pageTitle: {
    color: '#ffe6cb',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  pageSubtitle: {
    color: '#ffe6cb60',
    fontSize: 13,
    marginTop: 2,
  },
  refreshBtn: {
    background: 'rgba(255,230,203,0.08)',
    border: '1px solid rgba(255,230,203,0.15)',
    borderRadius: 8,
    color: '#ffe6cb',
    cursor: 'pointer',
    fontSize: 13,
    padding: '6px 14px',
    transition: 'background 0.2s',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '40px 0',
    justifyContent: 'center',
  },
  spinner: {
    width: 24,
    height: 24,
    border: '2px solid rgba(255,230,203,0.15)',
    borderTopColor: '#34d399',
    borderRadius: '50%',
    animation: 'hSpin 1s linear infinite',
  },
  errorCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    background: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: 12,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  card: {
    background: 'rgba(255,230,203,0.04)',
    border: '1px solid rgba(255,230,203,0.12)',
    borderRadius: 12,
    padding: 20,
    transition: 'border-color 0.2s',
  },
  cardLabel: {
    color: '#ffe6cb60',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  cardMeta: {
    color: '#ffe6cb60',
    fontSize: 12,
    marginTop: 6,
  },
  platformBadge: {
    background: 'rgba(52,211,153,0.1)',
    border: '1px solid rgba(52,211,153,0.2)',
    borderRadius: 6,
    color: '#34d399',
    fontSize: 12,
    padding: '3px 10px',
    textTransform: 'capitalize',
  },
};
