import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ClockTab = 'reloj' | 'cronometro' | 'temporizador' | 'zonas';

const WORLD_ZONES = [
  { city: 'Buenos Aires', tz: 'America/Argentina/Buenos_Aires', emoji: '🇦🇷' },
  { city: 'Nueva York', tz: 'America/New_York', emoji: '🇺🇸' },
  { city: 'Londres', tz: 'Europe/London', emoji: '🇬🇧' },
  { city: 'Madrid', tz: 'Europe/Madrid', emoji: '🇪🇸' },
  { city: 'Tokyo', tz: 'Asia/Tokyo', emoji: '🇯🇵' },
  { city: 'Sídney', tz: 'Australia/Sydney', emoji: '🇦🇺' },
  { city: 'Dubai', tz: 'Asia/Dubai', emoji: '🇦🇪' },
  { city: 'Ciudad de México', tz: 'America/Mexico_City', emoji: '🇲🇽' },
];

function getTimeInZone(tz: string) {
  return new Date().toLocaleTimeString('es-AR', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function AnalogClock({ date }: { date: Date }) {
  const s = date.getSeconds();
  const m = date.getMinutes();
  const h = date.getHours() % 12;
  const secDeg = s * 6;
  const minDeg = m * 6 + s * 0.1;
  const hourDeg = h * 30 + m * 0.5;

  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Face */}
      <circle cx="100" cy="100" r="95" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
      {/* Glow ring */}
      <circle cx="100" cy="100" r="90" fill="none" stroke="var(--win-accent)" strokeWidth="0.5" opacity="0.4" />
      {/* Hour marks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const r1 = 80, r2 = 88;
        return (
          <line
            key={i}
            x1={100 + r1 * Math.cos(angle)} y1={100 + r1 * Math.sin(angle)}
            x2={100 + r2 * Math.cos(angle)} y2={100 + r2 * Math.sin(angle)}
            stroke="rgba(255,255,255,0.5)" strokeWidth={i % 3 === 0 ? 3 : 1.5} strokeLinecap="round"
          />
        );
      })}
      {/* Hour hand */}
      <line
        x1="100" y1="100"
        x2={100 + 50 * Math.cos((hourDeg - 90) * Math.PI / 180)}
        y2={100 + 50 * Math.sin((hourDeg - 90) * Math.PI / 180)}
        stroke="white" strokeWidth="4" strokeLinecap="round"
        style={{ transition: 'x2 0.5s, y2 0.5s' }}
      />
      {/* Minute hand */}
      <line
        x1="100" y1="100"
        x2={100 + 68 * Math.cos((minDeg - 90) * Math.PI / 180)}
        y2={100 + 68 * Math.sin((minDeg - 90) * Math.PI / 180)}
        stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round"
        style={{ transition: 'x2 0.5s, y2 0.5s' }}
      />
      {/* Second hand */}
      <line
        x1={100 - 15 * Math.cos((secDeg - 90) * Math.PI / 180)}
        y1={100 - 15 * Math.sin((secDeg - 90) * Math.PI / 180)}
        x2={100 + 75 * Math.cos((secDeg - 90) * Math.PI / 180)}
        y2={100 + 75 * Math.sin((secDeg - 90) * Math.PI / 180)}
        stroke="var(--win-accent)" strokeWidth="1.5" strokeLinecap="round"
      />
      {/* Center dot */}
      <circle cx="100" cy="100" r="4" fill="var(--win-accent)" />
    </svg>
  );
}

