import React, { useState, useEffect, useRef } from 'react';
import { useFileSystem } from '../../context/FileSystemContext';

interface NotepadProps {
  fileId?: string;
}

type FontFamily = 'Consolas' | 'Segoe UI' | 'Courier New' | 'Arial' | 'Georgia';
type FontSize = 12 | 14 | 16 | 18 | 20 | 24;

const Notepad: React.FC<NotepadProps> = ({ fileId }) => {
  const { files, updateFileContent } = useFileSystem();
  const file = fileId ? files.find(f => f.id === fileId) : undefined;

  const [text, setText] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [fontFamily, setFontFamily] = useState<FontFamily>('Consolas');
  const [fontSize, setFontSize] = useState<FontSize>(14);
  const [wordWrap, setWordWrap] = useState(true);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [statusBarMsg, setStatusBarMsg] = useState('');
  const [zoom, setZoom] = useState(100);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fonts: FontFamily[] = ['Consolas', 'Segoe UI', 'Courier New', 'Arial', 'Georgia'];
  const sizes: FontSize[] = [12, 14, 16, 18, 20, 24];

  useEffect(() => {
    if (file && file.content) {
      setText(file.content);
      setIsSaved(true);
    }
  }, [file]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const lineCount = text.split('\n').length;

  const getSelectionInfo = () => {
    const ta = textareaRef.current;
    if (!ta) return { line: 1, col: 1 };
    const val = ta.value.substring(0, ta.selectionStart);
    const lines = val.split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
  };

  const handleSave = () => {
    if (fileId) {
      updateFileContent(fileId, text);
      setIsSaved(true);
      setStatusBarMsg('Archivo guardado');
      setTimeout(() => setStatusBarMsg(''), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave(); }
    if (e.ctrlKey && e.key === 'a') { e.preventDefault(); textareaRef.current?.select(); }
    if (e.ctrlKey && e.key === 'z') { /* let browser handle undo */ }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newText = text.substring(0, start) + '  ' + text.substring(end);
      setText(newText);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setIsSaved(false);
  };

  const handleSelectAll = () => { textareaRef.current?.select(); setShowEditMenu(false); };
  const handleCopy = () => { document.execCommand('copy'); setShowEditMenu(false); };
  const handleCut = () => { document.execCommand('cut'); setShowEditMenu(false); };
  const handlePaste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const newText = text.substring(0, start) + t + text.substring(ta.selectionEnd);
      setText(newText);
    } catch {}
    setShowEditMenu(false);
  };

  const handleFind = () => {
    const term = prompt('Buscar:');
    if (!term) return;
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) { alert(`No se encontró "${term}"`); return; }
    const ta = textareaRef.current;
    if (ta) { ta.focus(); ta.setSelectionRange(idx, idx + term.length); }
  };

  const insertDateTime = () => {
    const now = new Date().toLocaleString('es-AR');
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const newText = text.substring(0, start) + now + text.substring(ta.selectionEnd);
    setText(newText);
    setIsSaved(false);
  };

  const closeAllMenus = () => {
    setShowFontMenu(false);
    setShowEditMenu(false);
    setShowViewMenu(false);
  };

  const { line, col } = getSelectionInfo();

  return (
    <div className="notepad-root" onClick={closeAllMenus}>
      {/* Menu Bar */}
      <div className="notepad-menubar">
        {/* File */}
        <div className="menu-group">
          <button className="menu-item" onClick={(e) => { e.stopPropagation(); closeAllMenus(); }}>
            Archivo {fileId && !isSaved ? '(*)' : ''}
          </button>
          <div className="menu-dropdown" style={{ display: 'none' }}>
            <button onClick={handleSave} disabled={!fileId}>Guardar &nbsp;<span className="shortcut">Ctrl+S</span></button>
          </div>
        </div>

        {/* Edit */}
        <div className="menu-group" style={{ position: 'relative' }}>
          <button className="menu-item" onClick={(e) => { e.stopPropagation(); setShowEditMenu(v => !v); setShowFontMenu(false); setShowViewMenu(false); }}>
            Editar
          </button>
          {showEditMenu && (
            <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
              <button onClick={handleCut}>Cortar<span className="shortcut">Ctrl+X</span></button>
              <button onClick={handleCopy}>Copiar<span className="shortcut">Ctrl+C</span></button>
              <button onClick={handlePaste}>Pegar<span className="shortcut">Ctrl+V</span></button>
              <div className="menu-sep" />
              <button onClick={handleSelectAll}>Seleccionar todo<span className="shortcut">Ctrl+A</span></button>
              <div className="menu-sep" />
              <button onClick={handleFind}>Buscar…<span className="shortcut">Ctrl+F</span></button>
              <div className="menu-sep" />
              <button onClick={insertDateTime}>Insertar fecha y hora<span className="shortcut">F5</span></button>
            </div>
          )}
        </div>

        {/* Format */}
        <div className="menu-group" style={{ position: 'relative' }}>
          <button className="menu-item" onClick={(e) => { e.stopPropagation(); setShowFontMenu(v => !v); setShowEditMenu(false); setShowViewMenu(false); }}>
            Formato
          </button>
          {showFontMenu && (
            <div className="menu-dropdown font-panel" onClick={(e) => e.stopPropagation()}>
              <p className="menu-label">Fuente</p>
              {fonts.map(f => (
                <button key={f} className={fontFamily === f ? 'active' : ''} onClick={() => { setFontFamily(f); setShowFontMenu(false); }}>
                  {f}
                </button>
              ))}
              <div className="menu-sep" />
              <p className="menu-label">Tamaño</p>
              <div className="size-grid">
                {sizes.map(s => (
                  <button key={s} className={`size-btn ${fontSize === s ? 'active' : ''}`} onClick={() => { setFontSize(s); setShowFontMenu(false); }}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="menu-sep" />
              <button onClick={() => { setWordWrap(v => !v); setShowFontMenu(false); }}>
                {wordWrap ? '✓ ' : ''}Ajuste de línea
              </button>
            </div>
          )}
        </div>

        {/* View */}
        <div className="menu-group" style={{ position: 'relative' }}>
          <button className="menu-item" onClick={(e) => { e.stopPropagation(); setShowViewMenu(v => !v); setShowFontMenu(false); setShowEditMenu(false); }}>
            Ver
          </button>
          {showViewMenu && (
            <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setZoom(z => Math.min(z + 10, 200)); setShowViewMenu(false); }}>Acercar (+10%)</button>
              <button onClick={() => { setZoom(z => Math.max(z - 10, 50)); setShowViewMenu(false); }}>Alejar (-10%)</button>
              <button onClick={() => { setZoom(100); setShowViewMenu(false); }}>Zoom 100%</button>
            </div>
          )}
        </div>

        {/* Save shortcut button */}
        <button
          className="save-btn"
          onClick={handleSave}
          disabled={!fileId}
          title="Guardar (Ctrl+S)"
          style={{ marginLeft: 'auto', opacity: fileId ? 1 : 0.4 }}
        >
          {isSaved ? '✅ Guardado' : '💾 Guardar'}
        </button>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        className="notepad-area"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={() => {}} // force rerender for cursor pos
        onClick={() => {}}
        placeholder={fileId ? 'Escribe aquí…' : 'Abre o crea un archivo .txt para poder guardar.'}
        disabled={!fileId}
        style={{
          fontFamily,
          fontSize: `${(fontSize * zoom) / 100}px`,
          whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
          overflowX: wordWrap ? 'hidden' : 'auto',
        }}
        spellCheck={false}
      />

      {/* Status Bar */}
      <div className="notepad-statusbar">
        <span className="status-info">Línea {line}, Col {col}</span>
        <span className="status-sep" />
        <span className="status-info">{wordCount} palabras · {charCount} caracteres · {lineCount} líneas</span>
        <span className="status-sep" />
        <span className="status-info">{fontFamily} {fontSize}px</span>
        <span className="status-sep" />
        <span className="status-info">Zoom: {zoom}%</span>
        {statusBarMsg && <><span className="status-sep" /><span className="status-saved">{statusBarMsg}</span></>}
      </div>

      <style>{`
        .notepad-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1c1c1c;
          color: #d4d4d4;
          font-family: 'Segoe UI', sans-serif;
          user-select: none;
        }
        .notepad-menubar {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 2px 8px;
          background: #2c2c2c;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          font-size: 13px;
          flex-shrink: 0;
        }
        .menu-group { position: relative; }
        .menu-item {
          background: transparent;
          border: none;
          color: #d4d4d4;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          white-space: nowrap;
        }
        .menu-item:hover { background: rgba(255,255,255,0.08); }
        .menu-dropdown {
          position: absolute;
          top: calc(100% + 2px);
          left: 0;
          background: #2d2d2d;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px;
          min-width: 220px;
          z-index: 9999;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          padding: 4px;
          display: flex;
          flex-direction: column;
        }
        .menu-dropdown button {
          background: transparent;
          border: none;
          color: #d4d4d4;
          padding: 7px 12px;
          border-radius: 4px;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          white-space: nowrap;
        }
        .menu-dropdown button:hover, .menu-dropdown button.active { background: rgba(255,255,255,0.1); color: white; }
        .menu-dropdown button:disabled { opacity: 0.4; cursor: default; }
        .shortcut { color: rgba(255,255,255,0.4); font-size: 11px; margin-left: 16px; }
        .menu-sep { height: 1px; background: rgba(255,255,255,0.08); margin: 4px 8px; }
        .menu-label { padding: 4px 12px 2px; font-size: 10px; text-transform: uppercase; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; }
        .font-panel { min-width: 200px; }
        .size-grid { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 12px; }
        .size-btn { width: 40px; text-align: center; padding: 4px 2px !important; border-radius: 4px; font-size: 12px !important; }
        .save-btn {
          background: rgba(0, 120, 212, 0.15);
          border: 1px solid rgba(0, 120, 212, 0.3);
          color: #60cdff;
          padding: 4px 14px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        .save-btn:hover:not(:disabled) { background: rgba(0, 120, 212, 0.3); }
        .notepad-area {
          flex: 1;
          background: #1e1e1e;
          border: none;
          color: #d4d4d4;
          padding: 14px 18px;
          line-height: 1.6;
          outline: none;
          resize: none;
          tab-size: 2;
          transition: font-size 0.2s;
          user-select: text;
        }
        .notepad-area:disabled { color: #555; background: #181818; }
        .notepad-statusbar {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 3px 12px;
          background: #007acc;
          font-size: 11px;
          color: white;
          flex-shrink: 0;
        }
        .status-info { padding: 0 8px; white-space: nowrap; }
        .status-sep { width: 1px; height: 12px; background: rgba(255,255,255,0.3); }
        .status-saved { padding: 0 8px; font-weight: bold; }
      `}</style>
    </div>
  );
};

export default Notepad;
