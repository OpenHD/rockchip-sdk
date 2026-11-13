import React, { useState, useEffect, useRef } from 'react';
import {
  Play24Filled,
  Wrench24Filled,
  Bug24Filled,
  ArrowClockwise24Filled,
  Folder24Filled,
  Document24Regular,
  ChevronRight24Regular,
  MoreHorizontal24Regular,
  Search24Regular,
  Settings24Regular,
  WindowConsoleRegular,
  Circle24Filled,
  CursorClick24Regular,
  Options24Regular,
  TextBulletListSquare24Regular,
} from '@fluentui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { CppEngine } from '../../utils/cppEngine';

interface File {
  name: string;
  language: string;
  content: string;
}

const INITIAL_DEV_CPP_FILES: Record<string, File> = {
  'main.cpp': {
    name: 'main.cpp',
    language: 'cpp',
    content: `#include <iostream>
#include <string>

using namespace std;

int main() {
    string name;
    int age;

    cout << "========================================" << endl;
    cout << "   Welcome to Dev-C++ 2026 Interactive" << endl;
    cout << "========================================" << endl;

    cout << "Enter your name: ";
    cin >> name;
    
    cout << "Enter your age: ";
    cin >> age;

    cout << endl << "Hello, " << name << "!" << endl;
    cout << "Next year you will be " << age + 1 << " years old." << endl;
    
    cout << "----------------------------------------" << endl;
    cout << "Execution finished successfully." << endl;

    return 0;
}`
  },
  'matrix.h': {
    name: 'matrix.h',
    language: 'cpp',
    content: `#ifndef MATRIX_H
#define MATRIX_H

#include <vector>

class Matrix {
public:
    Matrix(int r, int c) : rows(r), cols(c), data(r, std::vector<double>(c, 0.0)) {}
    
    void set(int r, int c, double val) {
        data[r][c] = val;
    }

private:
    int rows, cols;
    std::vector<std::vector<double>> data;
};

#endif`
  },
  'Makefile': {
    name: 'Makefile',
    language: 'makefile',
    content: `all: main

main: main.cpp
	g++ -O3 main.cpp -o main

clean:
	rm -f main`
  }
};

const CPP_COLORS: Record<string, string> = {
  pp: '#c586c0', // preprocessor
  keyword: '#569cd6',
  string: '#ce9178',
  comment: '#6a9955',
  type: '#4ec9b0',
  function: '#dcdcaa',
  number: '#b5cea8'
};

