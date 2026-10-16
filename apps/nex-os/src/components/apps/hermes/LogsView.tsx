import React, { useState, useEffect, useCallback, useRef } from 'react';
import { hermesApi } from './api';

const FILES = ['agent', 'errors', 'gateway'] as const;
const LEVELS = ['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR'] as const;
const COMPONENTS = ['all', 'gateway', 'agent', 'tools', 'cli', 'cron'] as const;
const LINE_COUNTS = [50, 100, 200, 500] as const;

type LogFile = (typeof FILES)[number];
type LogLevel = (typeof LEVELS)[number];
type LogComponent = (typeof COMPONENTS)[number];
type LogLines = (typeof LINE_COUNTS)[number];

function classifyLine(line: string): 'error' | 'warning' | 'info' | 'debug' {
  const u = line.toUpperCase();
  if (u.includes('ERROR') || u.includes('CRITICAL') || u.includes('FATAL')) return 'error';
  if (u.includes('WARNING') || u.includes('WARN')) return 'warning';
  if (u.includes('DEBUG')) return 'debug';
  return 'info';
}

const LINE_COLORS: Record<string, string> = {
  error: '#f87171',
  warning: '#fbbf24',
  info: '#ffe6cb',
  debug: '#ffe6cb50',
};

type FilterOption<T extends string> = {
  value: T;
  label: string;
};

function FilterPill<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={filterLabel}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              background: value === opt ? 'rgba(52,211,153,0.2)' : 'rgba(255,230,203,0.06)',
              border: `1px solid ${value === opt ? 'rgba(52,211,153,0.4)' : 'rgba(255,230,203,0.12)'}`,
              borderRadius: 6,
              color: value === opt ? '#34d399' : '#ffe6cb80',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: value === opt ? 700 : 400,
              padding: '4px 10px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}
          >{opt}</button>
        ))}
      </div>
    </div>
  );
}

export default function LogsView() {
  const [file, setFile] = useState<LogFile>('agent');
  const [level, setLevel] = useState<LogLevel>('ALL');
  const [component, setComponent] = useState<LogComponent>('all');
  const [lineCount, setLineCount] = useState<LogLines>(100);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await hermesApi.getLogs({ file, lines: lineCount, level, component });
      setLines(resp.lines);
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [file, lineCount, level, component]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(fetchLogs, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>📋</span>
          <div>
            <div style={{ color: '#ffe6cb', fontSize: 18, fontWeight: 700 }}>Logs</div>
            <div style={{ color: '#ffe6cb50', fontSize: 12 }}>{lines.length} líneas cargadas</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <span style={{ color: '#ffe6cb80', fontSize: 12 }}>Auto-refresh</span>
            <div
              onClick={() => setAutoRefresh(a => !a)}
              style={{
                width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                background: autoRefresh ? 'rgba(52,211,153,0.6)' : 'rgba(255,230,203,0.15)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: autoRefresh ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </div>
          </label>
          {autoRefresh && (
            <span style={{
              background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)',
              borderRadius: 20, color: '#34d399', fontSize: 10, padding: '2px 8px',
              animation: 'hPulse 2s infinite',
            }}>● LIVE</span>
          )}
          <button
            onClick={fetchLogs}
            disabled={loading}
            style={{
              background: 'rgba(255,230,203,0.08)', border: '1px solid rgba(255,230,203,0.15)',
              borderRadius: 8, color: '#ffe6cb', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, padding: '6px 12px', opacity: loading ? 0.5 : 1,
            }}
          >↻</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 20,
        padding: '14px 16px',
        background: 'rgba(255,230,203,0.03)',
        border: '1px solid rgba(255,230,203,0.08)',
        borderRadius: 10,
      }}>
        <FilterPill label="Archivo" value={file} options={FILES} onChange={setFile} />
        <FilterPill label="Nivel" value={level} options={LEVELS} onChange={setLevel} />
        <FilterPill label="Componente" value={component} options={COMPONENTS} onChange={setComponent} />
        <FilterPill
          label="Líneas"
          value={String(lineCount) as any}
          options={LINE_COUNTS.map(String) as any}
          onChange={(v) => setLineCount(Number(v) as LogLines)}
        />
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, padding: 14, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Log output */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        border: '1px solid rgba(255,230,203,0.08)',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
          borderBottom: '1px solid rgba(255,230,203,0.08)',
          background: 'rgba(255,230,203,0.03)',
        }}>
          <span style={{ color: '#ffe6cb60', fontSize: 13 }}>📄 {file}.log</span>
        </div>
        <div
          ref={scrollRef}
          style={{
            flex: 1, overflowY: 'auto', padding: '12px 16px',
            fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
            fontSize: 12, lineHeight: 1.7,
          }}
        >
          {loading && lines.length === 0 && (
            <div style={{ color: '#ffe6cb40', textAlign: 'center', padding: 20 }}>Cargando...</div>
          )}
          {!loading && lines.length === 0 && !error && (
            <div style={{ color: '#ffe6cb40', textAlign: 'center', padding: 20 }}>Sin logs disponibles</div>
          )}
          {lines.map((line, i) => {
            const cls = classifyLine(line);
            return (
              <div
                key={i}
                style={{
                  color: LINE_COLORS[cls],
                  padding: '1px 4px', margin: '0 -4px',
                  borderRadius: 4,
                  wordBreak: 'break-all',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,230,203,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {line}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const filterLabel: React.CSSProperties = {
  color: '#ffe6cb50',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};
