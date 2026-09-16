import React from 'react';
import { motion } from 'framer-motion';
import { Settings24Regular, Add24Regular } from '@fluentui/react-icons';
import WeatherWidget from './widgets/WeatherWidget';
import NewsWidget from './widgets/NewsWidget';
import StocksWidget from './widgets/StocksWidget';
import { useSettings } from '../../context/SettingsContext';

interface WidgetsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const WidgetsPanel: React.FC<WidgetsPanelProps> = ({ isOpen, onClose }) => {
  const { userName } = useSettings();
  const date = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ x: -400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -400, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="widgets-panel mica-strong premium-shadow"
      onClick={(e) => e.stopPropagation()}
    >
      {/* HEADER */}
      <div className="widgets-header">
        <div className="widgets-header-left">
          <span className="widgets-date">{date}</span>
          <h2 className="widgets-title">Buenos días, {userName}</h2>
        </div>
        <div className="widgets-header-right">
          <div className="widgets-user-icon">{userName.charAt(0)}</div>
          <button className="widgets-settings-btn"><Settings24Regular /></button>
        </div>
      </div>

      {/* WIDGETS GRID */}
      <div className="widgets-scroll">
        <div className="widget-grid">
          <WeatherWidget />
          <StocksWidget />
          <NewsWidget />
          
          <div className="widget-card photos-static">
            <div className="stocks-header">
              <Add24Regular />
              <strong>Tus fotos</strong>
            </div>
            <div className="widget-photo-placeholder" />
          </div>
        </div>

        <button className="add-widgets-btn">
          <Add24Regular />
          <span>Añadir widgets</span>
        </button>
      </div>

      <style>{`
        .widgets-panel {
          position: fixed;
          top: 0;
          left: 0;
          width: 440px;
          height: 100vh;
          background: rgba(24, 24, 24, 0.4);
          backdrop-filter: blur(60px) saturate(210%);
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          padding: 48px 24px;
          z-index: 1500;
          color: white;
          display: flex;
          flex-direction: column;
          gap: 24px;
          box-shadow: 20px 0 60px rgba(0,0,0,0.4);
        }

        .widgets-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .widgets-date { font-size: 11px; opacity: 0.6; text-transform: capitalize; }
        .widgets-title { margin: 4px 0 0 0; font-size: 20px; font-weight: 600; }
        .widgets-header-right { display: flex; align-items: center; gap: 12px; }
        .widgets-settings-btn { background: transparent; border: none; color: white; cursor: pointer; padding: 4px; opacity: 0.8; }
        .widgets-settings-btn:hover { opacity: 1; }

        .widgets-scroll { flex: 1; overflow-y: auto; padding-right: 8px; }
        .widgets-scroll::-webkit-scrollbar { width: 4px; }
        .widgets-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        .widget-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .widget-card {
          background: rgba(45, 45, 45, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 16px;
          transition: transform 0.2s, background 0.2s;
        }
        .widget-card:hover { transform: translateY(-2px); background: rgba(55, 55, 55, 0.7); }

        .photos-static .widget-photo-placeholder {
          height: 120px;
          background: linear-gradient(45deg, #333, #555);
          border-radius: 8px;
          margin-top: 12px;
        }

        .add-widgets-btn {
          margin-top: 24px;
          width: 100%;
          padding: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          font-size: 13px;
        }
        .add-widgets-btn:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </motion.div>
  );
};

export default WidgetsPanel;
