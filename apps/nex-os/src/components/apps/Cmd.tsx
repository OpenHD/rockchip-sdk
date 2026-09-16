import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
  cmd: <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold', fontSize: 16 }}>C:\</span>,
  terminal: <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold', fontSize: 16 }}>C:\</span>,
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
  tetris: <span style={{ fontSize: 16 }}>🧱</span>,
  games: <span style={{ fontSize: 16 }}>🎮</span>,
};

type Line = { text: string; color?: string };

const Cmd: React.FC = () => {
  const { files, createFolder, createFile, deleteItem, nexFs } = useFileSystem();
  const { userName } = useSettings();
  const { npmRun, pnpmRun, gitRun } = useNexRuntime();
  const { openWindow } = useWindowManager();

  const [lines, setLines] = useState<Line[]>([
    { text: 'NEX OS Terminal [Version 2.0.1278]' },
    { text: '(c) NEXA Systems. NexFs + git local runtime.' },
    { text: '' },
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const [currentDirId, setCurrentDirId] = useState('c-drive');
  const [isRunning, setIsRunning] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  const currentPath = useMemo(
    () => nexFs.pathOfId(currentDirId) || 'C:\\',
    [nexFs, currentDirId, files],
  );

  const handleCommand = useCallback(
    async (cmd: string) => {
      if (isRunning) return;
      setLines((prev) => [...prev, { text: `${currentPath}>${cmd}` }]);
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
          flavor: 'cmd',
          npmRun,
          pnpmRun,
          gitRun,
          createFolder,
          createFile,
          deleteItem,
        });
        for await (const ev of gen) {
          if (ev.type === 'line') setLines((prev) => [...prev, { text: ev.text, color: ev.color }]);
          else if (ev.type === 'clear') {
            setLines([
              { text: 'NEX OS Terminal [Version 2.0.1278]' },
              { text: '(c) NEXA Systems. NexFs + git local runtime.' },
              { text: '' },
            ]);
          } else if (ev.type === 'cwd') setCurrentDirId(ev.dirId);
          else if (ev.type === 'open') {
            openWindow(
              ev.appId,
              ev.appId,
              ev.title,
              NEX_ICONS[ev.appId] ?? <Document24Regular />,
            );
          }
          await new Promise((r) => setTimeout(r, 0));
        }
        setLines((prev) => [...prev, { text: '' }]);
      } finally {
        setIsRunning(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [
      isRunning,
      currentPath,
      currentDirId,
      files,
      nexFs,
      userName,
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

  return (
    <div className="cmd-container" onClick={() => inputRef.current?.focus()}>
      <div className="cmd-output" ref={scrollRef}>
        {lines.map((line, idx) => (
          <div key={idx} className="cmd-line" style={line.color ? { color: line.color } : undefined}>
            {line.text}
          </div>
        ))}
        <div className="cmd-input-row">
          <span className="cmd-prompt">{currentPath}&gt;</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="cmd-input"
            spellCheck={false}
            autoComplete="off"
            disabled={isRunning}
            placeholder={isRunning ? 'Procesando...' : ''}
          />
          {isRunning && <span className="cmd-running-indicator">⏳</span>}
        </div>
      </div>

      <style>{`
        .cmd-container {
          height: 100%; background: #0c0c0c; color: #cccccc;
          font-family: 'Consolas', 'Courier New', monospace; padding: 8px;
          display: flex; flex-direction: column;
        }
        .cmd-output { flex: 1; overflow-y: auto; padding-right: 4px; }
        .cmd-line { white-space: pre-wrap; font-size: 13px; line-height: 1.4; margin-bottom: 1px; }
        .cmd-input-row { display: flex; align-items: center; width: 100%; gap: 4px; }
        .cmd-prompt { white-space: nowrap; margin-right: 8px; font-size: 13px; color: #e5e7eb; }
        .cmd-input {
          flex: 1; background: transparent; border: none; outline: none;
          color: #fff; font-size: 13px; font-family: inherit;
        }
        .cmd-input:disabled { opacity: 0.5; }
        .cmd-running-indicator { font-size: 12px; animation: blink 1s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

export default Cmd;
