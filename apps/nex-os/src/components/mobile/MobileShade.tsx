import React from 'react';
import {
  Wifi124Regular,
  Bluetooth24Regular,
  WeatherMoon24Regular,
  WeatherSunny24Regular,
  BrightnessHigh24Regular,
  Speaker224Regular,
  LockClosed24Regular,
  Settings24Regular,
  Power24Regular,
  Sparkle24Regular,
  ChevronRight24Regular,
} from '@fluentui/react-icons';
import { motion } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

interface MobileShadeProps {
  onClose: () => void;
  onLock: () => void;
  onSettings: () => void;
  onPower: () => void;
  onAssistant: () => void;
}

const MobileShade: React.FC<MobileShadeProps> = ({ onClose, onLock, onSettings, onPower, onAssistant }) => {
  const {
    isWifiEnabled, setIsWifiEnabled,
    isBluetoothEnabled, setIsBluetoothEnabled,
    isNightLightEnabled, setIsNightLightEnabled,
    brightness, setBrightness,
    volume, setVolume,
    theme, toggleTheme,
    notifications, removeNotification,
  } = useSettings();

  return (
    <>
      <div className="nex-m-shade-backdrop" onClick={onClose} />
      <motion.div
        className="nex-m-shade"
        initial={{ y: '-100%' }}
        animate={{ y: 0 }}
        exit={{ y: '-100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 380, mass: 0.85 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="nex-m-shade-handle" />

        <button type="button" className="nex-m-assistant-banner" onClick={onAssistant}>
          <Sparkle24Regular />
          <span>Preguntale a Nex Assistant</span>
          <ChevronRight24Regular />
        </button>

        <div className="nex-m-qs">
          <button
            type="button"
            className={`nex-m-qs-btn ${isWifiEnabled ? 'on' : ''}`}
            onClick={() => setIsWifiEnabled(!isWifiEnabled)}
          >
            <Wifi124Regular />
            Wi-Fi
          </button>
          <button
            type="button"
            className={`nex-m-qs-btn ${isBluetoothEnabled ? 'on' : ''}`}
            onClick={() => setIsBluetoothEnabled(!isBluetoothEnabled)}
          >
            <Bluetooth24Regular />
            Bluetooth
          </button>
          <button
            type="button"
            className={`nex-m-qs-btn ${isNightLightEnabled ? 'on' : ''}`}
            onClick={() => setIsNightLightEnabled(!isNightLightEnabled)}
          >
            <WeatherMoon24Regular />
            Noche
          </button>
          <button
            type="button"
            className={`nex-m-qs-btn ${theme === 'dark' ? 'on' : ''}`}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <WeatherMoon24Regular /> : <WeatherSunny24Regular />}
            {theme === 'dark' ? 'Oscuro' : 'Claro'}
          </button>
        </div>

        <div className="nex-m-slider">
          <BrightnessHigh24Regular />
          <input
            type="range"
            min={20}
            max={100}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            aria-label="Brillo"
          />
        </div>
        <div className="nex-m-slider">
          <Speaker224Regular />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volumen"
          />
        </div>

        <div className="nex-m-notifs">
          <h3>Notificaciones</h3>
          {notifications.length === 0 ? (
            <div className="nex-m-notif">
              <p>Sin notificaciones</p>
            </div>
          ) : (
            notifications.slice(0, 6).map((n) => (
              <button
                key={n.id}
                type="button"
                className="nex-m-notif"
                onClick={() => removeNotification(n.id)}
                style={{ textAlign: 'left', width: '100%', color: 'inherit', border: 'none' }}
              >
                <strong>{n.title}</strong>
                <p>{n.message}</p>
              </button>
            ))
          )}
        </div>

        <div className="nex-m-shade-actions">
          <button type="button" onClick={onLock}>
            <LockClosed24Regular /> Bloquear
          </button>
          <button type="button" onClick={onSettings}>
            <Settings24Regular /> Ajustes
          </button>
          <button type="button" className="danger" onClick={onPower}>
            <Power24Regular /> Energía
          </button>
        </div>
      </motion.div>
    </>
  );
};

export default MobileShade;