export default function ClockApp() {
  const [tab, setTab] = useState<ClockTab>('reloj');
  const [now, setNow] = useState(new Date());

  // Cronómetro
  const [swRunning, setSwRunning] = useState(false);
  const [swTime, setSwTime] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const swRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Temporizador
  const [timerH, setTimerH] = useState(0);
  const [timerM, setTimerM] = useState(5);
  const [timerS, setTimerS] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Cronómetro
  useEffect(() => {
    if (swRunning) {
      swRef.current = setInterval(() => setSwTime(t => t + 10), 10);
    } else if (swRef.current) {
      clearInterval(swRef.current);
    }
    return () => { if (swRef.current) clearInterval(swRef.current); };
  }, [swRunning]);

  const formatSw = (ms: number) => {
    const cents = Math.floor((ms % 1000) / 10);
    const secs = Math.floor(ms / 1000) % 60;
    const mins = Math.floor(ms / 60000) % 60;
    const hrs = Math.floor(ms / 3600000);
    return `${hrs > 0 ? hrs + ':' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cents).padStart(2, '0')}`;
  };

  // Temporizador
  const startTimer = () => {
    const total = timerH * 3600 + timerM * 60 + timerS;
    if (total <= 0) return;
    setTimerRemaining(total);
    setTimerRunning(true);
  };

  useEffect(() => {
    if (timerRunning && timerRemaining !== null) {
      timerRef.current = setInterval(() => {
        setTimerRemaining(r => {
          if (r === null || r <= 1) {
            setTimerRunning(false);
            clearInterval(timerRef.current!);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h > 0 ? String(h).padStart(2, '0') + ':' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const timerProgress = timerRemaining !== null
    ? 1 - timerRemaining / (timerH * 3600 + timerM * 60 + timerS || 1)
    : 0;

  const tabs: { id: ClockTab; label: string }[] = [
    { id: 'reloj', label: '🕐 Reloj' },
    { id: 'cronometro', label: '⏱ Cronómetro' },
    { id: 'temporizador', label: '⏳ Temporizador' },
    { id: 'zonas', label: '🌍 Zonas Horarias' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a14', color: 'white', fontFamily: 'Segoe UI, sans-serif' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, padding: '12px 16px 0', background: '#111120', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? 'rgba(96,205,255,0.12)' : 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--win-accent)' : '2px solid transparent',
              color: tab === t.id ? 'var(--win-accent)' : 'rgba(255,255,255,0.5)',
              padding: '8px 18px',
              cursor: 'pointer',
              fontSize: 13,
              borderRadius: '6px 6px 0 0',
              transition: 'all 0.2s',
              fontWeight: tab === t.id ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <AnimatePresence mode="wait">
          {tab === 'reloj' && (
            <motion.div key="reloj" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              <AnalogClock date={now} />
              <div style={{ fontSize: 52, fontWeight: 100, letterSpacing: '0.05em', fontVariantNumeric: 'tabular-nums' }}>
                {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>
                {now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </motion.div>
          )}

          {tab === 'cronometro' && (
            <motion.div key="crono" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <div style={{ fontSize: 60, fontWeight: 100, fontVariantNumeric: 'tabular-nums', fontFamily: 'Consolas, monospace' }}>
                {formatSw(swTime)}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setSwRunning(r => !r)} style={btnStyle(swRunning ? '#c42b1c' : '#0078d4')}>
                  {swRunning ? '⏸ Pausar' : '▶ Iniciar'}
                </button>
                <button onClick={() => { if (swRunning) setLaps(l => [swTime, ...l]); }} style={btnStyle('#333')} disabled={!swRunning}>
                  🏁 Vuelta
                </button>
                <button onClick={() => { setSwRunning(false); setSwTime(0); setLaps([]); }} style={btnStyle('#333')}>
                  🔄 Reset
                </button>
              </div>
              {laps.length > 0 && (
                <div style={{ width: '100%', maxWidth: 340, maxHeight: 200, overflow: 'auto' }}>
                  {laps.map((lap, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Vuelta {laps.length - i}</span>
                      <span style={{ fontFamily: 'Consolas', color: 'var(--win-accent)' }}>{formatSw(lap)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'temporizador' && (
            <motion.div key="timer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              {timerRemaining === null ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 40 }}>
                  {[['h', timerH, setTimerH, 23], ['m', timerM, setTimerM, 59], ['s', timerS, setTimerS, 59]].map(([label, val, set, max]) => (
                    <React.Fragment key={label as string}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          value={val as number}
                          min={0}
                          max={max as number}
                          onChange={e => (set as (v: number) => void)(Math.min(max as number, Math.max(0, +e.target.value)))}
                          style={{ width: 80, textAlign: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'white', fontSize: 36, fontFamily: 'Consolas', padding: '4px 0' }}
                        />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{label as string}</span>
                      </div>
                      {label !== 's' && <span style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>:</span>}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div style={{ position: 'relative', width: 200, height: 200 }}>
                  <svg width="200" height="200" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                    <circle cx="100" cy="100" r="88" fill="none" stroke={timerRemaining === 0 ? '#c42b1c' : 'var(--win-accent)'}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 88}`}
                      strokeDashoffset={`${2 * Math.PI * 88 * timerProgress}`}
                      style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 40, fontFamily: 'Consolas', color: timerRemaining === 0 ? '#ff6b6b' : 'white' }}>
                      {formatTimer(timerRemaining)}
                    </span>
                    {timerRemaining === 0 && <span style={{ color: '#ff6b6b', fontSize: 12, marginTop: 4 }}>¡Tiempo!</span>}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                {timerRemaining === null ? (
                  <button onClick={startTimer} style={btnStyle('#0078d4')}>▶ Iniciar</button>
                ) : (
                  <>
                    <button onClick={() => setTimerRunning(r => !r)} style={btnStyle(timerRunning ? '#c42b1c' : '#0078d4')}>
                      {timerRunning ? '⏸ Pausar' : '▶ Reanudar'}
                    </button>
                    <button onClick={() => { setTimerRemaining(null); setTimerRunning(false); if (timerRef.current) clearInterval(timerRef.current); }} style={btnStyle('#333')}>
                      🔄 Reset
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {tab === 'zonas' && (
            <motion.div key="zonas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {WORLD_ZONES.map(z => (
                <div key={z.tz} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 22 }}>{z.emoji}</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{z.city}</span>
                  </div>
                  <div style={{ fontSize: 28, fontFamily: 'Consolas', fontWeight: 300, color: 'var(--win-accent)' }}>
                    {getTimeInZone(z.tz)}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: 'none',
    color: 'white',
    padding: '10px 22px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.2s',
  };
}
