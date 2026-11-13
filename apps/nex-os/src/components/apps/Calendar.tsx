import React, { useState } from 'react';
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Add24Regular,
  Delete24Regular,
} from '@fluentui/react-icons';

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  time: string;
  color: string;
}

const Calendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1));
  const [events, setEvents] = useState<CalendarEvent[]>([
    { id: '1', date: '2026-04-05', title: 'Reunión de trabajo', time: '10:00', color: 'bg-blue-100' },
    { id: '2', date: '2026-04-12', title: 'Almuerzo con amigos', time: '13:00', color: 'bg-green-100' },
    { id: '3', date: '2026-04-15', title: 'Cumpleaños', time: 'All day', color: 'bg-red-100' },
  ]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleAddEvent = () => {
    if (newEvent && selectedDate) {
      const event: CalendarEvent = {
        id: Date.now().toString(),
        date: selectedDate,
        title: newEvent,
        time: '12:00',
        color: 'bg-yellow-100',
      };
      setEvents([...events, event]);
      setNewEvent('');
      setShowAddForm(false);
    }
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
  };

  const monthName = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  const dateString = (day: number) =>
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const getEventsForDate = (day: number) => events.filter((e) => e.date === dateString(day));

  return (
    <div className="flex h-full bg-white">
      {/* Calendar */}
      <div className="flex-1 flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-200 rounded"
          >
            <ChevronLeft24Regular />
          </button>
          <h2 className="text-2xl font-bold capitalize">{monthName}</h2>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-200 rounded"
          >
            <ChevronRight24Regular />
          </button>
        </div>

        {/* Weekdays */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
            <div key={day} className="text-center font-bold text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-2 flex-1">
          {emptyDays.map((i) => (
            <div key={`empty-${i}`} className="bg-gray-50 rounded" />
          ))}
          {days.map((day) => {
            const dateStr = dateString(day);
            const dayEvents = getEventsForDate(day);
            const isSelected = selectedDate === dateStr;

            return (
              <div
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={`min-h-20 p-2 rounded border border-gray-200 cursor-pointer transition hover:bg-blue-50 ${
                  isSelected ? 'bg-blue-200 border-blue-500' : 'bg-white'
                }`}
              >
                <p className="font-bold text-sm mb-1">{day}</p>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className={`text-xs p-1 rounded truncate ${event.color} cursor-pointer hover:opacity-80`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id);
                      }}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-600">+{dayEvents.length - 2}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar - Events */}
      <div className="w-72 bg-gray-50 border-l border-gray-300 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-300">
          <h3 className="font-bold text-lg">Eventos</h3>
        </div>

        {/* Event List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {selectedDate && getEventsForDate(parseInt(selectedDate.split('-')[2])).map((event) => (
            <div
              key={event.id}
              className={`p-3 rounded border-l-4 ${event.color} flex justify-between items-start group`}
            >
              <div>
                <p className="font-medium text-sm">{event.title}</p>
                <p className="text-xs text-gray-600">{event.time}</p>
              </div>
              <button
                onClick={() => handleDeleteEvent(event.id)}
                className="opacity-0 group-hover:opacity-100 transition text-red-600 p-1"
              >
                <Delete24Regular />
              </button>
            </div>
          ))}
          {selectedDate && getEventsForDate(parseInt(selectedDate.split('-')[2])).length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Sin eventos</p>
          )}
        </div>

        {/* Add Event */}
        <div className="border-t border-gray-300 p-4 space-y-2">
          {showAddForm ? (
            <>
              <input
                type="text"
                value={newEvent}
                onChange={(e) => setNewEvent(e.target.value)}
                placeholder="Nuevo evento..."
                className="w-full p-2 border border-gray-300 rounded text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddEvent}
                  className="flex-1 px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  Agregar
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              disabled={!selectedDate}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Add24Regular /> Nuevo evento
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;
