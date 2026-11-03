import React from 'react';

const WindowsBoot: React.FC = () => {
  return (
    <div className="w-full h-full bg-[#020202] flex flex-col items-center justify-center relative font-mono text-white">
      {/* FUTURISTIC NEX OS LOGO */}
      <div className="flex flex-col items-center gap-2 select-none">
        <div className="nex-logo text-5xl font-extrabold tracking-widest relative uppercase">
          NEX OS
          <div className="absolute -inset-2 blur-xl bg-[#00ffff22] -z-10 animate-pulse" />
        </div>
        <div className="text-[10px] text-[#00ffff] tracking-[0.4em] uppercase opacity-60 mt-1 animate-pulse">
          Loading Core Systems
        </div>
      </div>
      
      {/* COLOR CHANGING SPINNING LOADER */}
      <div className="absolute bottom-32 flex items-center justify-center">
        <div className="loader"></div>
      </div>

      <style>{`
        .nex-logo {
          font-family: 'JetBrains Mono', 'Segoe UI', monospace;
          color: #ffffff;
          text-shadow: 0 0 15px rgba(0, 255, 255, 0.6), 0 0 30px rgba(0, 255, 255, 0.3);
          letter-spacing: 0.15em;
        }
        .loader {
          border: 3px solid rgba(255, 255, 255, 0.05);
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite, colorShift 4s linear infinite;
          box-shadow: 0 0 15px rgba(0, 255, 255, 0.1);
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes colorShift {
          0%, 100% {
            border-left-color: #00ffff;
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.4);
          }
          20% {
            border-left-color: #3b82f6;
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
          }
          40% {
            border-left-color: #8b5cf6;
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
          }
          60% {
            border-left-color: #ec4899;
            box-shadow: 0 0 15px rgba(236, 72, 153, 0.4);
          }
          80% {
            border-left-color: #10b981;
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
          }
        }
      `}</style>
    </div>
  );
};

export default WindowsBoot;
