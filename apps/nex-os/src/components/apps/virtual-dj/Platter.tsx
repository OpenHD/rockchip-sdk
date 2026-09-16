import React, { useEffect, useRef } from 'react';

type Props = {
  accent: string;
  label: string;
  cover?: string;
  title?: string;
  playing: boolean;
  rate: number;
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  empty?: boolean;
};

/** Circular vinyl platter — spins while playing, ring shows progress. */
export const Platter: React.FC<Props> = ({
  accent,
  label,
  cover,
  title,
  playing,
  rate,
  currentTime,
  duration,
  onSeek,
  empty = false,
}) => {
  const discRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const lastTs = useRef<number | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts;
      const dt = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      if (playing && !dragging.current) {
        // ~33⅓ RPM visual base, scaled by pitch
        angleRef.current = (angleRef.current + dt * 200 * rate) % 360;
        if (discRef.current) {
          discRef.current.style.transform = `rotate(${angleRef.current}deg)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, rate]);

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const circumference = 2 * Math.PI * 46;
  const dash = circumference * progress;

  const seekFromEvent = (clientX: number, clientY: number, el: HTMLElement) => {
    if (!onSeek || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ang = Math.atan2(clientY - cy, clientX - cx);
    // Map angle (-PI..PI) → 0..1 starting from top
    let t = (ang + Math.PI / 2) / (Math.PI * 2);
    if (t < 0) t += 1;
    onSeek(t * duration);
  };

  return (
    <div
      className={`vdj-platter ${playing ? 'spinning' : ''} ${empty ? 'is-empty' : ''}`}
      style={{ ['--accent' as string]: accent }}
      onMouseDown={(e) => {
        if (empty) return;
        dragging.current = true;
        seekFromEvent(e.clientX, e.clientY, e.currentTarget);
      }}
      onMouseMove={(e) => {
        if (!dragging.current) return;
        seekFromEvent(e.clientX, e.clientY, e.currentTarget);
      }}
      onMouseUp={() => {
        dragging.current = false;
      }}
      onMouseLeave={() => {
        dragging.current = false;
      }}
      title={title || (empty ? `Soltá audio en deck ${label}` : `Deck ${label} platter`)}
    >
      <div className="vdj-platter-chassis">
        <svg className="vdj-platter-ring" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 50 50)"
            className="vdj-platter-progress"
          />
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const outer = 43.5;
            const inner = i % 5 === 0 ? 40 : 41.5;
            return (
              <line
                key={i}
                x1={50 + Math.cos(a) * inner}
                y1={50 + Math.sin(a) * inner}
                x2={50 + Math.cos(a) * outer}
                y2={50 + Math.sin(a) * outer}
                stroke={i % 5 === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)'}
                strokeWidth={i % 5 === 0 ? 1.2 : 0.7}
              />
            );
          })}
        </svg>

        <div className="vdj-platter-disc" ref={discRef}>
          <div className="vdj-platter-grooves" />
          <div className="vdj-platter-label">
            {cover ? (
              <img src={cover} alt="" draggable={false} />
            ) : (
              <div className="vdj-platter-empty">
                <span>{label}</span>
                {empty && <small>DROP</small>}
              </div>
            )}
            <div className="vdj-platter-spindle" />
          </div>
        </div>

        <div className={`vdj-platter-tonearm ${playing ? 'down' : ''}`} aria-hidden />
      </div>
    </div>
  );
};

export default Platter;
