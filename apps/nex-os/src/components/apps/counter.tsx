import React, { useState, useEffect } from 'react';

import { Games24Regular } from '@fluentui/react-icons';

export const CounterIcon = () => <Games24Regular primaryFill="#ef6c00" />;

const CounterStrikeApp: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('Connecting to Master Server...');
  const gameUrl = 'https://play-cs.com/es/servers';

  // Efecto de carga nostálgico
  useEffect(() => {
    const sequence = [
      { t: 'Loading resources...', d: 800 },
      { t: 'Verifying game files...', d: 1500 },
      { t: 'Establishing connection...', d: 2200 },
      { t: 'Ready!', d: 2800 }
    ];

    sequence.forEach(step => {
      setTimeout(() => setStatusText(step.t), step.d);
    });

    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="cs-container">
      {loading ? (
        <div className="cs-loader">
          <div className="cs-splash-content">
            <h1 className="cs-logo">COUNTER<span className="orange">-</span>STRIKE</h1>
            <div className="cs-progress-container">
              <div className="cs-progress-bar"></div>
            </div>
            <p className="cs-status">{statusText}</p>
          </div>
        </div>
      ) : (
        <div className="cs-game-wrapper">
          <div className="cs-header">
            <span className="cs-title">Counter-Strike 1.6 Online </span>
          </div>
          <iframe
            src={gameUrl}
            className="cs-iframe"
            title="CS Online"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      )}

      <style>{`
        .cs-container {
          height: 100%;
          background: #000;
          color: #fff;
          font-family: 'Tahoma', sans-serif;
          overflow: hidden;
        }
        .cs-loader {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), 
                      url('https://wallpaperaccess.com/full/1512411.jpg'); /* Fondo clásico */
          background-size: cover;
          background-position: center;
        }
        .cs-splash-content { text-align: center; width: 80%; }
        .cs-logo { 
          font-style: italic; 
          font-weight: 900; 
          letter-spacing: 2px;
          margin-bottom: 20px;
          text-shadow: 2px 2px #000;
        }
        .orange { color: #ef6c00; }
        .cs-progress-container {
          width: 100%;
          height: 12px;
          background: #333;
          border: 1px solid #555;
          padding: 2px;
        }
        .cs-progress-bar {
          height: 100%;
          background: #ef6c00;
          width: 0%;
          animation: loadGame 2.8s forwards linear;
        }
        .cs-status { font-size: 12px; margin-top: 10px; color: #ccc; }
        
        @keyframes loadGame {
          0% { width: 0%; }
          30% { width: 40%; }
          70% { width: 65%; }
          100% { width: 100%; }
        }

        .cs-game-wrapper { height: 100%; display: flex; flex-direction: column; }
        .cs-header { 
          background: #222; 
          padding: 4px 10px; 
          border-bottom: 2px solid #ef6c00;
          font-size: 11px;
          color: #ef6c00;
          font-weight: bold;
        }
        .cs-iframe { flex: 1; border: none; width: 100%; height: 100%; background: #000; }
      `}</style>
    </div>
  );
};

export default CounterStrikeApp;