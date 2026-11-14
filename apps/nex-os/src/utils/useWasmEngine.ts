/**
 * useWasmEngine — React hook that loads the AssemblyScript WASM engine and exposes
 * its high-performance functions to the rest of the app.
 *
 * The WASM module is loaded lazily (once, on first use) and cached.
 * Falls back gracefully to pure-JS implementations if WASM is unavailable.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types matching the Rust/AS structs ────────────────────────────────────────

export interface WasmProcessSnapshot {
  id: number;
  name: string;
  pid: number;
  cpu: number;
  mem: number;
  disk: number;
  group: string;
  rank: number;     // 0=low, 1=normal, 2=high, 3=critical
  trend: number;    // -1=decreasing, 0=stable, 1=increasing
}

export interface WasmSystemMetrics {
  cpu_total: number;
  mem_total_mb: number;
  mem_used_mb: number;
  mem_percent: number;
  disk_active: number;
  net_mbps: number;
  process_count: number;
  thread_count: number;
  uptime_seconds: number;
}

interface WasmExports {
  calculate_load: (cpu: number, mem: number, disk: number) => number;
  get_rank: (load: number) => number;
  smooth_history: (data: Float64Array, window: number) => Float64Array;
  simulate_processes: (processesJson: string, tick: bigint, openWindowsJson: string) => string;
  aggregate_metrics: (processesJson: string, totalRamKb: number, tick: bigint) => WasmSystemMetrics;
  transpile_cpp: (cppCode: string) => string;
  hash_string: (s: string) => number;
  process_color: (name: string) => string;
  ema: (data: Float64Array, alpha: number) => Float64Array;
  generate_cpu_history: (base: number, length: number, seed: bigint) => Float64Array;
}

// ─── Singleton WASM instance ─────────────────────────────────────────────────────────

let wasmInstance: WasmExports | null = null;
let wasmLoading = false;
let wasmListeners: Array<(wasm: WasmExports) => void> = [];

async function loadWasm(): Promise<WasmExports | null> {
  if (wasmInstance) return wasmInstance;
  if (wasmLoading) {
    return new Promise(resolve => {
      wasmListeners.push(resolve);
    });
  }

  wasmLoading = true;

  // Skip trying to load AS module for now to avoid build errors, use JS fallback directly!
  // TODO: Uncomment later if needed
  // try {
  //   // Try to load the compiled AssemblyScript WASM module first
  //   const asModule = await import('/process_utils.js').catch(() => null);
  //   if (asModule && asModule.default) {
  //     // Create a compatible WasmExports object using AssemblyScript functions
  //     wasmInstance = {
  //       calculate_load: (cpu: number, mem: number, disk: number) => asModule.calculateLoad(cpu, mem) || jsFallback.calculate_load(cpu, mem, disk),
  //       get_rank: (load: number) => asModule.getRank(load) || jsFallback.get_rank(load),
  //       smooth_history: jsFallback.smooth_history,
  //       simulate_processes: jsFallback.simulate_processes,
  //       aggregate_metrics: jsFallback.aggregate_metrics,
  //       transpile_cpp: jsFallback.transpile_cpp,
  //       hash_string: jsFallback.hash_string,
  //       process_color: jsFallback.process_color,
  //       ema: jsFallback.ema,
  //       generate_cpu_history: jsFallback.generate_cpu_history,
  //     };
  //     console.log('%c[WASM Engine] ✓ AssemblyScript WASM engine loaded successfully', 'color: #60cdff; font-weight: bold');
  //     wasmListeners.forEach(l => l(wasmInstance!));
  //     wasmListeners = [];
  //     return wasmInstance;
  //   }
  // } catch (e) {
  //   console.warn('[WASM Engine] AssemblyScript WASM not available, using JS fallback:', e);
  // }

  // Return null if WASM fails — hooks use JS fallbacks
  wasmLoading = false;
  wasmListeners.forEach(l => l(null as any));
  wasmListeners = [];
  return null;
}

// ─── JS Fallback implementations ──────────────────────────────────────────────

const jsFallback = {
  calculate_load: (cpu: number, mem: number, disk: number): number => {
    const raw = cpu * 0.55 + mem * 0.30 + disk * 0.15;
    return 100 / (1 + Math.exp(-0.05 * (raw - 50)));
  },
  get_rank: (load: number): number => {
    if (load > 85) return 3;
    if (load > 55) return 2;
    if (load > 20) return 1;
    return 0;
  },
  process_color: (name: string): string => {
    let hash = 5381;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash * 33) ^ name.charCodeAt(i)) >>> 0;
    }
    const h = hash % 360;
    return `hsl(${h}, 65%, 55%)`;
  },
  hash_string: (s: string): number => {
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash * 33) ^ s.charCodeAt(i)) >>> 0;
    }
    return hash >>> 0;
  },
  smooth_history: (data: Float64Array, windowSize: number): Float64Array => {
    if (data.length === 0 || windowSize === 0) return data;
    const result = new Float64Array(Math.max(1, data.length - windowSize + 1));
    for (let i = 0; i < result.length; i++) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += data[i + j];
      }
      result[i] = sum / windowSize;
    }
    return result;
  },
  transpile_cpp: (code: string): string => {
    return JSON.stringify({ js_code: code, errors: ['WASM unavailable — using JS fallback'], warnings: [] });
  },
  generate_cpu_history: (base: number, length: number, seed?: bigint): Float64Array => {
    const history = new Float64Array(length);
    let current = base;
    for (let i = 0; i < length; i++) {
      current = Math.max(2, Math.min(90, current + (Math.random() - 0.45) * 8));
      history[i] = Math.round(current * 10) / 10;
    }
    return history;
  },
  ema: (data: Float64Array, alpha: number): Float64Array => {
    if (data.length === 0) return new Float64Array(0);
    const result = new Float64Array(data.length);
    result[0] = data[0];
    let emaVal = data[0];
    for (let i = 1; i < data.length; i++) {
      emaVal = alpha * data[i] + (1 - alpha) * emaVal;
      result[i] = Math.round(emaVal * 100) / 100;
    }
    return result;
  },
  simulate_processes: (processesJson: string, tick: bigint, openWindowsJson: string): string => {
    try {
      const processes: WasmProcessSnapshot[] = JSON.parse(processesJson);
      const openWindows: string[] = JSON.parse(openWindowsJson) || [];
      return JSON.stringify(processes.map(p => {
        const isFocused = openWindows.includes(p.name);
        const jitterRange = isFocused ? p.cpu * 0.4 : p.cpu * 0.15;
        const delta = (Math.random() - 0.4) * jitterRange;
        const newCpu = Math.max(0, Math.min(100, p.cpu + delta));
        const memDrift = Math.random() < 0.05 ? -(Math.random() * 15 + 5) : (Math.random() * 3.5 - 1);
        const newMem = Math.max(1, Math.min(32768, p.mem + memDrift));
        const newDisk = Math.random() < 0.08 ? Math.random() * 15 + 0.1 : Math.max(0, Math.min(100, p.disk * 0.6));
        const load = jsFallback.calculate_load(newCpu, newMem / 160, newDisk);
        const rank = jsFallback.get_rank(load);
        const trend = newCpu > p.cpu + 1 ? 1 : newCpu < p.cpu -1 ? -1 : 0;
        return {
          ...p,
          cpu: Math.round(newCpu *10)/10,
          mem: Math.round(newMem),
          disk: Math.round(newDisk * 10)/10,
          rank,
          trend
        };
      }));
    } catch { return '[]'; }
  },
  aggregate_metrics: (processesJson: string, totalRamKb: number, tick: bigint): WasmSystemMetrics => {
    const processes: WasmProcessSnapshot[] = JSON.parse(processesJson) || [];
    const cpuTotal = processes.reduce((s, p) => s + p.cpu, 0) / Math.max(processes.length, 1);
    const memUsedMb = processes.reduce((s, p) => s + p.mem, 0);
    const totalRamMb = totalRamKb / 1024;
    const memPercent = Math.min(99, memUsedMb / (totalRamMb * 10) * 100);
    const diskActive = Math.min(100, processes.reduce((s, p) => s + p.disk, 0));
    return {
      cpu_total: Math.round(cpuTotal * 10) / 10,
      mem_total_mb: totalRamMb,
      mem_used_mb: Math.round(memUsedMb),
      mem_percent: Math.round(memPercent),
      disk_active: Math.round(diskActive * 10)/10,
      net_mbps: Math.round((Math.random() *7.5 +0.5) *100)/100,
      process_count: processes.length,
      thread_count: processes.length *4,
      uptime_seconds: Number(tick) *2
    };
  },
};

// ─── Main Hook ───────────────────────────────────────────────────────────────────

interface UseWasmEngineReturn {
  isReady: boolean;
  isWasm: boolean;  // true = running real WASM, false = JS fallback

  // Exposed functions
  calculateLoad: (cpu: number, mem: number, disk: number) => number;
  getRank: (load: number) => number;
  processColor: (name: string) => string;
  simulateProcesses: (processes: WasmProcessSnapshot[], tick: number, openWindows: string[]) => WasmProcessSnapshot[];
  aggregateMetrics: (processes: WasmProcessSnapshot[], totalRamKb: number, tick: number) => WasmSystemMetrics;
  transpileCpp: (code: string) => { js_code: string; errors: string[]; warnings: string[] };
  generateCpuHistory: (base: number, length: number, seed?: number) => number[];
  ema: (data: number[], alpha?: number) => number[];
}

export function useWasmEngine(): UseWasmEngineReturn {
  const [isReady, setIsReady] = useState(false);
  const [isWasm, setIsWasm] = useState(false);
  const wasmRef = useRef<WasmExports | null>(null);
  const tickRef = useRef<number>(0);

  useEffect(() => {
    loadWasm().then(wasm => {
      wasmRef.current = wasm;
      setIsWasm(!!wasm);
      setIsReady(true);
    });
  }, []);

  const calculateLoad = useCallback((cpu: number, mem: number, disk: number): number => {
    if (wasmRef.current) return wasmRef.current.calculate_load(cpu, mem, disk);
    return jsFallback.calculate_load(cpu, mem, disk);
  }, []);

  const getRank = useCallback((load: number): number => {
    if (wasmRef.current) return wasmRef.current.get_rank(load);
    return jsFallback.get_rank(load);
  }, []);

  const processColor = useCallback((name: string): string => {
    if (wasmRef.current) return wasmRef.current.process_color(name);
    return jsFallback.process_color(name);
  }, []);

  const simulateProcesses = useCallback((
    processes: WasmProcessSnapshot[],
    tick: number,
    openWindows: string[] = []
  ): WasmProcessSnapshot[] => {
    const pJson = JSON.stringify(processes);
    const wJson = JSON.stringify(openWindows);
    if (wasmRef.current) {
      const result = wasmRef.current.simulate_processes(pJson, BigInt(tick), wJson);
      try { return JSON.parse(result); } catch { return processes; }
    }
    const result = jsFallback.simulate_processes(pJson, BigInt(tick), wJson);
    try { return JSON.parse(result); } catch { return processes; }
  }, []);

  const aggregateMetrics = useCallback((
    processes: WasmProcessSnapshot[],
    totalRamKb: number,
    tick: number
  ): WasmSystemMetrics => {
    const pJson = JSON.stringify(processes);
    if (wasmRef.current) {
      return wasmRef.current.aggregate_metrics(pJson, totalRamKb, BigInt(tick));
    }
    return jsFallback.aggregate_metrics(pJson, totalRamKb, BigInt(tick));
  }, []);

  const transpileCpp = useCallback((code: string) => {
    if (wasmRef.current) {
      const result = wasmRef.current.transpile_cpp(code);
      try { return JSON.parse(result); } catch { }
    }
    const result = jsFallback.transpile_cpp(code);
    try { return JSON.parse(result); } catch { return { js_code: "", errors: ['Parse error'], warnings: [] }; }
  }, []);

  const generateCpuHistory = useCallback((base: number, length: number, seed?: number): number[] => {
    if (wasmRef.current) {
      const arr = wasmRef.current.generate_cpu_history(base, length, BigInt(seed ?? Date.now()));
      return Array.from(arr);
    }
    return Array.from(jsFallback.generate_cpu_history(base, length, BigInt(seed ?? Date.now())));
  }, []);

  const emaFn = useCallback((data: number[], alpha = 0.3): number[] => {
    if (wasmRef.current) {
      const arr = wasmRef.current.ema(new Float64Array(data), alpha);
      return Array.from(arr);
    }
    return Array.from(jsFallback.ema(new Float64Array(data), alpha));
  }, []);

  return {
    isReady,
    isWasm,
    calculateLoad,
    getRank,
    processColor,
    simulateProcesses,
    aggregateMetrics,
    transpileCpp,
    generateCpuHistory,
    ema: emaFn,
  };
}
