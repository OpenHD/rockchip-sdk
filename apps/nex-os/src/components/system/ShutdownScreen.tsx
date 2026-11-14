import React from 'react';

const ShutdownScreen: React.FC = () => {
  return (
    <div className="w-full h-full bg-[#0078D4] flex flex-col items-center justify-center relative font-['Segoe_UI']">
      <div className="flex flex-col items-center gap-6">
        <div className="loader"></div>
        <span className="text-white text-xl font-medium tracking-wide">Apagando el equipo...</span>
      </div>

      <style>{`
        .loader {
          border: 4px solid rgba(255, 255, 255, 0.2);
          border-left-color: #fff;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ShutdownScreen;
