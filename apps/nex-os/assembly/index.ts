export function calculateLoad(cpu: f64, mem: f64): f64 {
  // A simple formula to calculate "System Impact"
  // This runs in Wasm for peak performance during rapid updates
  return (cpu * 0.7) + (mem * 0.3);
}

export function getRank(load: f64): i32 {
  if (load > 80) return 3; // Critical
  if (load > 40) return 2; // High
  if (load > 10) return 1; // Normal
  return 0; // Low
}
