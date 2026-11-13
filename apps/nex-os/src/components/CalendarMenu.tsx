import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Dismiss16Regular, Delete16Regular } from '@fluentui/react-icons';

interface CalendarMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const CalendarMenu: React.FC<CalendarMenuProps> = ({ isOpen, onClose }) => {
  const { notifications, removeNotification } = useSettings();
  const [date, setDate] = useState(new Date());

  if (!isOpen) return null;

  const handleClearAll = () => {
    notifications.forEach(n => removeNotification(n.id));
  };

  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const calendarDays = [];

  for (let i = 0; i < ((firstDay + 6) % 7); i++) {
    calendarDays.push(<div key={`empty-${i}`} className="calendar-day empty" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday =
      day === new Date().getDate() &&
      date.getMonth() === new Date().getMonth() &&
      date.getFullYear() === new Date().getFullYear();

    calendarDays.push(
      <div key={day} className={`calendar-day ${isToday ? 'today' : ''}`}>
        {day}
      </div>
    );
  }

  const getMonthName = (d: Date) =>
    d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className="notification-center-panel mica premium-shadow" onClick={(e) => e.stopPropagation()}>
      {/* NOTIFICATIONS SECTION */}
      <div className="nc-section">
        <div className="nc-header">
          <span className="nc-title">Notificaciones</span>
          {notifications.length > 0 && (
            <button className="nc-clear-all" onClick={handleClearAll}>
              Borrar todo
            </button>
          )}
        </div>
        <div className="nc-list">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <div key={notif.id} className="nc-item">
                <div className="nc-item-header">
                  <div className="nc-item-info">
                    <span className="nc-item-icon">{notif.icon || '🔔'}</span>
                    <span className="nc-item-app">{notif.title}</span>
                  </div>
                  <button className="nc-item-remove" onClick={() => removeNotification(notif.id)}>
                    <Dismiss16Regular />
                  </button>
                </div>
                <div className="nc-item-body">{notif.message}</div>
              </div>
            ))
          ) : (
            <div className="nc-empty">No hay notificaciones nuevas</div>
          )}
        </div>
      </div>

      {/* CALENDAR SECTION */}
      <div className="nc-calendar-section">
        <div className="calendar-header">
          <button onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))}>&lt;</button>
          <span>{getMonthName(date)}</span>
          <button onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))}>&gt;</button>
          <button className="calendar-close" onClick={onClose}>✕</button>
        </div>
        <div className="calendar-grid">
          {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((day) => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
          {calendarDays}
        </div>
      </div>

      <style>{`
        .notification-center-panel {
          position: fixed;
          bottom: calc(var(--taskbar-height) + 12px);
          right: 12px;
          width: 360px;
          max-height: 80vh;
          border-radius: var(--win-radius);
          z-index: 1500;
          color: white;
          background: rgba(22,22,22,0.85);
          backdrop-filter: blur(40px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.16);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          animation: ncIn 0.2s cubic-bezier(0.1, 0.9, 0.2, 1);
        }

        @keyframes ncIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .nc-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 16px;
          overflow: hidden;
        }

        .nc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .nc-title {
          font-size: 14px;
          font-weight: 600;
          opacity: 0.9;
        }

        .nc-clear-all {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
        }

        .nc-clear-all:hover {
          background: rgba(255,255,255,0.1);
        }

        .nc-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 4px;
        }

        .nc-item {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 10px;
          transition: background 0.2s;
        }

        .nc-item:hover {
          background: rgba(255,255,255,0.1);
        }

        .nc-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .nc-item-info {
           display: flex;
           align-items: center;
           gap: 8px;
           opacity: 0.8;
           font-size: 11px;
        }

        .nc-item-app { font-weight: 500; }

        .nc-item-remove {
           background: transparent;
           border: none;
           color: white;
           opacity: 0.5;
           cursor: pointer;
           padding: 2px;
           border-radius: 4px;
           display: flex;
        }

        .nc-item-remove:hover {
           background: rgba(255,255,255,0.1);
           opacity: 1;
        }

        .nc-item-body {
          font-size: 12px;
          line-height: 1.4;
          opacity: 0.9;
        }

        .nc-empty {
          text-align: center;
          margin-top: 50px;
          font-size: 13px;
          opacity: 0.5;
        }

        .nc-calendar-section {
          background: rgba(0,0,0,0.2);
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 4px;
        }

        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          font-size: 13px;
        }

        .calendar-header button {
          background: transparent;
          border: none;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
        }

        .calendar-header button:hover {
          background: rgba(255,255,255,0.08);
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          padding: 8px 16px 16px 16px;
        }

        .calendar-weekday,
        .calendar-day {
          text-align: center;
          font-size: 11px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .calendar-day { cursor: pointer; }
        .calendar-day:hover { background: rgba(255,255,255,0.08); }

        .calendar-day.today {
          background: var(--win-accent);
          color: black;
          font-weight: 600;
        }

        .calendar-day.empty { visibility: hidden; }
      `}</style>
    </div>
  );
};

export default CalendarMenu;

