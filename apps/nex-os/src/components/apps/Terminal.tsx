import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFileSystem } from '../../context/FileSystemContext';
import { useSettings } from '../../context/SettingsContext';
import { useNexRuntime } from '../../context/NexRuntimeContext';
import { useWindowManager } from '../../context/WindowManager';
import { runShellCommand } from '../../runtime/shell/runCommand';
import {
  Folder24Regular, Document24Regular, Apps24Regular, Calculator24Regular,
  Code24Regular, Globe24Regular, ShieldCheckmark24Regular, Settings24Regular,
} from '@fluentui/react-icons';

const NEX_ICONS: Record<string, React.ReactNode> = {
  notepad: <Document24Regular />,
  cmd: <span style={{ fontFamily: 'Consolas,monospace', fontWeight: 'bold', fontSize: 16 }}>C:\</span>,
  terminal: <span style={{ fontFamily: 'Consolas,monospace', fontWeight: 'bold', fontSize: 16 }}>C:\</span>,
  chrome: <Globe24Regular />,
  'file-explorer': <Folder24Regular />,
  paint: <span style={{ fontSize: 18 }}>🎨</span>,
  calculator: <Calculator24Regular />,
  taskmanager: <Apps24Regular />,
  spotify: <span style={{ fontSize: 18 }}>🎵</span>,
  settings: <Settings24Regular />,
  wordpad: <Document24Regular />,
  defender: <ShieldCheckmark24Regular />,
  mediaplayer: <span style={{ fontSize: 18 }}>▶️</span>,
  'devcpp-2026': <Code24Regular primaryFill="#3b82f6" />,
  'hello-nex': <span style={{ fontSize: 16 }}>🚀</span>,
  'sdk-docs': <span style={{ fontSize: 16 }}>⬡</span>,
  tetris: <span style={{ fontSize: 16 }}>🧱</span>,
  games: <span style={{ fontSize: 16 }}>🎮</span>,
};

type Line = { text: string; color?: string };

const Terminal: React.FC = () => {
  const { files, createFolder, createFile, deleteItem, nexFs } = useFileSystem();
  const { userName } = useSettings();
  const { npmRun, pnpmRun, gitRun, resolveNex } = useNexRuntime();
  const { openWindow } = useWindowManager();

  const [history, setHistory] = useState<Line[]>([
    { text: 'NEX OS Terminal [Versión 2.0.1278]' },
    { text: '(c) NEXA Systems · Runtime con NexFs + git local' },
    { text: '' },
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const [currentDirId, setCurrentDirId] = useState('c-drive');
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  const currentPath = useMemo(() => {
    return nexFs.pathOfId(currentDirId) || 'C:\\';
  }, [nexFs, currentDirId, files]);

  const handleCommand = useCallback(
    async (cmd: string) => {
      if (isRunning) return;
      setHistory((prev) => [
        ...prev,
        {
          text: `${userName.toLowerCase()}@nexos:${currentPath.toLowerCase()}$ ${cmd}`,
          color: '#86efac',
        },
      ]);
      setCmdHistory((prev) => [cmd, ...prev]);
      setHistoryPointer(-1);
      setIsRunning(true);

      try {
        const gen = runShellCommand(cmd, {
          files,
          nexFs,
          cwd: currentPath,
          cwdId: currentDirId,
          userName,
          flavor: 'bash',
          npmRun,
          pnpmRun,
          gitRun,
          createFolder,
          createFile,
          deleteItem,
        });

        for await (const ev of gen) {
          if (ev.type === 'line') {
            setHistory((prev) => [...prev, { text: ev.text, color: ev.color }]);
          } else if (ev.type === 'clear') {
            setHistory([
              { text: 'NEX OS Terminal [Versión 2.0.1278]' },
              { text: '(c) NEXA Systems · Runtime con NexFs + git local' },
              { text: '' },
            ]);
          } else if (ev.type === 'cwd') {
            setCurrentDirId(ev.dirId);
          } else if (ev.type === 'open') {
            const icon = NEX_ICONS[ev.appId] ?? <Document24Regular />;
            openWindow(ev.appId, ev.appId, ev.title, icon);
          }
          await new Promise((r) => setTimeout(r, 0));
        }
        setHistory((prev) => [...prev, { text: '' }]);
      } finally {
        setIsRunning(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [
      isRunning,
      userName,
      currentPath,
      currentDirId,
      files,
      nexFs,
      npmRun,
      pnpmRun,
      gitRun,
      createFolder,
      createFile,
      deleteItem,
      openWindow,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void handleCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyPointer < cmdHistory.length - 1) {
        const p = historyPointer + 1;
        setHistoryPointer(p);
        setInput(cmdHistory[p]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPointer > 0) {
        const p = historyPointer - 1;
        setHistoryPointer(p);
        setInput(cmdHistory[p]);
      } else {
        setHistoryPointer(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const partial = input.split(' ').pop() ?? '';
      if (!partial) return;
      const match = files.find(
        (f) =>
          f.parentId === currentDirId &&
          (f.name.toLowerCase().startsWith(partial.toLowerCase()) ||
            `${f.name}.${f.ext}`.toLowerCase().startsWith(partial.toLowerCase())),
      );
      if (match) {
        const completed = match.ext ? `${match.name}.${match.ext}` : match.name;
        const parts = input.split(' ');
        parts[parts.length - 1] = completed;
        setInput(parts.join(' '));
      }
    }
  };

  void resolveNex; // kept available for future PATH hints
  const prompt = `${userName.toLowerCase()}@nexos:${currentPath.toLowerCase()}$`;

  return (
    <div className="terminal-root" onClick={() => inputRef.current?.focus()}>
      <div className="terminal-scroll" ref={scrollRef}>
        {history.map((line, i) => (
          <div key={i} className="terminal-line" style={line.color ? { color: line.color } : undefined}>
            {line.text}
          </div>
        ))}
        <div className="terminal-input-line">
          <span className="terminal-prompt">{prompt}&nbsp;</span>
          <input
            ref={inputRef}
            id="term-input"
            type="text"
            className="terminal-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            disabled={isRunning}
            placeholder={isRunning ? 'Procesando...' : ''}
          />
          {isRunning && (
            <span style={{ color: '#fbbf24', fontSize: 12, animation: 'term-blink 1s step-end infinite' }}>
              ⏳
            </span>
          )}
        </div>
      </div>

      <style>{`
        .terminal-root {
          background: #0d1117;
          color: #c9d1d9;
          font-family: 'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
          height: 100%;
          padding: 12px;
          font-size: 13px;
          overflow: hidden;
          cursor: text;
        }
        .terminal-scroll {
          height: 100%;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .terminal-line { white-space: pre-wrap; line-height: 1.5; }
        .terminal-input-line { display: flex; align-items: center; margin-top: 2px; }
        .terminal-prompt { color: #86efac; white-space: nowrap; flex-shrink: 0; }
        .terminal-field {
          flex: 1; background: transparent; border: none; color: #f0f6fc;
          outline: none; font-family: inherit; font-size: inherit; caret-color: #58a6ff;
        }
        .terminal-field:disabled { opacity: 0.5; }
        .terminal-field::placeholder { color: #484f58; font-style: italic; }
        .terminal-scroll::-webkit-scrollbar { width: 8px; }
        .terminal-scroll::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
        @keyframes term-blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

export default Terminal;
