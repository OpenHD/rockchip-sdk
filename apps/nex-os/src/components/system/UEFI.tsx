import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings24Regular,
  Desktop24Regular,
  Info24Regular,
  ShieldLock24Regular,
  ChevronRight24Regular,
  ChevronLeft24Regular,
  Save24Regular,
  ArrowCounterclockwise24Regular,
  History24Regular,
  Storage24Regular,
  ShieldCheckmark24Regular,
  PlugConnected24Regular,
  Rocket24Regular,
  Games24Regular,
  Flash24Regular,
  Color24Regular,
  Speaker224Regular,
  Warning24Regular,
  CheckmarkCircle24Regular
} from '@fluentui/react-icons';
import { useSettings } from '../../context/SettingsContext';

interface UEFIScreenProps {
  onBootWindows: () => void;
  onBootNexOS: () => void;
  setOsType: (os: 'windows' | 'nexos') => void;
}

type UEFITab = 'ezmode' | 'main' | 'advanced' | 'ai' | 'monitor' | 'boot' | 'security' | 'tools' | 'exit';

const UEFI: React.FC<UEFIScreenProps> = ({ onBootWindows, onBootNexOS, setOsType }) => {
  const { playSound } = useSettings();
  const [isPostComplete, setIsPostComplete] = useState(false);
  const [activeTab, setActiveTab] = useState<UEFITab>('ezmode');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [postLines, setPostLines] = useState<string[]>([]);
  const [showCursor, setShowCursor] = useState(true);
  const [profile, setProfile] = useState<'silent' | 'balanced' | 'performance' | 'extreme'>('balanced');
  const [rgbMode, setRgbMode] = useState<'breathing' | 'static' | 'rainbow' | 'off'>('breathing');

  // Stats simulados con jitter
  const [stats, setStats] = useState({
    cpuTemp: 38,
    cpuVoltage: 1.224,
    cpuFan: 1200,
    gpuTemp: 42,
    gpuFan: 1100,
    ramUsage: 12,
    cpuUsage: 8
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        cpuTemp: prev.cpuTemp + (Math.random() - 0.5) * 0.8,
        cpuVoltage: prev.cpuVoltage + (Math.random() - 0.5) * 0.008,
        cpuFan: Math.max(800, Math.min(2000, prev.cpuFan + Math.floor((Math.random() - 0.5) * 50))),
        gpuTemp: prev.gpuTemp + (Math.random() - 0.5) * 0.6,
        gpuFan: Math.max(800, Math.min(2000, prev.gpuFan + Math.floor((Math.random() - 0.5) * 40))),
        ramUsage: Math.max(8, Math.min(20, prev.ramUsage + Math.floor((Math.random() - 0.5) * 3))),
        cpuUsage: Math.max(5, Math.min(15, prev.cpuUsage + Math.floor((Math.random() - 0.5) * 4)))
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Secuencia de POST más realista
  useEffect(() => {
    const lines = [
      "NEX GEN UEFI BIOS v4.0.2 - RELEASE 2026",
      "Copyright (C) 2026 NEXA Systems Inc.",
      "",
      "████████████████████████████████████████████████████████████████████████████████████████",
      "",
      "Initializing System Components...",
      "",
      "[CPU]  Intel(R) Core(TM) i9-14900K @ 5.8GHz .......................... OK",
      "[CPU]  24 Cores / 32 Threads Detected",
      "[MEM]  65536 MB DDR5 7200MHz Dual-Channel (CL34) ..................... OK",
      "[MEM]  Training Complete - Latency: 72ns",
      "[STRG] NEX-NVMe Gen5 x4 Controller .................................. OK",
      "[STRG] Samsung 990 Pro 2TB (NVMe 2.0) ................................ OK",
      "[STRG] Seagate Barracuda 8TB (SATA 6Gbps) ........................... OK",
      "[USB]  XHCI 3.2 Controller Initializing ............................. OK",
      "[GPU]  NVIDIA GeForce RTX 5090 (24GB GDDR7X) ........................ OK",
      "[NET]  Killer 10GbE LAN + Wi-Fi 7 (6 GHz/2x2) ....................... OK",
      "[TPM]  Module Present and Activated (2.0) ........................... OK",
      "[SB]   Secure Boot: Verified, Keys Enrolled ......................... OK",
      "",
      "████████████████████████████████████████████████████████████████████████████████████████",
      "",
      "Press DEL to enter BIOS Setup",
      "",
      "Entering UEFI Configuration Utility...",
    ];

    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < lines.length) {
        setPostLines(prev => [...prev, lines[currentLine]]);
        if (lines[currentLine].includes('OK')) playSound('beep');
        currentLine++;
      } else {
        clearInterval(interval);
        setTimeout(() => setIsPostComplete(true), 1000);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [playSound]);

  // Manejo de teclado mejorado
  useEffect(() => {
    if (!isPostComplete) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tabs: UEFITab[] = ['ezmode', 'main', 'advanced', 'ai', 'monitor', 'boot', 'security', 'tools', 'exit'];
      
      if (e.key === 'ArrowRight') {
        const nextIdx = (tabs.indexOf(activeTab) + 1) % tabs.length;
        setActiveTab(tabs[nextIdx]);
        setSelectedIdx(0);
      }
      if (e.key === 'ArrowLeft') {
        const prevIdx = (tabs.indexOf(activeTab) - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIdx]);
        setSelectedIdx(0);
      }
      
      const currentOptionsCount = getOptionsForTab(activeTab).length;
      if (e.key === 'ArrowDown') setSelectedIdx(prev => (prev + 1) % currentOptionsCount);
      if (e.key === 'ArrowUp') setSelectedIdx(prev => (prev - 1 + currentOptionsCount) % currentOptionsCount);
      
      if (e.key === 'Enter') {
        handleSelection(activeTab, selectedIdx);
      }

      if (e.key === 'F10') handleSelection('exit', 0);
      if (e.key === 'Escape') setActiveTab('exit');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, selectedIdx, isPostComplete]);

  const getOptionsForTab = (tab: UEFITab) => {
    switch (tab) {
      case 'ezmode': return [
        { label: 'Performance Profile', value: profile.toUpperCase(), icon: <Rocket24Regular /> },
        { label: 'Fan Curve Mode', value: 'Balanced', icon: <Speaker224Regular /> },
        { label: 'RGB Lighting', value: rgbMode.toUpperCase(), icon: <Color24Regular /> },
        { label: 'System Time', value: new Date().toLocaleTimeString(), icon: <Info24Regular /> },
        { label: 'Boot Priority', value: 'Windows', icon: <Desktop24Regular /> },
      ];
      case 'main': return [
        { label: 'System Date', value: new Date().toLocaleDateString(), icon: <Info24Regular /> },
        { label: 'System Time', value: new Date().toLocaleTimeString(), icon: <Info24Regular /> },
        { label: 'BIOS Version', value: '4.0.2 Build 0424', icon: <History24Regular /> },
        { label: 'Processor Type', value: 'i9-14900K', icon: <Settings24Regular /> },
        { label: 'Memory Frequency', value: '7200MHz', icon: <Storage24Regular /> },
        { label: 'Memory Size', value: '65536 MB', icon: <Storage24Regular /> },
      ];
      case 'advanced': return [
        { label: 'CPU Configuration', value: '>', icon: <Settings24Regular /> },
        { label: 'Memory Settings', value: 'XMP 3.0', icon: <Flash24Regular /> },
        { label: 'Storage Configuration', value: 'AHCI', icon: <Storage24Regular /> },
        { label: 'USB Configuration', value: 'XHCI Enabled', icon: <PlugConnected24Regular /> },
        { label: 'PCIe Settings', value: 'Gen5', icon: <Games24Regular /> },
        { label: 'Hyper-Threading', value: 'Enabled', icon: <Settings24Regular /> },
        { label: 'Intel Speed Shift', value: 'Enabled', icon: <Flash24Regular /> },
      ];
      case 'ai': return [
        { label: 'AI Overclocking', value: 'Enabled', icon: <Rocket24Regular /> },
        { label: 'AI Cooling', value: 'Auto', icon: <Speaker224Regular /> },
        { label: 'AI Noise Cancel', value: 'Enabled', icon: <CheckmarkCircle24Regular /> },
        { label: 'Game Boost', value: 'Disabled', icon: <Games24Regular /> },
      ];
      case 'monitor': return [
        { label: 'CPU Temperature', value: `${stats.cpuTemp.toFixed(1)}°C`, icon: <Warning24Regular /> },
        { label: 'CPU Voltage', value: `${stats.cpuVoltage.toFixed(3)} V`, icon: <Info24Regular /> },
        { label: 'CPU Fan Speed', value: `${stats.cpuFan} RPM`, icon: <Speaker224Regular /> },
        { label: 'GPU Temperature', value: `${stats.gpuTemp.toFixed(1)}°C`, icon: <Warning24Regular /> },
        { label: 'GPU Fan Speed', value: `${stats.gpuFan} RPM`, icon: <Speaker224Regular /> },
      ];
      case 'security': return [
        { label: 'Secure Boot', value: 'Enabled', icon: <ShieldCheckmark24Regular /> },
        { label: 'TPM Device', value: 'Firmware TPM', icon: <ShieldLock24Regular /> },
        { label: 'Admin Password', value: 'Not Set', icon: <ShieldLock24Regular /> },
        { label: 'User Password', value: 'Not Set', icon: <ShieldLock24Regular /> },
      ];
      case 'boot': return [
        { id: 'windows', label: 'Windows Boot Manager', value: 'Boot Priority 1', icon: <Desktop24Regular /> },
        { id: 'nexos', label: 'NEX OS 2.0 (Stable)', value: 'Boot Priority 2', icon: <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-500" /> },
        { label: 'Fast Boot', value: 'Enabled', icon: <Flash24Regular /> },
        { label: 'CSM Support', value: 'Disabled', icon: <Settings24Regular /> },
        { label: 'Boot Logo', value: 'Full Screen', icon: <Info24Regular /> },
      ];
      case 'tools': return [
        { label: 'BIOS Flashback', value: '>', icon: <ArrowCounterclockwise24Regular /> },
        { label: 'System Info', value: '>', icon: <Info24Regular /> },
        { label: 'Clear CMOS', value: '>', icon: <History24Regular /> },
      ];
      case 'exit': return [
        { label: 'Save Changes & Reset', value: 'F10', icon: <Save24Regular /> },
        { label: 'Discard Changes & Exit', value: 'Esc', icon: <ArrowCounterclockwise24Regular /> },
        { label: 'Load Optimized Defaults', value: '', icon: <History24Regular /> },
      ];
      default: return [];
    }
  };

  const handleSelection = (tab: UEFITab, idx: number) => {
    const options = getOptionsForTab(tab);
    const option = options[idx];
    
    if (tab === 'ezmode' && idx === 0) {
      setProfile(prev => prev === 'silent' ? 'balanced' : prev === 'balanced' ? 'performance' : prev === 'performance' ? 'extreme' : 'silent');
    }
    if (tab === 'ezmode' && idx === 2) {
      setRgbMode(prev => prev === 'off' ? 'breathing' : prev === 'breathing' ? 'static' : prev === 'static' ? 'rainbow' : 'off');
    }
    
    if (tab === 'boot') {
      if (option.id === 'windows') {
        setOsType('windows');
        onBootWindows();
      } else if (option.id === 'nexos') {
        setOsType('nexos');
        onBootNexOS();
      }
    }

    if (tab === 'exit') {
      if (idx === 0) {
        setOsType('windows');
        onBootWindows();
      } else if (idx === 1) {
        setOsType('windows');
        onBootWindows();
      }
    }
  };

  if (!isPostComplete) {
    return (
      <div className="post-screen bg-black text-green-400 font-mono h-screen w-screen p-8 overflow-hidden flex flex-col gap-0.5 relative select-none">
        {postLines.map((line, i) => (
          <div key={i} className="text-sm leading-6">{line}</div>
        ))}
        <motion.div
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.7 }}
          className="w-2 h-6 bg-green-400 inline-block ml-1"
        />
        <style>{`
          .post-screen {
            background: linear-gradient(to bottom, #050505 0%, #0a0a0a 100%);
          }
          .post-screen::before {
            content: " ";
            display: block;
            position: absolute;
            top: 0; left: 0; bottom: 0; right: 0;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.008), rgba(0, 0, 255, 0.02));
            z-index: 2;
            background-size: 100% 2px, 3px 100%;
            pointer-events: none;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="uefi-root bg-gradient-to-br from-slate-900 via-slate-950 to-black text-gray-200 font-sans h-screen w-screen flex flex-col select-none relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(56,189,248,0.08)_0%,transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.08)_0%,transparent_50%)]"></div>
      
      {/* HEADER */}
      <header className="relative z-10 flex justify-between items-center bg-gradient-to-r from-slate-800/90 via-slate-900/95 to-slate-800/90 border-b border-slate-700 px-8 py-5 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl shadow-[0_0_30px_rgba(96,165,250,0.4)] flex items-center justify-center font-extrabold text-4xl italic tracking-tighter text-white border border-blue-500/30">N</div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tighter bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">NEX GEN UEFI BIOS</h1>
            <p className="text-[11px] text-slate-400 mt-1 flex gap-5 flex-wrap">
              <span className="font-mono">BUILD DATE: <span className="text-blue-300">04/24/2026</span></span>
              <span className="font-mono">CHIPSET: <span className="text-purple-300">Z790-NEXA</span></span>
              <span className="font-mono">SERIAL: <span className="text-cyan-300">NX-2026-X87</span></span>
              <span className="font-mono">ME FW: <span className="text-green-300">16.1.30.2307</span></span>
            </p>
          </div>
        </div>
        
        {/* Status Panel */}
        <div className="bg-slate-900/90 border border-slate-700/70 rounded-xl p-4 grid grid-cols-3 gap-x-6 gap-y-2 shadow-xl">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${stats.cpuTemp < 60 ? 'bg-green-500' : stats.cpuTemp < 80 ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`}></div>
            <span className="text-[10px] text-slate-400 uppercase font-bold">CPU TEMP:</span> 
            <span className={`font-bold font-mono text-sm ${stats.cpuTemp < 60 ? 'text-green-400' : stats.cpuTemp < 80 ? 'text-yellow-400' : 'text-red-400'}`}>{stats.cpuTemp.toFixed(1)}°C</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-[10px] text-slate-400 uppercase font-bold">VCORE:</span> 
            <span className="font-bold font-mono text-sm text-blue-400">{stats.cpuVoltage.toFixed(3)} V</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
            <span className="text-[10px] text-slate-400 uppercase font-bold">FAN 1:</span> 
            <span className="font-bold font-mono text-sm text-cyan-400">{stats.cpuFan} RPM</span>
          </div>
        </div>
      </header>

      {/* TABS NAVIGATION */}
      <nav className="relative z-10 bg-slate-950/80 border-b border-slate-800 px-6 py-4 flex items-center gap-2 backdrop-blur-sm">
        {(['EASY MODE', 'MAIN', 'ADVANCED', 'AI TWEAKER', 'MONITOR', 'BOOT', 'SECURITY', 'TOOLS', 'EXIT'] as const).map((tab, i) => {
          const tabKey: UEFITab = tab.toLowerCase().replace(' ', '').replace(' ', '') as UEFITab;
          const normalizedTab: UEFITab = tab === 'EASY MODE' ? 'ezmode' : tab === 'AI TWEAKER' ? 'ai' : tabKey;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(normalizedTab);
                setSelectedIdx(0);
              }}
              className={`px-6 py-3 rounded-lg transition-all duration-300 uppercase text-xs font-black tracking-widest ${
                activeTab === normalizedTab 
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-[0_0_30px_rgba(79,70,229,0.5)]' 
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent hover:border-slate-700'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </nav>

      {/* MAIN CONTENT */}
      <main className="relative z-10 flex flex-1 gap-8 p-8 overflow-hidden">
        {/* LEFT: OPTIONS LIST */}
        <section className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          {activeTab === 'ezmode' ? (
            /* EASY MODE (EZ) - Dashboard style */
            <div className="grid grid-cols-2 gap-6 w-full">
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
                <h3 className="text-blue-400 font-bold text-lg mb-6 flex items-center gap-2">
                  <Rocket24Regular /> PERFORMANCE PROFILES
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {(['silent', 'balanced', 'performance', 'extreme'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setProfile(p)}
                      className={`p-5 rounded-xl border-2 transition-all duration-300 ${profile === p ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}
                    >
                      <span className={`block text-center font-bold text-lg mb-2 ${profile === p ? 'text-blue-400' : 'text-slate-400'}`}>{p.toUpperCase()}</span>
                      <span className="text-[11px] text-slate-500 block text-center">
                        {p === 'silent' ? 'Low Noise' : p === 'balanced' ? 'Balanced' : p === 'performance' ? 'Max Speed' : 'Extreme OC'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-900/40 to-slate-900/90 border border-purple-700/50 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
                <h3 className="text-purple-400 font-bold text-lg mb-6 flex items-center gap-2">
                  <Color24Regular /> RGB CONTROL
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {(['breathing', 'static', 'rainbow', 'off'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setRgbMode(m)}
                      className={`p-5 rounded-xl border-2 transition-all duration-300 ${rgbMode === m ? 'border-purple-500 bg-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}
                    >
                      <span className={`block text-center font-bold text-lg mb-2 ${rgbMode === m ? 'text-purple-400' : 'text-slate-400'}`}>{m.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2 bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
                <h3 className="text-cyan-400 font-bold text-lg mb-6 flex items-center gap-2">
                  <Info24Regular /> SYSTEM OVERVIEW
                </h3>
                <div className="grid grid-cols-4 gap-6">
                  <div className="bg-slate-900/70 p-5 rounded-xl border border-slate-700/50">
                    <div className="text-slate-400 text-[11px] uppercase font-bold mb-1">PROCESSOR</div>
                    <div className="text-white font-bold text-sm">Intel i9-14900K</div>
                    <div className="text-green-400 font-mono text-xs mt-2">5.8 GHz Turbo</div>
                  </div>
                  <div className="bg-slate-900/70 p-5 rounded-xl border border-slate-700/50">
                    <div className="text-slate-400 text-[11px] uppercase font-bold mb-1">MEMORY</div>
                    <div className="text-white font-bold text-sm">64 GB DDR5</div>
                    <div className="text-yellow-400 font-mono text-xs mt-2">7200 MHz CL34</div>
                  </div>
                  <div className="bg-slate-900/70 p-5 rounded-xl border border-slate-700/50">
                    <div className="text-slate-400 text-[11px] uppercase font-bold mb-1">GPU</div>
                    <div className="text-white font-bold text-sm">RTX 5090</div>
                    <div className="text-purple-400 font-mono text-xs mt-2">24 GB GDDR7X</div>
                  </div>
                  <div className="bg-slate-900/70 p-5 rounded-xl border border-slate-700/50">
                    <div className="text-slate-400 text-[11px] uppercase font-bold mb-1">STORAGE</div>
                    <div className="text-white font-bold text-sm">Samsung 990 Pro</div>
                    <div className="text-blue-400 font-mono text-xs mt-2">2 TB NVMe Gen5</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* OTHER TABS - LIST STYLE */
            <div className="bg-slate-900/85 border border-slate-700/70 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700 flex items-center gap-3">
                <Settings24Regular className="text-blue-400" />
                <span className="text-blue-400 text-xs font-black uppercase tracking-widest">Options - {activeTab.toUpperCase()}</span>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {getOptionsForTab(activeTab).map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelection(activeTab, i)}
                    onMouseEnter={() => setSelectedIdx(i)}
                    className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 ${
                      selectedIdx === i
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                        : 'hover:bg-slate-800/60 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={selectedIdx === i ? 'text-white' : 'text-blue-500'}>{opt.icon}</span>
                      <span className="font-medium text-sm">{opt.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono font-bold ${selectedIdx === i ? 'text-blue-100' : 'text-gray-400'}`}>{opt.value}</span>
                      {opt.value === '>' && <ChevronRight24Regular fontSize={14} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT: INFO SIDEBAR */}
        <aside className="w-96 flex flex-col gap-6">
          {/* Description Panel */}
          <div className="bg-slate-900/85 border border-slate-700/70 rounded-2xl p-6 backdrop-blur-xl shadow-2xl flex-1">
            <h3 className="text-blue-400 text-xs font-black uppercase mb-4 border-b border-blue-900/50 pb-3">Item Description</h3>
            <p className="text-[11px] leading-7 text-gray-400 italic">
              {activeTab === 'ezmode' && "Quick settings for performance, RGB, and system status monitoring. Designed for users who want easy configuration without advanced knowledge."}
              {activeTab === 'main' && "Displays basic system information like date/time, BIOS version, and hardware detection summary."}
              {activeTab === 'advanced' && "Advanced hardware configuration including CPU, memory, PCIe, and storage settings. WARNING: Changing these can affect system stability."}
              {activeTab === 'ai' && "AI-powered optimizations for overclocking, cooling, and power management for better gaming and productivity."}
              {activeTab === 'monitor' && "Real-time monitoring of temperature, voltage, and fan speeds for system health."}
              {activeTab === 'boot' && "Configure boot priority, boot mode, and Fast Boot settings."}
              {activeTab === 'security' && "Secure Boot, TPM, and password protection for enhanced system security."}
              {activeTab === 'tools' && "Utility tools like BIOS flashback, CMOS reset, and system information."}
              {activeTab === 'exit' && "Save changes, discard, or reset to factory defaults before exiting."}
            </p>
          </div>

          {/* Help Panel */}
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/85 border border-slate-700/70 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
            <h3 className="text-cyan-400 text-xs font-black uppercase mb-4 border-b border-cyan-900/30 pb-3">Quick Access Keys</h3>
            <div className="grid grid-cols-2 gap-y-3 text-[11px] text-gray-300">
              <span className="font-mono font-bold text-yellow-400">[← →]</span> <span>Change Tab</span>
              <span className="font-mono font-bold text-yellow-400">[↑ ↓]</span> <span>Select Item</span>
              <span className="font-mono font-bold text-yellow-400">[Enter]</span> <span>Change Value</span>
              <span className="font-mono font-bold text-yellow-400">[F10]</span> <span>Save & Exit</span>
              <span className="font-mono font-bold text-yellow-400">[F1]</span> <span>General Help</span>
              <span className="font-mono font-bold text-yellow-400">[Esc]</span> <span>Exit Menu</span>
            </div>
          </div>

          {/* Security Status */}
          <div className="bg-gradient-to-br from-green-900/30 to-slate-900/90 border border-green-700/40 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Secure Boot</span>
              <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold border border-green-500/40">ACTIVE</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">TPM 2.0</span>
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/40">ENABLED</span>
            </div>
          </div>
        </aside>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 mt-auto bg-slate-950/95 border-t border-slate-800 px-8 py-5 flex justify-between items-center backdrop-blur-md">
        <div className="text-[11px] text-slate-600 font-mono font-bold tracking-widest">
          © 2026 NEXOS SYSTEMS INC. - ALL RIGHTS RESERVED | UEFI: 2.10 | AMD CBS: 19.0.0.0 | Intel ME: 16.1
        </div>
        <div className="text-[11px] text-slate-500 font-mono font-bold flex gap-10">
          <span>LANG: EN_US</span>
          <span>UEFI MODE</span>
          <span className="text-yellow-500">PRESS DEL TO ENTER BIOS</span>
        </div>
      </footer>

      {/* Custom Styles */}
      <style>{`
        .uefi-root {
          font-family: 'Segoe UI', 'Roboto', system-ui, -apple-system, sans-serif;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.7);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #3b82f6, #8b5cf6);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default UEFI;
