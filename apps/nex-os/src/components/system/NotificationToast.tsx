import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dismiss16Regular } from '@fluentui/react-icons';
import { useSettings, type Notification } from '../../context/SettingsContext';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useSettings();

  return (
    <div className="notification-container">
      <AnimatePresence>
        {notifications.map((notif) => (
          <NotificationToast 
            key={notif.id} 
            notification={notif} 
            onClose={() => removeNotification(notif.id)} 
          />
        ))}
      </AnimatePresence>

      <style>{`
        .notification-container {
          position: fixed;
          bottom: calc(var(--taskbar-height) + 12px);
          right: 12px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

const NotificationToast: React.FC<{ notification: Notification, onClose: () => void }> = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      layout
      initial={{ x: 400, y: -24, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      className="notification-toast mica-strong"
    >
      <div className="notif-header">
        <div className="notif-icon-title">
          <span className="notif-icon">{notification.icon || '🔔'}</span>
          <span className="notif-title">{notification.title}</span>
        </div>
        <button className="notif-close" onClick={onClose}>
          <Dismiss16Regular />
        </button>
      </div>
      <div className="notif-body">
        {notification.message}
      </div>

      <style>{`
        .notification-toast {
          width: 320px;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          color: white;
          pointer-events: auto;
          user-select: none;
        }

        .notif-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .notif-icon-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .notif-icon {
          font-size: 16px;
        }

        .notif-title {
          font-size: 13px;
          font-weight: 600;
          opacity: 0.9;
        }

        .notif-close {
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          opacity: 0.6;
          padding: 4px;
          border-radius: 4px;
          display: flex;
        }

        .notif-close:hover {
          background: rgba(255, 255, 255, 0.1);
          opacity: 1;
        }

        .notif-body {
          font-size: 12px;
          line-height: 1.4;
          opacity: 0.8;
          word-wrap: break-word;
        }
      `}</style>
    </motion.div>
  );
};

export default NotificationContainer;
