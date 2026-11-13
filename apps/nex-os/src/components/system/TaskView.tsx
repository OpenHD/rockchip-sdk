import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dismiss20Regular } from '@fluentui/react-icons';
import { useWindowManager } from '../../context/WindowManager';
import { useSettings } from '../../context/SettingsContext';

const TaskView: React.FC = () => {
  const { windows, closeWindow, focusWindow } = useWindowManager();
  const { isTaskViewOpen, setIsTaskViewOpen } = useSettings();

  if (!isTaskViewOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="task-view-overlay mica-strong"
      onClick={() => setIsTaskViewOpen(false)}
    >
      <div className="task-view-container">
        <h2 className="task-view-title">Escritorio actual</h2>
        <div className="task-view-grid">
          {windows.map((win) => (
            <motion.div 
              key={win.id}
              layoutId={`window-${win.id}`}
              className="task-view-item"
              onClick={(e) => {
                e.stopPropagation();
                focusWindow(win.id);
                setIsTaskViewOpen(false);
              }}
              whileHover={{ scale: 1.05, translateY: -5 }}
            >
              <div className="task-view-window-header">
                <div className="header-info">
                  <span className="header-icon">{win.icon}</span>
                  <span className="header-text">{win.title}</span>
                </div>
                <button 
                  className="header-close" 
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWindow(win.id);
                  }}
                >
                  <Dismiss20Regular />
                </button>
              </div>
              <div className="task-view-window-content">
                {/* Previsualización simplificada o miniatura */}
                <div className="content-placeholder">
                   <div className="mini-app-icon">{win.icon}</div>
                </div>
              </div>
            </motion.div>
          ))}
          {windows.length === 0 && (
            <div className="no-windows-msg">No hay ventanas abiertas</div>
          )}
        </div>
      </div>

      <style>{`
        .task-view-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 5000;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(40px) saturate(200%);
          display: flex;
          justify-content: center;
          padding-top: 10vh;
        }

        .task-view-container {
          width: 90%;
          max-width: 1200px;
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .task-view-title {
          color: white;
          font-size: 24px;
          font-weight: 600;
          text-align: center;
        }

        .task-view-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
          padding-bottom: 50px;
        }

        .task-view-item {
          aspect-ratio: 16 / 10;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          transition: border-color 0.2s;
        }

        .task-view-item:hover {
          border-color: var(--win-accent);
          background: rgba(255, 255, 255, 0.15);
        }

        .task-view-window-header {
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0, 0, 0, 0.2);
        }

        .header-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: white;
          font-size: 13px;
        }

        .header-icon {
          display: flex;
          align-items: center;
        }

        .header-close {
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          opacity: 0.7;
          border-radius: 4px;
          padding: 2px;
          display: flex;
        }

        .header-close:hover {
          background: #c42b1c;
          opacity: 1;
        }

        .task-view-window-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.1);
        }

        .content-placeholder {
          opacity: 0.3;
          transform: scale(2);
        }

        .no-windows-msg {
          grid-column: 1 / -1;
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          font-size: 18px;
          margin-top: 50px;
        }
      `}</style>
    </motion.div>
  );
};

export default TaskView;
