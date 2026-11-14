import React from 'react';
import { Power28Regular } from '@fluentui/react-icons';

interface OffScreenProps {
  onPowerOn: () => void;
}

const OffScreen: React.FC<OffScreenProps> = ({ onPowerOn }) => {
  return (
    <div className="w-full h-full bg-black flex items-center justify-center cursor-pointer" onClick={onPowerOn}>
      <div className="flex flex-col items-center opacity-30 hover:opacity-100 transition-opacity">
        <Power28Regular color="white" />
        <span className="text-white mt-2 font-semibold text-sm tracking-widest uppercase">Power On</span>
      </div>
    </div>
  );
};

export default OffScreen;
