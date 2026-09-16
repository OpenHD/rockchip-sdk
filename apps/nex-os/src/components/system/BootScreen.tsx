import React, { useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';

const BootScreen: React.FC = () => {
  const { setSystemState } = useSettings();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        setSystemState('UEFI');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSystemState]);

  return (
    <div className="w-full h-full bg-black flex flex-col items-center justify-center relative font-mono text-white">
      <div className="flex flex-col items-center gap-2 mb-12 animate-in fade-in zoom-in duration-1000">
        <div className="w-24 h-30 border-4 border-white flex items-center justify-center text-4xl font-black italic shadow-[0_0_30px_rgba(255,255,255,0.2)]">
          NEX OS
        </div>
        <div className="text-xs tracking-[0.4em] font-bold opacity-80"></div>
      </div>
      
      <div className="absolute bottom-12 flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
           <div className="w-2 h-2 rounded-full bg-white animate-ping" />
           <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/60">
             Presione <span className="text-white border border-white/40 px-1.5 py-0.5 rounded ml-1 mr-1">[F]</span> para entrar a la BIOS
           </p>
        </div>
        <div className="flex gap-10 text-[8px] uppercase font-bold tracking-widest opacity-30">
          <span>Desarrollado por NEX Team</span>
        </div>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .animate-in {
          animation: animate-in 0.5s ease-out;
        }
        @keyframes animate-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default BootScreen;

