import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Photo {
  id: string;
  url: string;
  title: string;
  width: number;
  height: number;
}

const SAMPLE_PHOTOS: Photo[] = [
  { id: '1', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', title: 'Montañas al amanecer', width: 800, height: 533 },
  { id: '2', url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800', title: 'Bosque mágico', width: 800, height: 533 },
  { id: '3', url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800', title: 'Lago de montaña', width: 800, height: 533 },
  { id: '4', url: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800', title: 'Ciudad de noche', width: 800, height: 533 },
  { id: '5', url: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800', title: 'Cascada tropical', width: 800, height: 533 },
  { id: '6', url: 'https://images.unsplash.com/photo-1527489377706-5bf97e608852?w=800', title: 'Playa paradisíaca', width: 800, height: 533 },
  { id: '7', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', title: 'Noche estrellada', width: 800, height: 533 },
  { id: '8', url: 'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=800', title: 'Valle verde', width: 800, height: 533 },
  { id: '9', url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800', title: 'Desierto dorado', width: 800, height: 533 },
  { id: '10', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800', title: 'Retrato urbano', width: 800, height: 533 },
  { id: '11', url: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800', title: 'Flor silvestre', width: 800, height: 533 },
  { id: '12', url: 'https://images.unsplash.com/photo-1479030160180-b1f79a33b2f2?w=800', title: 'Amanecer en el mar', width: 800, height: 533 },
];

export default function Photos() {
  const [selected, setSelected] = useState<Photo | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  const [urlInput, setUrlInput] = useState('');
  const [customPhotos, setCustomPhotos] = useState<Photo[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);

  const allPhotos = [...SAMPLE_PHOTOS, ...customPhotos];

  const openPhoto = (photo: Photo, idx: number) => {
    setSelected(photo);
    setSelectedIdx(idx);
    setZoom(1);
    setRotation(0);
  };

  const closePhoto = () => { setSelected(null); setZoom(1); setRotation(0); };

  const navigate = (dir: 1 | -1) => {
    const newIdx = (selectedIdx + dir + allPhotos.length) % allPhotos.length;
    setSelectedIdx(newIdx);
    setSelected(allPhotos[newIdx]);
    setZoom(1);
    setRotation(0);
  };

  const addFromUrl = () => {
    if (!urlInput.trim()) return;
    const id = Date.now().toString();
    setCustomPhotos(p => [...p, { id, url: urlInput.trim(), title: 'Foto personalizada ' + (customPhotos.length + 1), width: 800, height: 533 }]);
    setUrlInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selected) return;
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
    if (e.key === 'Escape') closePhoto();
    if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 4));
    if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.25));
    if (e.key === 'r') setRotation(r => r + 90);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111', color: 'white', outline: 'none' }} tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#1c1c1c', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--win-accent)', marginRight: 8 }}>📷 Fotos</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{allPhotos.length} fotos</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Add from URL */}
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addFromUrl()}
            placeholder="Añadir URL de imagen..."
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'white', padding: '5px 10px', fontSize: 12, width: 200, outline: 'none' }}
          />
          <button onClick={addFromUrl} style={tbBtn}>➕ Añadir</button>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
          <button onClick={() => setViewMode('grid')} style={{ ...tbBtn, background: viewMode === 'grid' ? 'rgba(0,120,212,0.3)' : undefined }}>⊞</button>
          <button onClick={() => setViewMode('list')} style={{ ...tbBtn, background: viewMode === 'list' ? 'rgba(0,120,212,0.3)' : undefined }}>☰</button>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'date')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'white', padding: '5px 8px', fontSize: 12 }}>
            <option value="name">Por nombre</option>
            <option value="date">Por fecha</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {allPhotos.map((photo, idx) => (
              <motion.div
                key={photo.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => openPhoto(photo, idx)}
                style={{ cursor: 'pointer', borderRadius: 10, overflow: 'hidden', background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.06)', aspectRatio: '4/3', position: 'relative' }}
              >
                <img src={photo.url} alt={photo.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '20px 10px 8px', fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                  {photo.title}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {allPhotos.map((photo, idx) => (
              <div key={photo.id} onClick={() => openPhoto(photo, idx)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                <img src={photo.url} alt="" style={{ width: 56, height: 40, objectFit: 'cover', borderRadius: 6 }} loading="lazy" />
                <span style={{ fontSize: 13 }}>{photo.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closePhoto}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}
          >
            {/* Lightbox toolbar */}
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
              <span style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{selected.title} · {selectedIdx + 1}/{allPhotos.length}</span>
              <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} style={lbBtn}>🔍−</button>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', minWidth: 48, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))} style={lbBtn}>🔍+</button>
              <button onClick={() => setZoom(1)} style={lbBtn}>↺ Reset</button>
              <button onClick={() => setRotation(r => r + 90)} style={lbBtn}>🔄 Rotar</button>
              <button onClick={closePhoto} style={{ ...lbBtn, background: 'rgba(196,43,28,0.3)', marginLeft: 8 }}>✕ Cerrar</button>
            </div>

            {/* Nav buttons + image */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, overflow: 'hidden' }}>
              <button onClick={(e) => { e.stopPropagation(); navigate(-1); }} style={{ ...navBtn, left: 20 }}>‹</button>
              <motion.img
                ref={imgRef}
                key={selected.url}
                src={selected.url}
                alt={selected.title}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '80vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.8)', transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: 'transform 0.3s ease', cursor: zoom > 1 ? 'grab' : 'default' }}
              />
              <button onClick={(e) => { e.stopPropagation(); navigate(1); }} style={{ ...navBtn, right: 20 }}>›</button>
            </div>

            {/* Thumbnail strip */}
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8, padding: '12px 20px', overflowX: 'auto', background: 'rgba(255,255,255,0.03)', flexShrink: 0 }}>
              {allPhotos.map((p, i) => (
                <img key={p.id} src={p.url} alt="" onClick={() => { setSelectedIdx(i); setSelected(p); setZoom(1); setRotation(0); }}
                  style={{ height: 52, width: 72, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', flexShrink: 0, border: i === selectedIdx ? '2px solid var(--win-accent)' : '2px solid transparent', opacity: i === selectedIdx ? 1 : 0.5, transition: 'all 0.2s' }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const tbBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'white', padding: '5px 10px', cursor: 'pointer', fontSize: 12 };
const lbBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, color: 'white', padding: '6px 12px', cursor: 'pointer', fontSize: 13 };
const navBtn: React.CSSProperties = { position: 'absolute' as const, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: 40, cursor: 'pointer', width: 50, height: 80, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', transition: 'background 0.2s' };
