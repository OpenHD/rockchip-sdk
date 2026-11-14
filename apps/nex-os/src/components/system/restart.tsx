import React from 'react';

const RestartScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#0078d4] flex flex-col items-center justify-center text-white font-sans">
      <div className="flex flex-col items-center gap-6">
        {/* Spinner animado */}
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        
        <div className="text-center">
          <h1 className="text-2xl font-light mb-2">Reiniciando</h1>
          <p className="text-sm opacity-80">NEX OS está preparando todo para volver...</p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

// IMPORTANTE: El nombre aquí debe coincidir con el que importas en App.tsx
export default RestartScreen;