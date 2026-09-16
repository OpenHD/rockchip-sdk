import React, { useCallback, useEffect, useRef } from 'react';
import { CUE_COLORS, type DjCuePoint, type DjLoopRegion } from './types';

type Props = {
  peaks: Float32Array | null;
  currentTime: number;
  duration: number;
  cues: DjCuePoint[];
  loop: DjLoopRegion | null;
  accent: string;
  onSeek: (time: number) => void;
};

export const Waveform: React.FC<Props> = ({
  peaks,
  currentTime,
  duration,
  cues,
  loop,
  accent,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const bed = ctx.createLinearGradient(0, 0, 0, h);
    bed.addColorStop(0, '#05080e');
    bed.addColorStop(0.5, '#0a121c');
    bed.addColorStop(1, '#060a10');
    ctx.fillStyle = bed;
    ctx.fillRect(0, 0, w, h);

    // Center guide
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const data = peaks && peaks.length > 0 ? peaks : null;
    const bars = Math.min(data?.length || 160, Math.floor(w / 2));
    const mid = h / 2;
    const gap = 0.6;
    const barW = Math.max(1, (w - gap * bars) / bars);
    const progress = duration > 0 ? currentTime / duration : 0;

    for (let i = 0; i < bars; i++) {
      const srcIdx = data ? Math.floor((i / bars) * data.length) : i;
      const amp = data ? data[srcIdx] : 0.12 + 0.2 * Math.sin(i * 0.17);
      const bh = Math.max(2, amp * (h * 0.9));
      const x = i * (barW + gap);
      const played = i / bars <= progress;
      if (played) {
        const g = ctx.createLinearGradient(0, mid - bh / 2, 0, mid + bh / 2);
        g.addColorStop(0, accent);
        g.addColorStop(1, 'rgba(255,255,255,0.55)');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = 'rgba(160, 185, 210, 0.18)';
      }
      ctx.fillRect(x, mid - bh / 2, barW, bh);
    }

    if (loop && duration > 0 && loop.outTime > loop.inTime) {
      const x1 = (loop.inTime / duration) * w;
      const x2 = (loop.outTime / duration) * w;
      ctx.fillStyle = loop.enabled ? 'rgba(46, 196, 182, 0.2)' : 'rgba(46, 196, 182, 0.08)';
      ctx.fillRect(x1, 0, Math.max(2, x2 - x1), h);
      ctx.strokeStyle = '#2ec4b6';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, h);
      ctx.moveTo(x2, 0);
      ctx.lineTo(x2, h);
      ctx.stroke();
    }

    for (const cue of cues) {
      if (!duration || cue.time < 0) continue;
      const x = (cue.time / duration) * w;
      const color = CUE_COLORS[(cue.id - 1) % CUE_COLORS.length] || accent;
      ctx.fillStyle = color;
      ctx.fillRect(x - 1, 0, 2, h);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 5, 0);
      ctx.lineTo(x, 7);
      ctx.closePath();
      ctx.fill();
    }

    if (duration > 0) {
      const px = (currentTime / duration) * w;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fff';
      ctx.fillRect(px - 1, 0, 2, h);
      ctx.shadowBlur = 0;
    }
  }, [accent, cues, currentTime, duration, loop, peaks]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  const timeFromEvent = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return 0;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'ew-resize', borderRadius: 4 }}
      onMouseDown={(e) => {
        dragging.current = true;
        onSeek(timeFromEvent(e.clientX));
      }}
      onMouseMove={(e) => {
        if (!dragging.current) return;
        onSeek(timeFromEvent(e.clientX));
      }}
      onMouseUp={() => {
        dragging.current = false;
      }}
      onMouseLeave={() => {
        dragging.current = false;
      }}
    />
  );
};

export default Waveform;
