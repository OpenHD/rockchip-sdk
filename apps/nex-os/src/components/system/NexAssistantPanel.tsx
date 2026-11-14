import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkle24Regular, Send24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import { useWindowManager } from '../../context/WindowManager';
import { useFileSystem } from '../../context/FileSystemContext';
import { useSettings } from '../../context/SettingsContext';
import { resolveAppMeta } from '../../utils/resolveAppMeta';
import { APPS } from '../../constants/apps';
import { useIsPhone } from '../../hooks/useMobileAppShell';

interface NexAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/** OpenAI/Groq-shaped chat message used for the tool-calling loop with /api/groq/assistant. */
interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

interface TranscriptEntry {
  id: string;
  kind: 'user' | 'assistant' | 'activity' | 'error';
  text: string;
}

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || '';
const MAX_TOOL_HOPS = 5;

const SUGGESTIONS = [
  'Abrí la Calculadora',
  'Cambiá el tema a Cyberpunk',
  'Creá una nota con mis pendientes de hoy',
  'Minimizá todo',
];

function genId() {
  return Math.random().toString(36).slice(2);
}

async function callAssistant(messages: ApiMessage[]): Promise<ApiMessage> {
  // Reutiliza /api/groq/chat (el mismo endpoint de NEX AI en Nex Code) con
  // useTools:true — así no sumamos una función serverless más al deployment
  // de Vercel (Hobby limita a 12 por deployment).
  const res = await fetch(`${API_BASE}/api/groq/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, useTools: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status} del backend`);
  return data.message as ApiMessage;
}

