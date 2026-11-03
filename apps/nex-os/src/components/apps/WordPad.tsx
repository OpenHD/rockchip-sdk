import React, { useState, useRef } from 'react';
import {
  Save24Regular,
  Open24Regular,
  Print24Regular,
  TextBold24Regular,
  TextItalic24Regular,
  TextUnderline24Regular,
  TextAlignLeft24Regular,
  TextAlignCenter24Regular,
  TextAlignRight24Regular,
  TextStrikethrough24Regular,
  List24Regular,
} from '@fluentui/react-icons';

type Alignment = 'left' | 'center' | 'right' | 'justify';

const FONTS = ['Calibri', 'Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Segoe UI'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 72];
const COLORS = ['#ffffff', '#cccccc', '#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#748ffc', '#da77f2', '#f783ac', '#000000'];

const WordPad: React.FC = () => {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);
  const [alignment, setAlignment] = useState<Alignment>('left');
  const [textColor, setTextColor] = useState('#e8e8e8');
  const [lineHeight, setLineHeight] = useState(1.6);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [zoom, setZoom] = useState(100);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setWordCount(val.trim() ? val.trim().split(/\s+/).length : 0);
    setCharCount(val.length);
  };

  const handleSave = () => {
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    a.download = 'documento.txt';
    a.click();
  };

  const handleOpen = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'text/plain,.rtf';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => setText((ev.target?.result as string) || '');
      reader.readAsText(file);
    };
    input.click();
  };

  const handlePrint = () => {
    const w = window.open('', '', 'height=700,width=800');
    if (!w) return;
    w.document.write(`
      <html><head><title>Imprimir — WordPad</title>
      <style>body { margin: 32px; font-family: ${fontFamily}; font-size: ${fontSize}px;
        font-weight: ${isBold ? 'bold' : 'normal'};
        font-style: ${isItalic ? 'italic' : 'normal'};
        text-decoration: ${isUnderline ? 'underline' : isStrike ? 'line-through' : 'none'};
        text-align: ${alignment}; color: #000; }</style>
      </head><body><pre style="white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre></body></html>
    `);
    w.document.close();
    w.print();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey) {
      if (e.key === 's') { e.preventDefault(); handleSave(); }
      if (e.key === 'b') { e.preventDefault(); setIsBold(v => !v); }
      if (e.key === 'i') { e.preventDefault(); setIsItalic(v => !v); }
      if (e.key === 'u') { e.preventDefault(); setIsUnderline(v => !v); }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(z => Math.min(z + 10, 200)); }
      if (e.key === '-') { e.preventDefault(); setZoom(z => Math.max(z - 10, 50)); }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const s = ta.selectionStart;
      const newText = text.substring(0, s) + '\t' + text.substring(ta.selectionEnd);
      setText(newText);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 1; }, 0);
    }
  };

  // Toolbar button style helper
  const tbBtn = (active = false): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '5px 10px',
    background: active ? 'rgba(0, 120, 212, 0.35)' : 'rgba(255,255,255,0.07)',
    border: active ? '1px solid rgba(0, 120, 212, 0.6)' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: 5,
    color: active ? '#60cdff' : '#d4d4d4',
    cursor: 'pointer',
    fontSize: 13,
    transition: 'all 0.15s',
    flexShrink: 0,
  });

  const sep: React.CSSProperties = {
    width: 1, height: 28,
    background: 'rgba(255,255,255,0.12)',
    margin: '0 6px',
    flexShrink: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', color: '#d4d4d4', fontFamily: 'Segoe UI, sans-serif', userSelect: 'none' }}>

      {/* ── Ribbon ── */}
      <div style={{ background: '#2a2a2a', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '8px 12px', flexShrink: 0 }}>

        {/* Row 1: File ops + Font controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <button style={{ ...tbBtn(), gap: 6, paddingRight: 12 }} onClick={handleOpen} title="Abrir (Ctrl+O)">
            <Open24Regular style={{ fontSize: 18 }} /><span>Abrir</span>
          </button>
          <button style={{ ...tbBtn(), gap: 6, paddingRight: 12 }} onClick={handleSave} title="Guardar (Ctrl+S)">
            <Save24Regular style={{ fontSize: 18 }} /><span>Guardar</span>
          </button>
          <button style={{ ...tbBtn(), gap: 6, paddingRight: 12 }} onClick={handlePrint} title="Imprimir">
            <Print24Regular style={{ fontSize: 18 }} /><span>Imprimir</span>
          </button>

          <div style={sep} />

          {/* Font family */}
          <select
            value={fontFamily}
            onChange={e => setFontFamily(e.target.value)}
            style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, color: '#d4d4d4', padding: '5px 8px', fontSize: 13, cursor: 'pointer', minWidth: 130 }}
          >
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          {/* Font size */}
          <select
            value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, color: '#d4d4d4', padding: '5px 8px', fontSize: 13, cursor: 'pointer', width: 64 }}
          >
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div style={sep} />

          {/* Zoom */}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginRight: 2 }}>Zoom:</span>
          <button style={tbBtn()} onClick={() => setZoom(z => Math.max(z - 10, 50))} title="Alejar (Ctrl+-)">−</button>
          <span style={{ fontSize: 12, minWidth: 40, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>{zoom}%</span>
          <button style={tbBtn()} onClick={() => setZoom(z => Math.min(z + 10, 200))} title="Acercar (Ctrl++)">+</button>
          <button style={{ ...tbBtn(), fontSize: 11 }} onClick={() => setZoom(100)}>↺</button>

          <div style={sep} />

          {/* Line height */}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginRight: 2 }}>Interl.:</span>
          <select
            value={lineHeight}
            onChange={e => setLineHeight(Number(e.target.value))}
            style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, color: '#d4d4d4', padding: '5px 6px', fontSize: 12, cursor: 'pointer', width: 58 }}
          >
            {[1, 1.15, 1.5, 1.6, 2, 2.5].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Row 2: Formatting + Alignment + Color */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button style={tbBtn(isBold)} onClick={() => setIsBold(v => !v)} title="Negrita (Ctrl+B)"><TextBold24Regular /></button>
          <button style={tbBtn(isItalic)} onClick={() => setIsItalic(v => !v)} title="Cursiva (Ctrl+I)"><TextItalic24Regular /></button>
          <button style={tbBtn(isUnderline)} onClick={() => setIsUnderline(v => !v)} title="Subrayado (Ctrl+U)"><TextUnderline24Regular /></button>
          <button style={tbBtn(isStrike)} onClick={() => setIsStrike(v => !v)} title="Tachado"><TextStrikethrough24Regular /></button>

          <div style={sep} />

          <button style={tbBtn(alignment === 'left')} onClick={() => setAlignment('left')} title="Alinear izquierda"><TextAlignLeft24Regular /></button>
          <button style={tbBtn(alignment === 'center')} onClick={() => setAlignment('center')} title="Centrar"><TextAlignCenter24Regular /></button>
          <button style={tbBtn(alignment === 'right')} onClick={() => setAlignment('right')} title="Alinear derecha"><TextAlignRight24Regular /></button>
          <button style={tbBtn(alignment === 'justify')} onClick={() => setAlignment('justify')} title="Justificar"><List24Regular /></button>

          <div style={sep} />

          {/* Color picker row */}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Color:</span>
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setTextColor(c)}
              title={c}
              style={{
                width: 20, height: 20, borderRadius: '50%', border: textColor === c ? '2px solid white' : '2px solid rgba(255,255,255,0.15)',
                background: c, cursor: 'pointer', flexShrink: 0, padding: 0, transition: 'transform 0.15s',
                transform: textColor === c ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ))}
          <input
            type="color"
            value={textColor}
            onChange={e => setTextColor(e.target.value)}
            title="Color personalizado"
            style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent', padding: 0 }}
          />
        </div>
      </div>

      {/* ── Page / Textarea ── */}
      <div style={{ flex: 1, overflow: 'auto', background: '#141414', display: 'flex', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{
          width: `${(794 * zoom) / 100}px`,
          minHeight: `${(1123 * zoom) / 100}px`,
          background: '#f5f5f0',
          boxShadow: '0 4px 32px rgba(0,0,0,0.7)',
          borderRadius: 2,
          padding: `${(32 * zoom) / 100}px ${(48 * zoom) / 100}px`,
          transition: 'width 0.2s, min-height 0.2s',
        }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Empieza a escribir tu documento..."
            style={{
              width: '100%',
              minHeight: `${(1060 * zoom) / 100}px`,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily,
              fontSize: `${(fontSize * zoom) / 100}px`,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal',
              textDecoration: [isUnderline ? 'underline' : '', isStrike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
              textAlign: alignment,
              color: '#1a1a1a',          // ← texto oscuro sobre hoja blanca
              lineHeight,
              caretColor: '#0078d4',
              userSelect: 'text',
            }}
          />
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '4px 16px',
        background: '#007acc',
        fontSize: 11, color: 'white',
        flexShrink: 0,
      }}>
        <span>{wordCount} palabras</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span>{charCount} caracteres</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span>{fontFamily} {fontSize}px</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span>Zoom {zoom}%</span>
        <span style={{ marginLeft: 'auto', opacity: 0.8 }}>Ctrl+S para guardar</span>
      </div>
    </div>
  );
};

export default WordPad;
