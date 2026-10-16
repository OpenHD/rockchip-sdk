import React, { useEffect, useState } from 'react';
import { Wifi124Regular, WifiWarning24Regular } from '@fluentui/react-icons';
import { useSettings } from '../../context/SettingsContext';

interface BatteryManagerLike {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function useBattery() {
  const [level, setLevel] = useState(0.87);
  const [charging, setCharging] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
    if (!nav.getBattery) return;
    let batt: BatteryManagerLike | null = null;
    const sync = () => {
      if (!batt) return;
      setLevel(batt.level);
      setCharging(batt.charging);
    };
    nav.getBattery().then((b) => {
      batt = b;
      sync();
      b.addEventListener('levelchange', sync);
      b.addEventListener('chargingchange', sync);
    });
    return () => {
      batt?.removeEventListener('levelchange', sync);
      batt?.removeEventListener('chargingchange', sync);
    };
  }, []);

  return { level, charging };
}

interface MobileStatusBarProps {
  onPullDown?: () => void;
}

const MobileStatusBar: React.FC<MobileStatusBarProps> = ({ onPullDown }) => {
  const now = useClock();
  const { isWifiEnabled } = useSettings();
  const { level, charging } = useBattery();
  const pct = Math.round(level * 100);

  return (
    <div
      className="nex-m-status"
      onClick={onPullDown}
      onTouchStart={(e) => {
        const y = e.touches[0].clientY;
        const el = e.currentTarget;
        const onMove = (ev: TouchEvent) => {
          if (ev.touches[0].clientY - y > 24) {
            onPullDown?.();
            cleanup();
          }
        };
        const cleanup = () => {
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('touchend', cleanup);
        };
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', cleanup);
        void el;
      }}
    >
      <div className="nex-m-status-left">
        <span>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <span className="nex-m-status-brand">NEX</span>
      <div className="nex-m-status-right">
        <span className="nex-m-status-icon" title={isWifiEnabled ? 'Wi-Fi' : 'Sin Wi-Fi'}>
          {isWifiEnabled ? <Wifi124Regular /> : <WifiWarning24Regular />}
        </span>
        <span className="nex-m-status-icon" title="Señal" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="11" width="3" height="4" rx="0.6" opacity="1" />
            <rect x="5.5" y="8" width="3" height="7" rx="0.6" opacity="0.9" />
            <rect x="10" y="4.5" width="3" height="10.5" rx="0.6" opacity="0.55" />
          </svg>
        </span>
        <span className="nex-m-batt" title={charging ? `Cargando ${pct}%` : `${pct}%`}>
          <span className="nex-m-batt-body">
            <span
              className="nex-m-batt-level"
              style={{
                width: `${Math.max(8, pct)}%`,
                background: pct <= 15 ? '#ff5c5c' : charging ? '#4ade80' : 'currentColor',
              }}
            />
          </span>
        </span>
      </div>
    </div>
  );
};

export default MobileStatusBar;
