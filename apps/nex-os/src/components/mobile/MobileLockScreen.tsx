import React, { useEffect, useRef, useState } from 'react';
import { ArrowClockwise24Regular, Power24Regular } from '@fluentui/react-icons';
import { useSettings } from '../../context/SettingsContext';
import MobileStatusBar from './MobileStatusBar';
import './mobile.css';

interface MobileLockScreenProps {
  onLogin: () => void;
  wallpaper: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

const MobileLockScreen: React.FC<MobileLockScreenProps> = ({ onLogin, wallpaper }) => {
  const { osType, users, currentUserId, setCurrentUserId, setSystemState } = useSettings();
  const [unlockedUi, setUnlockedUi] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const startY = useRef<number | null>(null);

  const currentUser = users.find((u) => u.id === currentUserId) || users[0];

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const tryLogin = (value: string) => {
    if (currentUser?.pin && value !== currentUser.pin) {
      setError('PIN incorrecto');
      setPin('');
      return;
    }
    setError('');
    onLogin();
  };

  const reveal = () => {
    if (!currentUser?.pin) {
      onLogin();
      return;
    }
    setUnlockedUi(true);
  };

  const onKey = (k: string) => {
    if (k === '') return;
    if (k === '⌫') {
      setPin((p) => p.slice(0, -1));
      setError('');
      return;
    }
    const next = (pin + k).slice(0, 8);
    setPin(next);
    setError('');
    if (currentUser?.pin && next.length === currentUser.pin.length) {
      tryLogin(next);
    }
  };

  return (
    <div
      className="nex-m-lock"
      style={{ fontFamily: osType === 'nexos' ? '"JetBrains Mono", monospace' : undefined }}
      onTouchStart={(e) => {
        startY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (startY.current == null) return;
        const dy = startY.current - e.changedTouches[0].clientY;
        startY.current = null;
        if (dy > 48) reveal();
      }}
      onClick={() => {
        if (!unlockedUi) reveal();
      }}
    >
      <div
        className="nex-m-lock-bg"
        style={{
          backgroundImage:
            osType === 'nexos'
              ? 'linear-gradient(to bottom, #000, #0a0a0a), url("https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070")'
              : `url("${wallpaper}")`,
        }}
      />
      <MobileStatusBar />

      <div className={`nex-m-lock-clock ${unlockedUi ? 'up' : ''}`}>
        <time dateTime={now.toISOString()}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
        <div className="nex-m-date">
          {new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
        </div>
      </div>

      {!unlockedUi && (
        <div className="nex-m-lock-hint">
          <div className="pill" />
          Desliza hacia arriba
        </div>
      )}

      {unlockedUi && (
        <div className="nex-m-lock-panel" onClick={(e) => e.stopPropagation()}>
          <img
            className="nex-m-lock-avatar"
            src={
              currentUser?.avatar ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300&auto=format&fit=crop'
            }
            alt=""
          />
          <div className="nex-m-lock-name">{currentUser?.name}</div>

          {currentUser?.pin ? (
            <>
              <div className="nex-m-pin-dots" aria-hidden>
                {Array.from({ length: Math.max(4, currentUser.pin.length) }).map((_, i) => (
                  <i key={i} className={i < pin.length ? 'filled' : ''} />
                ))}
              </div>
              {error && <div className="nex-m-lock-error">{error}</div>}
              <div className="nex-m-keypad">
                {KEYS.map((k, i) => (
                  <button
                    key={`${k}-${i}`}
                    type="button"
                    className="nex-m-key"
                    disabled={k === ''}
                    onClick={() => onKey(k)}
                    style={{ visibility: k === '' ? 'hidden' : 'visible' }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button type="button" className="nex-m-enter" onClick={() => onLogin()}>
              Entrar
            </button>
          )}

          <div className="nex-m-lock-users">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                className={u.id === currentUserId ? 'on' : ''}
                onClick={() => {
                  setCurrentUserId(u.id);
                  setPin('');
                  setError('');
                }}
              >
                <img src={u.avatar} alt="" />
                {u.name}
              </button>
            ))}
          </div>

          <div className="nex-m-shade-actions" style={{ width: '100%', maxWidth: 320 }}>
            <button type="button" onClick={() => setSystemState('RESTARTING')}>
              <ArrowClockwise24Regular /> Reiniciar
            </button>
            <button type="button" className="danger" onClick={() => setSystemState('SHUTTING_DOWN')}>
              <Power24Regular /> Apagar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileLockScreen;
