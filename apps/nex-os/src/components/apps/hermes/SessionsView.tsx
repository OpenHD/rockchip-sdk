import React, { useState, useEffect, useCallback, useRef } from 'react';
import { hermesApi, type SessionInfo, type SessionMessage } from './api';

const PAGE_SIZE = 20;

const SOURCE_ICONS: Record<string, string> = {
  cli: '⌨️',
  telegram: '✈️',
  discord: '🎮',
  slack: '💬',
  whatsapp: '📱',
  cron: '⏰',
  default: '🌐',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'ahora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function MessageBubble({ msg }: { msg: SessionMessage }) {
  const [expanded, setExpanded] = useState(false);
  const roleColors: Record<string, string> = {
    user: '#60a5fa',
    assistant: '#34d399',
    system: '#a78bfa',
    tool: '#fbbf24',
  };
  const color = roleColors[msg.role] ?? '#ffe6cb80';

  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 10,
      background: `${color}10`,
      border: `1px solid ${color}20`,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {msg.tool_name ? `tool: ${msg.tool_name}` : msg.role}
        </span>
        {msg.timestamp && (
          <span style={{ color: '#ffe6cb40', fontSize: 11 }}>
            {timeAgo(msg.timestamp)}
          </span>
        )}
      </div>
      {msg.content && (
        <div style={{
          color: '#ffe6cb',
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: expanded ? 'none' : '120px',
          overflow: expanded ? 'visible' : 'hidden',
        }}>
          {msg.content}
        </div>
      )}
      {msg.content && msg.content.length > 300 && (
        <button
          style={{ background: 'none', border: 'none', color: '#34d39980', cursor: 'pointer', fontSize: 12, marginTop: 4, padding: 0 }}
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? '▲ Mostrar menos' : '▼ Ver más'}
        </button>
      )}
      {msg.tool_calls && msg.tool_calls.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {msg.tool_calls.map(tc => (
            <div key={tc.id} style={{
              background: 'rgba(251,191,36,0.05)',
              border: '1px solid rgba(251,191,36,0.15)',
              borderRadius: 6,
              fontSize: 12,
              marginTop: 4,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '6px 10px', color: '#fbbf24', fontFamily: 'monospace' }}>
                🔧 {tc.function.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session,
  onDelete,
  onRename,
}: {
  session: SessionInfo;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<SessionMessage[] | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title ?? '');
  const sourceIcon = SOURCE_ICONS[session.source ?? ''] ?? SOURCE_ICONS.default;
  const hasTitle = session.title && session.title !== 'Untitled';

  const handleToggle = async () => {
    setExpanded(e => !e);
    if (!expanded && messages === null && !loadingMessages) {
      setLoadingMessages(true);
      try {
        const resp = await hermesApi.getSessionMessages(session.id);
        setMessages(resp.messages);
      } catch {
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    }
  };

  const submitRename = async () => {
    const val = renameValue.trim();
    if (!val || val === session.title) { setRenaming(false); return; }
    await onRename(session.id, val);
    setRenaming(false);
  };

  return (
    <div style={{
      border: `1px solid ${session.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(255,230,203,0.1)'}`,
      borderRadius: 10,
      overflow: 'hidden',
      background: session.is_active ? 'rgba(52,211,153,0.03)' : 'rgba(255,230,203,0.02)',
      transition: 'border-color 0.2s',
    }}>
      {/* Header row */}
      <div
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
          cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,230,203,0.04)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{sourceIcon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {renaming ? (
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void submitRename();
                  if (e.key === 'Escape') setRenaming(false);
                }}
                style={inputStyle}
              />
              <button style={iconBtnStyle} onClick={submitRename}>✓</button>
              <button style={iconBtnStyle} onClick={() => setRenaming(false)}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                color: hasTitle ? '#ffe6cb' : '#ffe6cb60',
                fontStyle: hasTitle ? 'normal' : 'italic',
                fontSize: 14,
                fontWeight: hasTitle ? 500 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {hasTitle ? session.title : (session.preview?.slice(0, 60) ?? 'Sin título')}
              </span>
              {session.is_active && (
                <span style={{
                  background: 'rgba(52,211,153,0.15)',
                  border: '1px solid rgba(52,211,153,0.3)',
                  borderRadius: 20, color: '#34d399', fontSize: 10,
                  fontWeight: 700, padding: '2px 8px', letterSpacing: '0.06em',
                }}>
                  ● LIVE
                </span>
              )}
            </div>
          )}
          <div style={{ color: '#ffe6cb50', fontSize: 12, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{session.message_count} msgs</span>
            {session.tool_call_count > 0 && <span>· {session.tool_call_count} tools</span>}
            <span>· {timeAgo(session.last_active)}</span>
            {session.model && <span>· {session.model.split('/').pop()}</span>}
            {session.source && <span>· {session.source}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <button
            style={iconBtnStyle}
            onClick={e => { e.stopPropagation(); setRenameValue(session.title ?? ''); setRenaming(true); }}
            title="Renombrar"
          >✏️</button>
          <button
            style={{ ...iconBtnStyle, color: '#f87171' }}
            onClick={e => { e.stopPropagation(); onDelete(session.id); }}
            title="Eliminar"
          >🗑️</button>
          <span style={{ color: '#ffe6cb40', fontSize: 12, marginLeft: 4 }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded messages */}
      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(255,230,203,0.08)',
          padding: '16px',
          background: 'rgba(0,0,0,0.2)',
          maxHeight: 500,
          overflowY: 'auto',
        }}>
          {loadingMessages && (
            <div style={{ textAlign: 'center', color: '#ffe6cb60', padding: 20 }}>
              <span style={spinnerStyle} />
            </div>
          )}
          {messages && messages.length === 0 && (
            <p style={{ color: '#ffe6cb40', textAlign: 'center', fontSize: 13 }}>Sin mensajes</p>
          )}
          {messages && messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
        </div>
      )}
    </div>
  );
}

export default function SessionsView() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSessions = useCallback(async (p = 0) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await hermesApi.getSessions(PAGE_SIZE, p * PAGE_SIZE);
      setSessions(resp.sessions ?? []);
      setTotal(resp.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(page); }, [fetchSessions, page]);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar esta sesión?')) return;
    await hermesApi.deleteSession(id);
    fetchSessions(page);
  }, [page, fetchSessions]);

  const handleRename = useCallback(async (id: string, title: string) => {
    await hermesApi.renameSession(id, title);
    fetchSessions(page);
  }, [page, fetchSessions]);

  const displayedSessions = debouncedSearch
    ? sessions.filter(s =>
        s.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        s.preview?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        s.id.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : sessions;

  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden', flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>💬</span>
          <div>
            <div style={{ color: '#ffe6cb', fontSize: 18, fontWeight: 700 }}>Sessions</div>
            <div style={{ color: '#ffe6cb50', fontSize: 12 }}>{total} sesiones total</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <input
            type="search"
            placeholder="Buscar sesiones..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <button style={refreshBtnStyle} onClick={() => fetchSessions(page)}>↻</button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, padding: 16, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>
        {loading && sessions.length === 0 && (
          <div style={{ textAlign: 'center', color: '#ffe6cb40', padding: 40 }}>
            <span style={spinnerStyle} />
          </div>
        )}
        {!loading && displayedSessions.length === 0 && (
          <div style={{ textAlign: 'center', color: '#ffe6cb40', padding: 40, fontSize: 14 }}>
            No hay sesiones
          </div>
        )}
        {displayedSessions.map(s => (
          <SessionRow key={s.id} session={s} onDelete={handleDelete} onRename={handleRename} />
        ))}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(255,230,203,0.08)' }}>
          <span style={{ color: '#ffe6cb60', fontSize: 13 }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={page === 0}
              onClick={() => { setPage(p => p - 1); }}
              style={paginationBtn}
            >←</button>
            <span style={{ color: '#ffe6cb80', fontSize: 13, alignSelf: 'center' }}>
              {page + 1} / {pageCount}
            </span>
            <button
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => { setPage(p => p + 1); }}
              style={paginationBtn}
            >→</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Styles ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,230,203,0.06)',
  border: '1px solid rgba(255,230,203,0.15)',
  borderRadius: 8,
  color: '#ffe6cb',
  fontSize: 13,
  outline: 'none',
  padding: '7px 12px',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderRadius: 6,
  color: '#ffe6cb80',
  cursor: 'pointer',
  fontSize: 14,
  padding: '4px 6px',
  transition: 'color 0.2s',
};

const refreshBtnStyle: React.CSSProperties = {
  background: 'rgba(255,230,203,0.08)',
  border: '1px solid rgba(255,230,203,0.15)',
  borderRadius: 8,
  color: '#ffe6cb',
  cursor: 'pointer',
  fontSize: 16,
  padding: '6px 12px',
};

const spinnerStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 20,
  height: 20,
  border: '2px solid rgba(255,230,203,0.15)',
  borderTopColor: '#34d399',
  borderRadius: '50%',
  animation: 'hSpin 0.8s linear infinite',
};

const paginationBtn: React.CSSProperties = {
  background: 'rgba(255,230,203,0.08)',
  border: '1px solid rgba(255,230,203,0.15)',
  borderRadius: 6,
  color: '#ffe6cb',
  cursor: 'pointer',
  fontSize: 14,
  padding: '4px 12px',
};