const NexAssistantPanel: React.FC<NexAssistantPanelProps> = ({ isOpen, onClose }) => {
  const { windows, openWindow, closeWindow, minimizeAllWindows } = useWindowManager();
  const { createFile, updateFileContent } = useFileSystem();
  const { setNeonTheme, setVolume, setBrightness } = useSettings();
  const isPhone = useIsPhone();

  const windowsRef = useRef(windows);
  windowsRef.current = windows;

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const apiMessagesRef = useRef<ApiMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const appList = useMemo(
    () => APPS.map((a) => `${a.appId} (${a.label})`).join(', '),
    [],
  );

  useEffect(() => {
    apiMessagesRef.current = [
      {
        role: 'system',
        content:
          `Sos "Nex Assistant", el asistente de IA integrado en NEX OS. Podés controlar el sistema real del usuario ` +
          `usando las tools disponibles: abrir/cerrar apps, crear notas, cambiar el tema neon, ajustar volumen y brillo, ` +
          `y consultar qué ventanas están abiertas. Respondé siempre en español, breve y directo. Cuando el usuario pida ` +
          `una acción, ejecutá la tool correspondiente en vez de solo explicar cómo hacerla, y confirmá en una frase corta ` +
          `lo que hiciste. Usá exactamente estos appId para open_app/close_app: ${appList}. Si no estás seguro de qué hay ` +
          `abierto, llamá a get_desktop_state primero. No inventes funciones que no existen.`,
      },
    ];
  }, [appList]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/groq/health`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setBackendOnline(Boolean(data.groqConfigured)); })
      .catch(() => { if (!cancelled) setBackendOnline(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcript, busy]);

  const pushEntry = (kind: TranscriptEntry['kind'], text: string) => {
    if (!text) return;
    setTranscript((prev) => [...prev, { id: genId(), kind, text }]);
  };

  const executeTool = (name: string, rawArgs: string): { forModel: unknown; activity: string } => {
    let args: Record<string, unknown> = {};
    try { args = rawArgs ? JSON.parse(rawArgs) : {}; } catch { /* args inválidos: seguimos con {} */ }

    switch (name) {
      case 'open_app': {
        const appId = String(args.appId || '').trim();
        if (!appId) return { forModel: { ok: false, error: 'missing_appId' }, activity: '' };
        const meta = resolveAppMeta(appId);
        openWindow(appId, appId, meta.title, meta.icon);
        return { forModel: { ok: true, opened: appId, title: meta.title }, activity: `Abrí ${meta.title}` };
      }
      case 'close_app': {
        const appId = String(args.appId || '').trim();
        const win = windowsRef.current.find((w) => w.appId === appId && w.isOpen);
        if (!win) return { forModel: { ok: false, error: 'not_open' }, activity: `${appId} no estaba abierto` };
        closeWindow(win.id);
        return { forModel: { ok: true, closed: appId }, activity: `Cerré ${win.title}` };
      }
      case 'minimize_all_windows': {
        minimizeAllWindows();
        return { forModel: { ok: true }, activity: 'Minimicé todas las ventanas' };
      }
      case 'create_note': {
        const content = String(args.content || '');
        const title = (args.title && String(args.title).trim()) ||
          `Nota ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
        const fileName = `${title}.txt`;
        const fileId = createFile('documents', fileName, 'txt');
        updateFileContent(fileId, content);
        openWindow(fileId, 'notepad', fileName, resolveAppMeta('notepad').icon, { fileId });
        return { forModel: { ok: true, file: fileName }, activity: `Creé "${fileName}" en Documentos y la abrí` };
      }
      case 'set_neon_theme': {
        const theme = String(args.theme || '');
        if (!['none', 'cyberpunk', 'matrix', 'synthwave'].includes(theme)) {
          return { forModel: { ok: false, error: 'invalid_theme' }, activity: '' };
        }
        setNeonTheme(theme as 'none' | 'cyberpunk' | 'matrix' | 'synthwave');
        return { forModel: { ok: true, theme }, activity: `Cambié el tema neon a ${theme}` };
      }
      case 'set_volume': {
        const level = Math.max(0, Math.min(100, Number(args.level)));
        setVolume(level);
        return { forModel: { ok: true, level }, activity: `Volumen al ${level}%` };
      }
      case 'set_brightness': {
        const level = Math.max(0, Math.min(100, Number(args.level)));
        setBrightness(level);
        return { forModel: { ok: true, level }, activity: `Brillo al ${level}%` };
      }
      case 'get_desktop_state': {
        const open = windowsRef.current
          .filter((w) => w.isOpen)
          .map((w) => ({ appId: w.appId, title: w.title, minimized: w.isMinimized, maximized: w.isMaximized }));
        return { forModel: { open }, activity: '' };
      }
      default:
        return { forModel: { ok: false, error: 'unknown_tool' }, activity: '' };
    }
  };

  const runLoop = async () => {
    for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
      const message = await callAssistant(apiMessagesRef.current);
      apiMessagesRef.current = [...apiMessagesRef.current, message];

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const call of message.tool_calls) {
          const { forModel, activity } = executeTool(call.function.name, call.function.arguments);
          pushEntry('activity', activity);
          apiMessagesRef.current = [
            ...apiMessagesRef.current,
            { role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify(forModel) },
          ];
        }
        continue;
      }

      pushEntry('assistant', message.content || '…');
      return;
    }
    pushEntry('error', 'Me quedé dando vueltas con demasiadas acciones seguidas. Probá pedírmelo de nuevo, más simple.');
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');
    pushEntry('user', trimmed);
    apiMessagesRef.current = [...apiMessagesRef.current, { role: 'user', content: trimmed }];
    setBusy(true);
    try {
      await runLoop();
    } catch (err) {
      pushEntry('error', err instanceof Error ? err.message : 'Algo falló hablando con Nex AI.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {isPhone && <div className="nap-backdrop" onClick={onClose} />}
      <motion.div
        initial={isPhone ? { y: '100%', opacity: 1 } : { x: 400, opacity: 0 }}
        animate={{ x: 0, y: 0, opacity: 1 }}
        exit={isPhone ? { y: '100%', opacity: 1 } : { x: 400, opacity: 0 }}
        transition={isPhone ? { type: 'spring', damping: 32, stiffness: 380, mass: 0.85 } : { type: 'spring', damping: 25, stiffness: 200 }}
        className={`nex-assistant-panel mica-strong premium-shadow ${isPhone ? 'nap-mobile' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {isPhone && <div className="nap-handle" />}
        <div className="nap-header">
          <div className="nap-header-title">
            <Sparkle24Regular />
            <span>Nex Assistant</span>
            {backendOnline !== null && (
              <span className={`nap-status-dot ${backendOnline ? 'online' : 'offline'}`} title={backendOnline ? 'Groq conectado' : 'Falta GROQ_API_KEY'} />
            )}
          </div>
          <button className="nap-close-btn" onClick={onClose}><Dismiss24Regular /></button>
        </div>

        <div className="nap-scroll" ref={scrollRef}>
          {transcript.length === 0 && (
            <div className="nap-empty">
              <p>Puedo operar NEX OS por vos: abrir y cerrar apps, crear notas, cambiar el tema, ajustar volumen y brillo.</p>
              <div className="nap-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="nap-chip" onClick={() => send(s)} disabled={busy}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {transcript.map((entry) => {
            if (entry.kind === 'activity') {
              return <div key={entry.id} className="nap-activity">⚡ {entry.text}</div>;
            }
            if (entry.kind === 'error') {
              return <div key={entry.id} className="nap-activity nap-error">⚠️ {entry.text}</div>;
            }
            return (
              <div key={entry.id} className={`nap-bubble ${entry.kind === 'user' ? 'nap-bubble-user' : 'nap-bubble-assistant'}`}>
                {entry.text}
              </div>
            );
          })}

          {busy && (
            <div className="nap-bubble nap-bubble-assistant nap-typing">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>

        <div className="nap-input-row">
          <textarea
            className="nap-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={backendOnline === false ? 'Falta GROQ_API_KEY en el backend…' : 'Pedile algo a Nex Assistant…'}
            rows={1}
          />
          <button className="nap-send-btn" onClick={() => send(input)} disabled={busy || !input.trim()}>
            <Send24Regular />
          </button>
        </div>

      <style>{`
        .nap-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          z-index: 1499;
        }
        .nap-handle {
          width: 40px;
          height: 4px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.28);
          margin: 0 auto 10px;
          flex-shrink: 0;
        }
        .nex-assistant-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 400px;
          height: 100vh;
          background: rgba(20, 18, 28, 0.55);
          backdrop-filter: blur(60px) saturate(210%);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          padding: 24px 20px;
          z-index: 1500;
          color: white;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: -20px 0 60px rgba(0,0,0,0.4);
        }

        .nex-assistant-panel.nap-mobile {
          top: auto;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: min(86dvh, 720px);
          border-left: none;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px 24px 0 0;
          padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
          box-shadow: 0 -20px 60px rgba(0,0,0,0.5);
        }

        .nap-header { display: flex; align-items: center; justify-content: space-between; }
        .nap-header-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; }
        .nap-status-dot { width: 7px; height: 7px; border-radius: 50%; margin-left: 4px; }
        .nap-status-dot.online { background: #4ec9b0; box-shadow: 0 0 6px #4ec9b0; }
        .nap-status-dot.offline { background: #e5c07b; }
        .nap-close-btn { background: transparent; border: none; color: white; cursor: pointer; opacity: 0.8; padding: 4px; }
        .nap-close-btn:hover { opacity: 1; }

        .nap-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; }
        .nap-scroll::-webkit-scrollbar { width: 4px; }
        .nap-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

        .nap-empty { opacity: 0.85; font-size: 13px; line-height: 1.5; display: flex; flex-direction: column; gap: 14px; }
        .nap-suggestions { display: flex; flex-wrap: wrap; gap: 8px; }
        .nap-chip {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 12px;
          cursor: pointer;
        }
        .nap-chip:hover { background: rgba(255,255,255,0.12); }
        .nap-chip:disabled { opacity: 0.5; cursor: default; }

        .nap-bubble { max-width: 88%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
        .nap-bubble-user { align-self: flex-end; background: linear-gradient(135deg, #7c3aed, #db2777); border-bottom-right-radius: 4px; }
        .nap-bubble-assistant { align-self: flex-start; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.08); border-bottom-left-radius: 4px; }
        .nap-activity { align-self: flex-start; font-size: 11px; opacity: 0.65; padding: 2px 4px; }
        .nap-error { color: #f2b8b5; opacity: 0.9; }

        .nap-typing { display: flex; align-items: center; gap: 4px; padding: 12px 14px; }
        .nap-typing span { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.6); animation: nap-bounce 1.2s infinite ease-in-out; }
        .nap-typing span:nth-child(2) { animation-delay: 0.15s; }
        .nap-typing span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes nap-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }

        .nap-input-row { display: flex; gap: 8px; align-items: flex-end; }
        .nap-input {
          flex: 1;
          resize: none;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 12px;
          color: white;
          padding: 10px 12px;
          font-size: 13px;
          font-family: inherit;
          max-height: 100px;
        }
        .nap-input:focus { outline: none; border-color: rgba(255,255,255,0.35); }
        .nap-send-btn {
          background: linear-gradient(135deg, #7c3aed, #db2777);
          border: none;
          color: white;
          border-radius: 10px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .nap-send-btn:disabled { opacity: 0.4; cursor: default; }
      `}</style>
      </motion.div>
    </>
  );
};

export default NexAssistantPanel;