function tokenizeCpp(code: string): React.ReactNode[] {
  const lines = code.split('\n');
  return lines.map((line, i) => {
    let highlighted = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    let tokenCounter = 0;
    const tokenMap: Record<string, string> = {};
    const stash = (html: string) => {
      const key = `___TK${tokenCounter++}___`;
      tokenMap[key] = html;
      return key;
    };

    // Comments
    highlighted = highlighted.replace(/(\/\/.*)/g, (m) => stash(`<span style="color:${CPP_COLORS.comment}">${m}</span>`));
    
    // Strings
    highlighted = highlighted.replace(/(['"`])((?:[^\\]|\\.)*?)\1/g, (m) => stash(`<span style="color:${CPP_COLORS.string}">${m}</span>`));
    
    // Preprocessor
    highlighted = highlighted.replace(/(#\s*\w+)/g, (m) => stash(`<span style="color:${CPP_COLORS.pp}">${m}</span>`));
    
    // Numbers
    highlighted = highlighted.replace(/\b(\d+)\b/g, (m) => stash(`<span style="color:${CPP_COLORS.number}">${m}</span>`));
    
    // Keywords
    highlighted = highlighted.replace(/\b(int|float|double|char|bool|void|unsigned|signed|long|short|class|struct|union|enum|public|private|protected|virtual|static|const|extern|volatile|mutable|template|typename|using|namespace|inline|if|else|for|while|do|switch|case|default|break|continue|return|goto|try|catch|throw|new|delete|sizeof|typeid|dynamic_cast|static_cast|reinterpret_cast|const_cast|true|false|this|auto|decltype|noexcept|nullptr|constexpr|std|cout|cin|endl|vector|string)\b/g, (m) => {
        let color = CPP_COLORS.keyword;
        if (['int', 'float', 'double', 'char', 'bool', 'void', 'vector', 'string'].includes(m)) color = CPP_COLORS.type;
        return stash(`<span style="color:${color}">${m}</span>`);
    });

    // Re-insert tokens
    for (let j = tokenCounter - 1; j >= 0; j--) {
      highlighted = highlighted.replace(`___TK${j}___`, tokenMap[`___TK${j}___`]);
    }

    return (
      <div key={i} className="devcpp-line">
        <span className="devcpp-ln">{i + 1}</span>
        <span dangerouslySetInnerHTML={{ __html: highlighted || '&nbsp;' }} />
      </div>
    );
  });
}

const DevCpp2026: React.FC = () => {
  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem('devcpp_files');
    return saved ? JSON.parse(saved) : INITIAL_DEV_CPP_FILES;
  });
  const [activeFile, setActiveFile] = useState('main.cpp');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    'Dev-C++ 2026 Compiler Service v1.0.4 - Ready',
    'Root workspace: C:\\Users\\User\\Project',
  ]);
  const [inputBuffer, setInputBuffer] = useState('');
  const [status, setStatus] = useState('Listo');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'modern' | 'classic'>('modern');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  
  const termRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resolveInputRef = useRef<((val: string) => void) | null>(null);
  
  const file = files[activeFile];

  useEffect(() => {
    localStorage.setItem('devcpp_files', JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [terminalLines, isWaitingForInput]);

  const updateCursorPos = () => {
    if (editorRef.current) {
      const text = editorRef.current.value.substring(0, editorRef.current.selectionStart);
      const lines = text.split('\n');
      setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newVal = file.content.substring(0, start) + "    " + file.content.substring(end);
      
      setFiles((prev: any) => ({
        ...prev,
        [activeFile]: { ...prev[activeFile], content: newVal }
      }));
      
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = editorRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
    
    if (e.key === 'Enter') {
      const start = e.currentTarget.selectionStart;
      const beforeStr = file.content.substring(0, start);
      const lines = beforeStr.split('\n');
      const lastLine = lines[lines.length - 1];
      const match = lastLine.match(/^\s*/);
      const indent = match ? match[0] : "";
      
      // Auto-indent
      if (indent.length > 0) {
        e.preventDefault();
        const newVal = file.content.substring(0, start) + "\n" + indent + file.content.substring(start);
        setFiles((prev: any) => ({
          ...prev,
          [activeFile]: { ...prev[activeFile], content: newVal }
        }));
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.selectionStart = editorRef.current.selectionEnd = start + indent.length + 1;
          }
        }, 0);
      }
    }
    
    // Auto-close brackets
    const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']', '"': '"', "'": "'" };
    if (pairs[e.key]) {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newVal = file.content.substring(0, start) + e.key + pairs[e.key] + file.content.substring(end);
      setFiles((prev: any) => ({
        ...prev,
        [activeFile]: { ...prev[activeFile], content: newVal }
      }));
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = editorRef.current.selectionEnd = start + 1;
        }
      }, 0);
    }

    setTimeout(updateCursorPos, 0);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setFiles((prev: any) => ({
      ...prev,
      [activeFile]: {
        ...prev[activeFile],
        content: newContent
      }
    }));
    updateCursorPos();
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    setStatus('Compilando...');
    setTerminalLines((prev: string[]) => [...prev, `[${new Date().toLocaleTimeString()}] g++ -O3 ${activeFile} -o main.exe`]);
    
    // Check if backend API is available
    try {
      const response = await fetch('/api/compile-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, mainFile: activeFile })
      });

      if (response.ok) {
        const result = await response.json();
        setIsCompiling(false);
        if (result.success) {
          setStatus('Compilación finalizada con éxito');
          setTerminalLines((prev: string[]) => [...prev, 'Compilation finished successfully.', 'Output written to main.exe']);
          return true;
        } else {
          setStatus('Error en la compilación');
          setTerminalLines((prev: string[]) => [...prev, ...result.errors.split('\n')]);
          return false;
        }
      }
    } catch (e) {
      console.log("Backend offline or error, falling back to simulator");
    }

    // Fallback to Simulation Engine
    return new Promise((resolve) => {
        setTimeout(async () => {
          setIsCompiling(false);
          const engine = new CppEngine(files, { cout: () => {}, cin: async () => "" });
          const result = await engine.execute(activeFile);
          
          if (result.errors.length > 0) {
            setStatus('Error en la compilación');
            setTerminalLines((prev: string[]) => [...prev, ...result.errors]);
            resolve(false);
          } else {
            setStatus('Compilación finalizada con éxito');
            setTerminalLines((prev: string[]) => [...prev, 'Compilation finished successfully (Simulated).', 'Output written to main.exe']);
            resolve(true);
          }
        }, 1200);
    });
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setStatus('Ejecutando...');
    setTerminalLines((prev: string[]) => [...prev, '❯ Running main.exe...', '========================================']);
    
    const ioBridge = {
      cout: async (val: string) => {
        // Character streaming effect for realism
        if (val.length > 50) {
           setTerminalLines((prev: string[]) => [...prev, val]);
        } else {
          for (let i = 0; i < val.length; i++) {
            setTerminalLines((prev: string[]) => {
              const last = prev[prev.length - 1];
              if (last.startsWith('❯') || last === '========================================' || last === '') {
                return [...prev, val[i]];
              }
              const newPrev = [...prev];
              newPrev[newPrev.length - 1] += val[i];
              return newPrev;
            });
            await new Promise(r => setTimeout(r, 5));
          }
        }
      },
      cin: async () => {
        setIsWaitingForInput(true);
        setStatus('Esperando entrada...');
        return new Promise<string>((resolve) => {
          resolveInputRef.current = (val) => {
            setIsWaitingForInput(false);
            setStatus('Ejecutando...');
            resolve(val);
          };
        });
      }
    };

    const engine = new CppEngine(files, ioBridge);
    const result = await engine.execute(activeFile);

    setTerminalLines((prev: string[]) => [...prev, '', '========================================', 'Process exited with return value ' + result.exitCode]);
    setStatus('Listo');
    setIsRunning(false);
  };

  const handleTerminalInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (resolveInputRef.current && inputBuffer) {
      const val = inputBuffer;
      setTerminalLines((prev: string[]) => [...prev, `> ${val}`]);
      setInputBuffer('');
      resolveInputRef.current(val);
      resolveInputRef.current = null;
    }
  };

  return (
    <div className="devcpp-container">
      {/* Header bar */}
      <div className="devcpp-header">
        <div className="devcpp-title-group">
          <div className="devcpp-app-icon">
            <Play24Filled primaryFill="#3b82f6" style={{ transform: 'rotate(-45deg)', fontSize: 14 }} />
          </div>
          <span className="devcpp-title">Dev-C++ 2026 Professional</span>
        </div>
        
        <div className="devcpp-toolbar">
          <button className="dev-tool-btn" title="Compilar (F9)" onClick={handleCompile} disabled={isCompiling || isRunning}>
            <Wrench24Filled primaryFill={isCompiling ? "#4a5568" : (theme === 'classic' ? "#fff" : "#fbbf24")} />
          </button>
          <button className="dev-tool-btn" title="Ejecutar (F10)" onClick={handleRun} disabled={isCompiling || isRunning}>
            <Play24Filled primaryFill={isRunning ? "#4a5568" : (theme === 'classic' ? "#fff" : "#10b981")} />
          </button>
          <button className="dev-tool-btn" title="Compilar y Ejecutar (F11)" onClick={() => { handleCompile().then(ok => ok && handleRun()); }} disabled={isCompiling || isRunning}>
             <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wrench24Filled primaryFill={theme === 'classic' ? "#fff" : "#3b82f6"} style={{ fontSize: 20 }} />
                <Play24Filled primaryFill="#10b981" style={{ 
                  position: 'absolute', 
                  bottom: -5, 
                  right: -5, 
                  fontSize: 14,
                  filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'
                }} />
             </div>
          </button>
          <div className="devcpp-divider" />
          <button className="dev-tool-btn" title="Reconstruir todo">
            <ArrowClockwise24Filled primaryFill={theme === 'classic' ? "#fff" : "#6366f1"} />
          </button>
          <button className="dev-tool-btn" title="Depurar">
            <Bug24Filled primaryFill={theme === 'classic' ? "#fff" : "#f43f5e"} />
          </button>
        </div>

        <div className="devcpp-header-right">
            <button className="dev-tool-btn" title="Cambiar Tema" onClick={() => setTheme(t => t === 'modern' ? 'classic' : 'modern')}>
               <Options24Regular primaryFill={theme === 'classic' ? '#fff' : '#94a3b8'} />
            </button>
            <div className="devcpp-divider" />
            <Search24Regular />
            <Settings24Regular />
        </div>
      </div>

      <div className="devcpp-content">
        {/* Project Sidebar */}
        {sidebarOpen && (
          <div className="devcpp-sidebar">
            <div className="sidebar-header">
              <span>EXPLORADOR DE PROYECTO</span>
              <MoreHorizontal24Regular style={{ cursor: 'pointer' }} />
            </div>
            
            <div className="sidebar-section">
              <div className="folder-item">
                <ChevronRight24Regular style={{ transform: 'rotate(90deg)', fontSize: 14 }} />
                <Folder24Filled primaryFill="#fbbf24" style={{ fontSize: 16 }} />
                <span>MyProject</span>
              </div>
              
              <div className="file-list">
                {Object.keys(files).map(name => (
                  <div 
                    key={name} 
                    className={`file-item ${activeFile === name ? 'active' : ''}`}
                    onClick={() => setActiveFile(name)}
                  >
                    <Document24Regular primaryFill={name.endsWith('.cpp') || name.endsWith('.h') ? '#3b82f6' : '#94a3b8'} style={{ fontSize: 16 }} />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-ad">
                <div className="ad-content">
                    <Bug24Filled primaryFill="#3b82f6" style={{ fontSize: 24, marginBottom: 8 }} />
                    <p>AI Debugger enabled</p>
                    <button>Review issues</button>
                </div>
            </div>
          </div>
        )}

        {/* Main Editor Area */}
        <div className="devcpp-main">
          <div className="editor-tabs">
             <AnimatePresence mode="popLayout">
               {Object.keys(files).map(name => (
                 <motion.div 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={name} 
                    className={`editor-tab ${activeFile === name ? 'active' : ''}`} 
                    onClick={() => setActiveFile(name)}
                 >
                   <span>{name}</span>
                   {activeFile === name && (
                     <motion.div layoutId="active-tab" className="tab-indicator" />
                   )}
                 </motion.div>
               ))}
             </AnimatePresence>
          </div>

          <div className="editor-body-container">
            {/* Active Line Highlight */}
            <div 
              className="line-highlight" 
              style={{ 
                top: `${(cursorPos.line - 1) * 1.6 + 1.3}em`,
                opacity: theme === 'modern' ? 0.3 : 0.1
              }} 
            />
            
            <textarea
              ref={editorRef}
              className="editor-textarea"
              value={file.content}
              onChange={handleCodeChange}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              onClick={updateCursorPos}
              onKeyUp={updateCursorPos}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
            />
            <div className="editor-highlight" ref={highlightRef}>
              {tokenizeCpp(file.content)}
            </div>
          </div>

          {/* Bottom Panel (Terminal) */}
          <div className="devcpp-bottom">
            <div className="bottom-tabs">
                <div className="bottom-tab active">
                    <WindowConsoleRegular style={{ fontSize: 14 }} />
                    <span>Compilación / Salida</span>
                </div>
                <div className="bottom-tab">
                    <Bug24Filled style={{ fontSize: 14 }} />
                    <span>Depuración</span>
                </div>
            </div>
            <div className={`bottom-content ${isWaitingForInput ? 'waiting' : ''}`} ref={termRef}>
               {terminalLines.map((line, idx) => (
                 <div key={idx} className="terminal-line">{line}</div>
               ))}
               
               {isWaitingForInput && (
                 <form onSubmit={handleTerminalInput} className="terminal-input-row">
                    <span className="terminal-cursor">█</span>
                    <input 
                      ref={inputRef}
                      autoFocus
                      className="term-input-field"
                      value={inputBuffer}
                      onChange={e => setInputBuffer(e.target.value)}
                    />
                 </form>
               )}

               {isCompiling && (
                 <div className="compiling-loader">
                    <div className="spinner" />
                    <span>Linker is working...</span>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className={`devcpp-status theme-${theme}`}>
        <div className="status-left">
          <div className="status-indicator">
             <Circle24Filled primaryFill={status === 'Listo' ? '#10b981' : '#fbbf24'} style={{ fontSize: 8 }} />
             <span>{status}</span>
          </div>
          <div className="status-sep" />
          <div className="cursor-pos">
             <CursorClick24Regular style={{ fontSize: 12 }} />
             <span>Línea: {cursorPos.line}, Col: {cursorPos.col}</span>
          </div>
        </div>
        <div className="status-right">
          <div className="info-item">
             <TextBulletListSquare24Regular style={{ fontSize: 12 }} />
             <span>UTF-8</span>
          </div>
          <div className="status-sep" />
          <span>C++ 20 (GCC)</span>
          <div className="status-sep" />
          <span>Windows 11 x64</span>
        </div>
      </div>

      <style>{`
        .devcpp-container {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: ${theme === 'modern' ? 'rgba(15, 23, 42, 0.85)' : '#f0f0f0'};
          backdrop-filter: ${theme === 'modern' ? 'blur(25px)' : 'none'};
          color: ${theme === 'modern' ? '#e2e8f0' : '#000'};
          font-family: ${theme === 'modern' ? "'Segoe UI', sans-serif" : "'Tahoma', sans-serif"};
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid ${theme === 'modern' ? 'rgba(255, 255, 255, 0.1)' : '#999'};
        }

        .devcpp-header {
          height: 48px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          background: ${theme === 'modern' ? 'rgba(30, 41, 59, 0.7)' : 'linear-gradient(to bottom, #f9f9f9, #e1e1e1)'};
          border-bottom: 1px solid ${theme === 'modern' ? 'rgba(255, 255, 255, 0.05)' : '#999'};
          justify-content: space-between;
          color: ${theme === 'modern' ? 'inherit' : '#000'};
        }

        .devcpp-sidebar {
          width: 240px;
          background: ${theme === 'modern' ? 'rgba(15, 23, 42, 0.4)' : '#fff'};
          border-right: 1px solid ${theme === 'modern' ? 'rgba(255, 255, 255, 0.05)' : '#999'};
          display: flex;
          flex-direction: column;
        }

        .editor-textarea {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          padding: 20px;
          background: transparent;
          color: transparent;
          caret-color: ${theme === 'modern' ? '#3b82f6' : '#000'};
          border: none;
          outline: none;
          resize: none;
          font-family: 'Cascadia Code', 'Consolas', monospace;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre;
          overflow: auto;
          z-index: 2;
          padding-left: 56px;
        }

        .line-highlight {
          position: absolute;
          left: 0;
          right: 0;
          height: 1.6em;
          background: ${theme === 'modern' ? 'rgba(59, 130, 246, 0.15)' : '#fff8dc'};
          border-top: 1px solid ${theme === 'modern' ? 'rgba(59, 130, 246, 0.2)' : '#e0d8b0'};
          border-bottom: 1px solid ${theme === 'modern' ? 'rgba(59, 130, 246, 0.2)' : '#e0d8b0'};
          pointer-events: none;
          z-index: 0;
        }

        .editor-highlight {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          padding: 20px;
          pointer-events: none;
          font-family: 'Cascadia Code', 'Consolas', monospace;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre;
          overflow: hidden;
          z-index: 1;
          color: ${theme === 'classic' ? '#000' : 'inherit'};
        }

        .bottom-content {
          flex: 1;
          padding: 12px 16px;
          font-family: 'Consolas', monospace;
          font-size: 12px;
          overflow-y: auto;
          color: ${theme === 'modern' ? '#cbd5e1' : '#fff'};
          background: ${theme === 'modern' ? '#020617' : '#000080'};
        }

        .bottom-content.waiting {
          box-shadow: inset 0 0 15px rgba(59, 130, 246, 0.4);
        }

        .terminal-input-row {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
        }

        .term-input-field {
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-family: inherit;
          font-size: inherit;
          flex: 1;
        }

        .terminal-cursor {
          animation: blink 1s step-end infinite;
          color: #3b82f6;
        }

        @keyframes blink {
          50% { opacity: 0; }
        }

        .devcpp-status {
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          background: ${theme === 'modern' ? '#3b82f6' : '#d4d0c8'};
          color: ${theme === 'modern' ? 'white' : '#000'};
          font-size: 11px;
          border-top: ${theme === 'classic' ? '1px solid #fff' : 'none'};
        }

        .theme-classic .status-sep { background: #808080; }
        
        .cursor-pos, .info-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>
    </div>
  );
};

export default DevCpp2026;
