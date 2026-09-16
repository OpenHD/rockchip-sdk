import React from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

const NexDesktop: React.FC = () => {
  const { setSystemState } = useSettings();

  return (
    <div className="nex-root h-screen w-screen bg-[#020202] text-[#00ffff] overflow-hidden flex flex-col relative font-mono">
      {/* BACKGROUND EFFECTS */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="grid-bg" />
      </div>

      {/* TOP STATUS BAR */}
      <div className="h-8 border-b border-[#00ffff44] flex items-center px-4 justify-between bg-[#000000aa] backdrop-blur-md z-10 text-[10px] tracking-widest uppercase">
         <div className="flex gap-4">
           <span>NEX OS // NODE: ALPHA-01</span>
           <span className="opacity-40">Uptime: 00:04:12</span>
         </div>
         <div className="flex gap-4 items-center">
            <div className="h-2 w-20 bg-[#00ffff22] rounded-full overflow-hidden">
               <div className="h-full bg-[#00ffff] w-1/2 animate-pulse" />
            </div>
            <span>CPU: 42%</span>
            <span>MEM: 12.4 GB</span>
         </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 relative flex items-center justify-center">
         <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-8"
         >
            <div className="nex-logo text-6xl font-bold tracking-tighter relative">
               NEX OS
               <div className="absolute -inset-1 blur-xl bg-[#00ffff44] -z-10" />
            </div>
            <div className="text-sm opacity-40 uppercase tracking-[0.5em] animate-pulse">
               System Ready / Waiting for Commands
            </div>

            <div className="grid grid-cols-3 gap-6 mt-12">
               {['DASHBOARD', 'CORE', 'SENSORS', 'LOGS', 'SECURITY', 'TERMINAL'].map(btn => (
                 <div key={btn} className="h-24 w-40 border border-[#00ffff44] bg-[#00ffff0a] hover:bg-[#00ffff22] transition-colors flex items-center justify-center text-xs font-bold tracking-widest cursor-pointer group">
                    <span className="group-hover:scale-110 transition-transform">{btn}</span>
                 </div>
               ))}
            </div>
         </motion.div>
      </div>

      {/* BOTTOM TASKBAR (Minimalist) */}
      <div className="h-16 flex items-center px-8 justify-center gap-12 bg-[#000000cc] backdrop-blur-xl border-t border-[#00ffff22] z-10">
         {['\u25C7', '\u25A2', '\u25B3', '\u25CB'].map((icon, i) => (
           <div key={i} className="text-2xl hover:text-white cursor-pointer transition-colors hover:scale-120 active:scale-95">
             {icon}
           </div>
         ))}
      </div>

      {/* GLOBAL SCANLINES */}
      <div className="scanline" />

      <style>{`
        .nex-root {
          font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
        }
        .grid-bg {
          width: 200%;
          height: 200%;
          background-image: 
            linear-gradient(to right, #00ffff22 1px, transparent 1px),
            linear-gradient(to bottom, #00ffff22 1px, transparent 1px);
          background-size: 40px 40px;
          transform: perspective(500px) rotateX(60deg) translateY(-200px);
          animation: move-grid 20s linear infinite;
        }
        @keyframes move-grid {
          0% { transform: perspective(500px) rotateX(60deg) translateY(-200px); }
          100% { transform: perspective(500px) rotateX(60deg) translateY(0); }
        }
        .scanline {
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 255, 0, 0.03));
          background-size: 100% 2px, 3px 100%;
          pointer-events: none;
          z-index: 100;
        }
        .nex-logo {
          text-shadow: 0 0 20px #00ffffaa;
        }
      `}</style>
    </div>
  );
};

export default NexDesktop;
