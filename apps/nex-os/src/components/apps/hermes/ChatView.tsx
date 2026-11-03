import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { hermesApi, HERMES_BASE } from './api';

// ─── Minimal xterm‑less terminal emulator ─────────────────────────────────────
// We render a scrollable <pre> that receives raw text from the PTY WebSocket.
// ANSI escape sequences are stripped for readability; a full xterm.js integration
// would require adding that package to the project — this gives a solid,
// dependency‑free experience that works out of the box.

const ANSI_RE = /\x1b(?:\[[0-9;]*[A-Za-z]|\][^\x07]*\x07|[PX^_].*?\\|.)/g;
const CLEAR_RE = /\x1b\[2J(\x1b\[H)?/g;
const MOVE_RE  = /\x1b\[[0-9]*;?[0-9]*[HfABCDEFGJKST]/g;

function stripAnsi(s: string): string {
  return s.replace(CLEAR_RE, '\n[clear]\n')
          .replace(MOVE_RE, '')
          .replace(ANSI_RE, '');
}

// ─── Chat component ───────────────────────────────────────────────────────────

export default function ChatView() {
  const [output, setOutput] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const channelId = useRef(`nexos-${crypto.randomUUID()}`);

  // Auto-scroll to bottom
  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    });
  }, []);

  // Connect to PTY WebSocket
  const connect = useCallback(() => {
    setConnecting(true);
    setError(null);
    setOutput([]);

    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* ignore */ }
    }

    const wsUrl = hermesApi.buildPtyWsUrl(channelId.current);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setOutput(prev => [...prev, '\x1b[32m✓ Conectado a Hermes\x1b[0m\n']);
        scrollBottom();
      };

      ws.onmessage = (ev) => {
        const text = typeof ev.data === 'string' ? ev.data : '';
        const clean = stripAnsi(text);
        if (!clean) return;
        setOutput(prev => {
          const next = [...prev, clean];
          return next.length > 2000 ? next.slice(-2000) : next;
        });
        scrollBottom();
      };

      ws.onerror = () => {
        setConnected(false);
        setConnecting(false);
        setError('Error de WebSocket. Verifica que Hermes esté corriendo.');
      };

      ws.onclose = (ev) => {
        setConnected(false);
        setConnecting(false);
        if (!ev.wasClean) {
          setError(`Conexión cerrada (code ${ev.code}). ${ev.reason || ''}`);
        } else {
          setOutput(prev => [...prev, '\n[sesión terminada]\n']);
        }
        wsRef.current = null;
      };
    } catch (e) {
      setConnecting(false);
      setError(`No se pudo conectar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [scrollBottom]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
      }
    };
  }, [connect]);

  // Send text to PTY
  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(text);
    }
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim() && input !== '\n') return;
    sendText(input + '\r');
    setInput('');
  }, [input, sendText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      sendText('\x03'); // Ctrl+C → SIGINT
    }
  }, [handleSend, sendText]);

  // Start fresh session
  const startFresh = useCallback(() => {
    channelId.current = `nexos-${crypto.randomUUID()}`;
    setSessionTitle(null);
    connect();
  }, [connect]);

  const fullOutput = output.join('');

  return (
    <div style={styles.root}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.topLeft}>
          <span style={styles.topIcon}>⌨️</span>
          <div>
            <div style={styles.topTitle}>{sessionTitle ?? 'Hermes Chat'}</div>
            <div style={styles.topSub}>Terminal interactivo · PTY</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Status dot */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px',
            background: 'rgba(255,230,203,0.05)',
            border: '1px solid rgba(255,230,203,0.12)',
            borderRadius: 20,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: connected ? '#34d399' : connecting ? '#fbbf24' : '#f87171',
              boxShadow: connected ? '0 0 6px #34d399' : 'none',
              animation: connecting ? 'hPulse 1s infinite' : 'none',
            }} />
            <span style={{ color: '#ffe6cb80', fontSize: 11 }}>
              {connected ? 'Conectado' : connecting ? 'Conectando...' : 'Desconectado'}
            </span>
          </div>
          <button style={btnSecondary} onClick={startFresh} title="Nueva sesión">
            ✦ Nueva sesión
          </button>
          {!connected && !connecting && (
            <button style={btnPrimary} onClick={connect}>
              ↻ Reconectar
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          <span>⚠️</span>
          <div>
            <div style={{ fontWeight: 600 }}>{error}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
              URL del backend: <code style={{ fontFamily: 'monospace' }}>{HERMES_BASE}</code>
            </div>
          </div>
        </div>
      )}

      {/* Terminal output */}
      <div
        ref={outputRef}
        style={styles.terminal}
      >
        {/* Header bar */}
        <div style={styles.termHeader}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={termDot('#f87171')} />
            <div style={termDot('#fbbf24')} />
            <div style={termDot('#34d399')} />
          </div>
          <span style={{ color: '#ffe6cb40', fontSize: 11, fontFamily: 'monospace' }}>
            hermes — channel:{channelId.current.slice(-8)}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ background: 'none', border: 'none', color: '#ffe6cb50', cursor: 'pointer', fontSize: 11 }}
              onClick={() => setOutput([])}
              title="Limpiar terminal"
            >⌫ Limpiar</button>
          </div>
        </div>

        {/* Output */}
        <div style={styles.termOutput}>
          {connecting && output.length === 0 && (
            <div style={{ color: '#34d39980', fontFamily: 'monospace' }}>
              <span style={{ animation: 'hBlink 1s infinite' }}>█</span>
              {' '}Conectando a Hermes PTY...
            </div>
          )}
          <pre style={styles.pre}>{fullOutput}</pre>
        </div>
      </div>

      {/* Input area */}
      <div style={styles.inputArea}>
        <div style={styles.inputRow}>
          <span style={styles.prompt}>❯</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={connected ? 'Escribe un mensaje o comando... (Enter para enviar, Shift+Enter para nueva línea)' : 'Esperando conexión...'}
            disabled={!connected}
            rows={1}
            style={styles.inputTextarea}
          />
          <button
            onClick={handleSend}
            disabled={!connected || !input.trim()}
            style={{
              ...btnPrimary,
              opacity: !connected || !input.trim() ? 0.4 : 1,
              cursor: !connected || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >↑ Enviar</button>
        </div>
        <div style={styles.inputHint}>
          Enter = enviar · Shift+Enter = nueva línea · Ctrl+C = interrumpir
        </div>
      </div>

      <style>{`
        @keyframes hSpin { to { transform: rotate(360deg); } }
        @keyframes hPulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        @keyframes hBlink { 0%,100%{opacity:1;} 50%{opacity:0;} }
      `}</style>
    </div>
  );
}

const termDot = (color: string): React.CSSProperties => ({
  width: 10, height: 10, borderRadius: '50%',
  background: color, opacity: 0.7,
});

const btnPrimary: React.CSSProperties = {
  background: 'rgba(52,211,153,0.2)',
  border: '1px solid rgba(52,211,153,0.4)',
  borderRadius: 8,
  color: '#34d399',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 14px',
  transition: 'all 0.2s',
  whiteSpace: 'nowrap',
};

const btnSecondary: React.CSSProperties = {
  background: 'rgba(255,230,203,0.08)',
  border: '1px solid rgba(255,230,203,0.15)',
  borderRadius: 8,
  color: '#ffe6cb',
  cursor: 'pointer',
  fontSize: 12,
  padding: '6px 14px',
  transition: 'background 0.2s',
  whiteSpace: 'nowrap',
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    gap: 12,
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  topLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  topIcon: { fontSize: 24 },
  topTitle: { color: '#ffe6cb', fontSize: 18, fontWeight: 700 },
  topSub: { color: '#ffe6cb50', fontSize: 12 },
  errorBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 16px',
    background: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: 10,
    color: '#f87171',
    fontSize: 13,
  },
  terminal: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#000',
    border: '1px solid rgba(255,230,203,0.12)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  termHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  termOutput: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
  },
  pre: {
    margin: 0,
    color: '#f0e6d2',
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
    fontSize: 12.5,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  inputArea: {
    background: 'rgba(255,230,203,0.03)',
    border: '1px solid rgba(255,230,203,0.1)',
    borderRadius: 10,
    padding: '10px 14px',
    flexShrink: 0,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 10,
  },
  prompt: {
    color: '#34d399',
    fontSize: 18,
    fontFamily: 'monospace',
    paddingBottom: 4,
    flexShrink: 0,
  },
  inputTextarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#ffe6cb',
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
    fontSize: 13,
    lineHeight: 1.5,
    outline: 'none',
    resize: 'none',
    padding: '4px 0',
  },
  inputHint: {
    color: '#ffe6cb30',
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'monospace',
  },
};
