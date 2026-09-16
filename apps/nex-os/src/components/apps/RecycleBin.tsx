import React from 'react';
import { Delete28Regular, ArrowCounterclockwise24Regular, Dismiss24Regular } from '@fluentui/react-icons';

const RecycleBin: React.FC = () => {
  return (
    <div className="rb-container">
      <div className="rb-toolbar">
        <button className="rb-btn"><ArrowCounterclockwise24Regular /> Restablecer todo</button>
        <button className="rb-btn"><Dismiss24Regular /> Vaciar papelera</button>
      </div>
      
      <div className="rb-content">
        <div className="rb-empty">
          <Delete28Regular className="rb-empty-icon" />
          <p>La papelera está vacía</p>
        </div>
      </div>

      <style>{`
        .rb-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #191919;
          color: white;
        }
        .rb-toolbar {
          display: flex;
          padding: 8px;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .rb-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: white;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
        }
        .rb-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .rb-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rb-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          opacity: 0.5;
        }
        .rb-empty-icon {
          font-size: 48px;
        }
      `}</style>
    </div>
  );
};

export default RecycleBin;
