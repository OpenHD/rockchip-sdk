import React, { useRef, useEffect, useState } from 'react';
import { 
  Pen24Regular, PaintBrush24Regular, Eraser24Regular, 
  Save24Regular, Delete24Regular, ArrowUndo24Regular, Color24Regular
} from '@fluentui/react-icons';
import { floodFill, initCanvasWhite } from './paintUtils';

// --- Bulletproof Windows 11 Styling ---

const BOX_SHADOW = "0 8px 16px rgba(0,0,0,0.5)";
const ACCENT_BLUE = "#60cdff";
const BG_DARK_INNER = "#191919";
const BG_RIBBON = "#2b2b2b";
const BORDER_COLOR = "rgba(255,255,255,0.06)";

const paletteColors = [
  '#000000', '#7F7F7F', '#880015', '#ED1C24', '#FF7F27', '#FFF200', '#22B14C', '#00A2E8', '#3F48CC', '#A349A4',
  '#ffffff', '#C3C3C3', '#B97A57', '#FFAEC9', '#FFC90E', '#EFE4B0', '#B5E61D', '#99D9EA', '#7092BE', '#C8BFE7'
];

const Paint: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pencil' | 'brush' | 'eraser' | 'bucket' | 'rect' | 'circle' | 'line'>('pencil');
  const [color1, setColor1] = useState('#000000');
  const [color2, setColor2] = useState('#ffffff');
  const [activeColorIdx, setActiveColorIdx] = useState<1 | 2>(1);
  const [size, setSize] = useState(3);
  
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [mouseCoords, setMouseCoords] = useState<{x: number, y: number} | null>(null);
  
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);

  const C_WIDTH = 1000;
  const C_HEIGHT = 600;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        initCanvasWhite(ctx, C_WIDTH, C_HEIGHT);
        commitToHistory(ctx);
      }
    }
  }, []);

  const commitToHistory = (ctxOverride?: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    const ctx = ctxOverride || canvas?.getContext('2d', { willReadFrequently: true });
    if (!ctx || !canvas) return;
    
    setUndoStack(prev => {
      const newStack = [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)];
      if (newStack.length > 20) newStack.shift();
      return newStack;
    });
  };

  const handleUndo = () => {
    if (undoStack.length <= 1) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const newStack = [...undoStack];
    newStack.pop(); 
    const previousState = newStack[newStack.length - 1];
    ctx.putImageData(previousState, 0, 0);
    setUndoStack(newStack);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (ctx && canvas) {
      initCanvasWhite(ctx, C_WIDTH, C_HEIGHT);
      commitToHistory();
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    const isRightClick = e.button === 2;
    const activeColor = isRightClick ? color2 : color1;
    let effectiveTool = tool;
    if (tool === 'eraser') effectiveTool = 'pencil';
    if (effectiveTool === 'bucket') {
      floodFill(ctx, x, y, activeColor);
      commitToHistory();
      return;
    }
    setStartX(x);
    setStartY(y);
    setIsDrawing(true);
    setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = tool === 'eraser' ? color2 : activeColor;
    ctx.fillStyle = tool === 'eraser' ? color2 : activeColor;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (rect) {
      setMouseCoords({
        x: Math.floor(e.clientX - rect.left),
        y: Math.floor(e.clientY - rect.top)
      });
    }
    if (!isDrawing) return;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!ctx || !canvas || !snapshot || !rect) return;
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    const isRightClick = e.buttons === 2;
    const activeColor = isRightClick ? color2 : color1;
    if (['rect', 'circle', 'line'].includes(tool)) ctx.putImageData(snapshot, 0, 0);
    ctx.strokeStyle = tool === 'eraser' ? color2 : activeColor;
    ctx.fillStyle = tool === 'eraser' ? color2 : activeColor;
    if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (tool === 'rect') {
      ctx.strokeRect(startX, startY, x - startX, y - startY);
    } else if (tool === 'circle') {
      ctx.beginPath();
      const radius = Math.sqrt(Math.pow(startX - x, 2) + Math.pow(startY - y, 2));
      ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      commitToHistory();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1c1c1c', color: 'white', userSelect: 'none', overflow: 'hidden' }}>
      
      {/* 1. TITLE BAR EMULATION (Archivo, Inicio, Ver) */}
      <div style={{ display: 'flex', alignItems: 'center', height: '40px', background: '#202020', borderBottom: `1px solid ${BORDER_COLOR}`, flexShrink: 0, padding: '0 8px' }}>
         <div style={{ display: 'flex', gap: '4px' }}>
            <Tab label="Archivo" active={false} />
            <Tab label="Inicio" active={true} />
            <Tab label="Ver" active={false} />
         </div>
         <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', padding: '0 12px' }}>
            <TopIcon icon={<ArrowUndo24Regular />} disabled={undoStack.length <= 1} onClick={handleUndo} />
            <TopIcon icon={<Delete24Regular />} onClick={clearCanvas} />
            <TopIcon icon={<Save24Regular />} />
         </div>
      </div>

      {/* 2. THE RIBBON (Tools, Shapes, Size, Colors) */}
      <div style={{ display: 'flex', height: '110px', background: BG_RIBBON, borderBottom: '1px solid black', padding: '12px 20px', gap: '2px', alignItems: 'stretch', flexShrink: 0 }}>
        
        {/* Tools Section */}
        <section style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${BORDER_COLOR}`, paddingRight: '16px', minWidth: '130px' }}>
           <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 32px)', gap: '4px', alignContent: 'center' }}>
              <ToolBtn icon={<Pen24Regular width={18} />} active={tool === 'pencil'} onClick={() => setTool('pencil')} />
              <ToolBtn icon={<Color24Regular width={18} />} active={tool === 'bucket'} onClick={() => setTool('bucket')} />
              <ToolBtn icon={<span style={{ fontWeight: 900, fontSize: '16px' }}>A</span>} disabled />
              <ToolBtn icon={<Eraser24Regular width={18} />} active={tool === 'eraser'} onClick={() => setTool('eraser')} />
              <ToolBtn icon={<div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid' }} />} disabled />
              <ToolBtn icon={<span style={{ fontSize: '18px' }}>⌕</span>} disabled />
           </div>
           <span style={{ fontSize: '10px', color: '#888', textAlign: 'center', marginTop: '4px' }}>Herramientas</span>
        </section>

        {/* Brushes Section */}
        <section style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${BORDER_COLOR}`, paddingRight: '16px', minWidth: '80px' }}>
           <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button 
                onClick={() => setTool('brush')}
                style={{ 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                  width: '64px', height: '64px', background: tool === 'brush' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: tool === 'brush' ? `1px solid ${BORDER_COLOR}` : 'none', borderRadius: '8px', color: 'white', cursor: 'pointer'
                }}
              >
                 <PaintBrush24Regular width={28} height={28} />
                 <span style={{ fontSize: '10px', marginTop: '2px' }}>Pinceles</span>
              </button>
           </div>
           <span style={{ fontSize: '10px', color: '#888', textAlign: 'center', marginTop: '4px' }}>Pinceles</span>
        </section>

        {/* Shapes Section */}
        <section style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${BORDER_COLOR}`, paddingRight: '16px', minWidth: '100px' }}>
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                 <ToolBtn icon={<div style={{ width: '14px', height: '0', borderTop: '2px solid', transform: 'rotate(-45deg)' }} />} active={tool === 'line'} onClick={() => setTool('line')} />
                 <ToolBtn icon={<div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid' }} />} active={tool === 'circle'} onClick={() => setTool('circle')} />
                 <ToolBtn icon={<div style={{ width: '14px', height: '14px', border: '1.5px solid' }} />} active={tool === 'rect'} onClick={() => setTool('rect')} />
              </div>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', opacity: 0.3 }}>
                 <ToolBtn icon={<div style={{ width: '14px', height: '14px', border: '1.5px solid', transform: 'rotate(45deg)' }} />} disabled />
                 <ToolBtn icon={<span>⭐</span>} disabled />
                 <ToolBtn icon={<span>♡</span>} disabled />
              </div>
           </div>
           <span style={{ fontSize: '10px', color: '#888', textAlign: 'center', marginTop: '4px' }}>Formas</span>
        </section>

        {/* Size Slider Section */}
        <section style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${BORDER_COLOR}`, paddingRight: '16px', width: '140px' }}>
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <input 
                type="range" min="1" max="40" value={size} 
                onChange={(e) => setSize(Number(e.target.value))}
                style={{ width: '100%', accentColor: ACCENT_BLUE, cursor: 'pointer' }}
              />
              <div style={{ fontSize: '10px', color: '#aaa', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                {size}px
              </div>
           </div>
           <span style={{ fontSize: '10px', color: '#888', textAlign: 'center', marginTop: '4px' }}>Tamaño</span>
        </section>

        {/* Colors Section */}
        <section style={{ display: 'flex', flexDirection: 'column', paddingLeft: '8px', minWidth: '300px' }}>
           <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                 <ColorPreview label="Color 1" color={color1} active={activeColorIdx === 1} onClick={() => setActiveColorIdx(1)} onColorChange={setColor1} />
                 <ColorPreview label="Color 2" color={color2} active={activeColorIdx === 2} onClick={() => setActiveColorIdx(2)} onColorChange={setColor2} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 18px)', gap: '4px' }}>
                 {paletteColors.map((hex, i) => (
                    <button 
                      key={i} 
                      onClick={() => activeColorIdx === 1 ? setColor1(hex) : setColor2(hex)}
                      style={{ 
                        width: '18px', height: '18px', borderRadius: '50%', background: hex, border: '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer', transition: 'transform 0.1s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    />
                 ))}
              </div>
           </div>
           <span style={{ fontSize: '10px', color: '#888', textAlign: 'center', marginTop: '4px' }}>Colores</span>
        </section>
      </div>

      {/* 3. WORKSPACE AREA */}
      <div style={{ flex: 1, background: BG_DARK_INNER, overflow: 'auto', display: 'flex', padding: '40px' }}>
         <div style={{ margin: 'auto', background: 'white', boxShadow: '0 20px 80px rgba(0,0,0,0.7)', borderRadius: '2px', overflow: 'hidden' }}>
            <canvas 
              ref={canvasRef}
              width={C_WIDTH}
              height={C_HEIGHT}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={() => { stopDrawing(); setMouseCoords(null); }}
              onContextMenu={e => e.preventDefault()}
              style={{ display: 'block', cursor: tool === 'bucket' ? 'cell' : 'crosshair', imageRendering: 'pixelated' }}
            />
         </div>
      </div>

      {/* 4. STATUS BAR */}
      <div style={{ height: '28px', background: '#202020', borderTop: `1px solid ${BORDER_COLOR}`, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: '11px', color: '#aaa', justifyContent: 'space-between' }}>
         <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px' }}>
               <span style={{ fontSize: '16px' }}>⌖</span>
               {mouseCoords ? <span>{mouseCoords.x}, {mouseCoords.y} px</span> : <span>--</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
               <span style={{ fontSize: '16px' }}>◧</span>
               <span>{C_WIDTH} × {C_HEIGHT} px</span>
            </div>
         </div>
         <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>100%</span>
            <div style={{ width: '80px', height: '2px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
               <div style={{ width: '50%', height: '100%', background: ACCENT_BLUE }} />
            </div>
         </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS (With Inline Styles for Bulletproof Design) ---

const Tab = ({ label, active }: { label: string, active: boolean }) => (
  <button style={{ 
    height: '40px', padding: '0 16px', background: 'transparent', border: 'none', borderBottom: active ? `3px solid ${ACCENT_BLUE}` : 'none',
    color: active ? 'white' : '#aaa', fontSize: '13px', fontWeight: active ? 'bold' : 'normal', cursor: 'pointer', transition: 'color 0.2s'
  }}
  onMouseEnter={(e) => !active && (e.currentTarget.style.color = 'white')}
  onMouseLeave={(e) => !active && (e.currentTarget.style.color = '#aaa')}
  >
    {label}
  </button>
);

const TopIcon = ({ icon, onClick, disabled }: { icon: any, onClick?: any, disabled?: boolean }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    style={{ 
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', 
      background: 'transparent', border: 'none', color: 'white', borderRadius: '4px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1
    }}
    onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
    onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = 'transparent')}
  >
    {React.cloneElement(icon, { width: 18, height: 18 })}
  </button>
);

const ToolBtn = ({ icon, active, onClick, disabled }: any) => (
  <button 
    disabled={disabled}
    onClick={onClick}
    style={{ 
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', 
      borderRadius: '6px', background: active ? 'rgba(255,255,255,0.12)' : 'transparent', border: 'none',
      color: active ? 'white' : '#aaa', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.2 : 1
    }}
    onMouseEnter={(e) => !disabled && !active && (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
    onMouseLeave={(e) => !disabled && !active && (e.currentTarget.style.background = 'transparent')}
  >
    {icon}
  </button>
);

const ColorPreview = ({ label, color, active, onClick, onColorChange }: any) => (
  <button 
    onClick={onClick}
    style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
      width: '54px', height: '64px', background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
      border: `1px solid ${active ? ACCENT_BLUE : 'transparent'}`, borderRadius: '8px', cursor: 'pointer'
    }}
  >
     <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: color, border: '1px solid rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden' }}>
        <input type="color" value={color} onChange={e => onColorChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
     </div>
     <span style={{ fontSize: '9px', marginTop: '4px', color: '#ccc' }}>{label}</span>
  </button>
);

export default Paint;