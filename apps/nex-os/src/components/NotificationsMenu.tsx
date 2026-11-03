import React from 'react';
import { 
  Wifi124Regular, 
  Bluetooth24Regular, 
  Airplane24Regular, 
  WeatherMoon24Regular, 
  WeatherSunny24Regular,
  Settings24Regular,
  Speaker224Regular,
  BrightnessHigh24Regular,
  Battery124Regular,
  Edit24Regular,
} from '@fluentui/react-icons';
import { useSettings } from '../context/SettingsContext';

interface NotificationsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationsMenu: React.FC<NotificationsMenuProps> = ({ isOpen, onClose }) => {
  const { 
    isWifiEnabled, setIsWifiEnabled,
    isBluetoothEnabled, setIsBluetoothEnabled,
    isNightLightEnabled, setIsNightLightEnabled,
    brightness, setBrightness,
    volume, setVolume,
    accentColor,
    theme, toggleTheme
  } = useSettings();

  if (!isOpen) return null;

  return (
    <div 
      className="win11-quick-settings premium-shadow" 
      onClick={(e) => e.stopPropagation()}
    >
      {/* QUICK SETTINGS GRID */}
      <div className="qs-grid">
        <QuickSetting 
          label="Wi-Fi" 
          icon={<Wifi124Regular />} 
          active={isWifiEnabled} 
          onClick={() => setIsWifiEnabled(!isWifiEnabled)} 
          accentColor={accentColor}
        />
        <QuickSetting 
          label="Bluetooth" 
          icon={<Bluetooth24Regular />} 
          active={isBluetoothEnabled} 
          onClick={() => setIsBluetoothEnabled(!isBluetoothEnabled)} 
          accentColor={accentColor}
        />
        <QuickSetting 
          label="Avión" 
          icon={<Airplane24Regular />} 
          active={false} 
          onClick={() => {}} 
          accentColor={accentColor}
        />
        <QuickSetting 
          label="Luz nocturna" 
          icon={<WeatherMoon24Regular />} 
          active={isNightLightEnabled} 
          onClick={() => setIsNightLightEnabled(!isNightLightEnabled)} 
          accentColor={accentColor}
        />
        <QuickSetting 
          label="Ahorro batería" 
          icon={<Battery124Regular />} 
          active={false} 
          onClick={() => {}} 
          accentColor={accentColor}
        />
        <QuickSetting 
          label="Modo oscuro" 
          icon={theme === 'dark' ? <WeatherMoon24Regular /> : <WeatherSunny24Regular />} 
          active={theme === 'dark'} 
          onClick={toggleTheme} 
          accentColor={accentColor}
        />
      </div>

      {/* SLIDERS */}
      <div className="qs-sliders">
        <div className="slider-container">
          <BrightnessHigh24Regular className="slider-icon" />
          <input 
            type="range" 
            min="10" 
            max="100" 
            value={brightness} 
            onChange={(e) => setBrightness(Number(e.target.value))}
            style={{ accentColor }}
          />
        </div>
        <div className="slider-container">
          <Speaker224Regular className="slider-icon" />
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={volume} 
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{ accentColor }}
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="qs-footer">
        <div className="footer-left">
          <span className="battery-info">
            <Battery124Regular style={{ marginRight: '6px' }} />
            100%
          </span>
        </div>
        <div className="footer-right">
          <button className="footer-icon-btn" onClick={() => window.alert('Próximamente')}><Edit24Regular /></button>
          <button className="footer-icon-btn" onClick={() => window.alert('Configuración')}><Settings24Regular /></button>
        </div>
      </div>

      <style>{`
        .win11-quick-settings {
          position: fixed;
          bottom: calc(var(--taskbar-height) + 12px);
          right: 12px;
          width: 360px;
          background: rgba(32, 32, 32, 0.8);
          backdrop-filter: blur(40px) saturate(200%);
          -webkit-backdrop-filter: blur(40px) saturate(200%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 24px;
          z-index: 1500;
          color: white;
          font-family: var(--win-font);
          display: flex;
          flex-direction: column;
          gap: 24px;
          animation: qsSlideIn 0.2s cubic-bezier(0, 0, 0, 1);
        }

        .qs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .qs-btn-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .qs-main-btn {
          width: 100%;
          height: 48px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.05);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .qs-main-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .qs-label {
          font-size: 11px;
          color: #ccc;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }

        .qs-sliders {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .slider-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .slider-icon {
          font-size: 18px;
          color: #ddd;
        }

        .slider-container input {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.2);
          appearance: none;
          outline: none;
        }

        .qs-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .battery-info {
          font-size: 12px;
          display: flex;
          align-items: center;
          color: #eee;
        }

        .footer-right {
          display: flex;
          gap: 12px;
        }

        .footer-icon-btn {
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
        }

        .footer-icon-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        @keyframes qsSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

const QuickSetting = ({ label, icon, active, onClick, accentColor }: any) => (
  <div className="qs-btn-container">
    <button 
      className="qs-main-btn" 
      onClick={onClick}
      style={{ 
        background: active ? accentColor : 'rgba(255, 255, 255, 0.05)',
        borderColor: active ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
        color: active ? 'black' : 'white'
      }}
    >
      {React.cloneElement(icon, { style: { width: 20, height: 20 } })}
    </button>
    <span className="qs-label">{label}</span>
  </div>
);

export default NotificationsMenu;