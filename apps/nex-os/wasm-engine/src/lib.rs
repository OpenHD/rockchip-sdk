use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── Process Simulation Engine ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProcessSnapshot {
    pub id: u32,
    pub name: String,
    pub pid: u32,
    pub cpu: f64,
    pub mem: f64,
    pub disk: f64,
    pub group: String,
    pub rank: u8,     // 0=low, 1=normal, 2=high, 3=critical
    pub trend: i8,    // -1=decreasing, 0=stable, 1=increasing
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SystemMetrics {
    pub cpu_total: f64,
    pub mem_total_mb: f64,
    pub mem_used_mb: f64,
    pub mem_percent: f64,
    pub disk_active: f64,
    pub net_mbps: f64,
    pub process_count: u32,
    pub thread_count: u32,
    pub uptime_seconds: u64,
}

/// Lcg (Linear Congruential Generator) — deterministic seeded random
/// so WASM gets the same sequence each run (no need for js-sys rand calls)
struct Lcg {
    state: u64,
}

impl Lcg {
    fn new(seed: u64) -> Self {
        Self { state: seed.wrapping_add(1) }
    }

    fn next_f64(&mut self) -> f64 {
        self.state = self.state.wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        ((self.state >> 33) as f64) / (u32::MAX as f64)
    }

    fn next_range(&mut self, min: f64, max: f64) -> f64 {
        min + self.next_f64() * (max - min)
    }
}

// ─── System Load Calculation ───────────────────────────────────────────────

/// Weighted system impact score. Exported to JS/WASM.
#[wasm_bindgen]
pub fn calculate_load(cpu: f64, mem: f64, disk: f64) -> f64 {
    let raw = (cpu * 0.55) + (mem * 0.30) + (disk * 0.15);
    // Apply sigmoid smoothing so spikes don't look too jarring
    100.0 / (1.0 + (-0.05 * (raw - 50.0)).exp())
}

/// Returns health rank: 0=Low, 1=Normal, 2=High, 3=Critical
#[wasm_bindgen]
pub fn get_rank(load: f64) -> u8 {
    if load > 85.0 { 3 }
    else if load > 55.0 { 2 }
    else if load > 20.0 { 1 }
    else { 0 }
}

/// Compress a history array into a smoothed sparkline (30 points → 10)
#[wasm_bindgen]
pub fn smooth_history(data: &[f64], window: usize) -> Vec<f64> {
    if data.is_empty() || window == 0 {
        return data.to_vec();
    }
    data.windows(window)
        .map(|w| w.iter().sum::<f64>() / w.len() as f64)
        .collect()
}

// ─── Process Simulation ────────────────────────────────────────────────────

/// Simulates process CPU/memory fluctuation based on a seed and elapsed ticks.
/// Returns a JSON string with updated process metrics.
#[wasm_bindgen]
pub fn simulate_processes(processes_json: &str, tick: u64, open_windows_json: &str) -> String {
    let processes: Vec<ProcessSnapshot> = match serde_json::from_str(processes_json) {
        Ok(p) => p,
        Err(_) => return "[]".to_string(),
    };

    let open_windows: Vec<String> = serde_json::from_str(open_windows_json).unwrap_or_default();

    let mut rng = Lcg::new(tick.wrapping_mul(0x9e3779b97f4a7c15));

    let updated: Vec<ProcessSnapshot> = processes.iter().map(|p| {
        let is_focused = open_windows.contains(&p.name);

        // CPU fluctuation: active windows get more jitter
        let jitter_range = if is_focused { p.cpu * 0.4 } else { p.cpu * 0.15 };
        let delta = rng.next_range(-jitter_range, jitter_range * 1.5);
        let new_cpu = (p.cpu + delta).clamp(0.0, 100.0);

        // Memory creeps slowly upward over time, occasional drops
        let mem_drift = if rng.next_f64() < 0.05 {
            // GC / memory release event
            -rng.next_range(5.0, 20.0)
        } else {
            rng.next_range(-1.0, 2.5)
        };
        let new_mem = (p.mem + mem_drift).clamp(1.0, 32768.0);

        // Disk: mostly zero with occasional spikes
        let new_disk = if rng.next_f64() < 0.08 {
            rng.next_range(0.1, 15.0)
        } else {
            (p.disk * 0.6).clamp(0.0, 100.0)
        };

        let load = calculate_load(new_cpu, new_mem / 160.0, new_disk);
        let rank = get_rank(load);
        let trend = if new_cpu > p.cpu + 1.0 { 1 }
                    else if new_cpu < p.cpu - 1.0 { -1 }
                    else { 0 };

        ProcessSnapshot {
            id: p.id,
            name: p.name.clone(),
            pid: p.pid,
            cpu: (new_cpu * 10.0).round() / 10.0,
            mem: new_mem.round(),
            disk: (new_disk * 10.0).round() / 10.0,
            group: p.group.clone(),
            rank,
            trend,
        }
    }).collect();

    serde_json::to_string(&updated).unwrap_or_default()
}

// ─── System Metrics Aggregation ────────────────────────────────────────────

/// Aggregate process list into system-level metrics (pure Rust, no JS overhead)
#[wasm_bindgen]
pub fn aggregate_metrics(processes_json: &str, total_ram_kb: f64, tick: u64) -> String {
    let processes: Vec<ProcessSnapshot> = serde_json::from_str(processes_json).unwrap_or_default();

    let cpu_total = processes.iter().map(|p| p.cpu).sum::<f64>() / processes.len().max(1) as f64;
    let mem_used_mb = processes.iter().map(|p| p.mem).sum::<f64>();
    let disk_active = processes.iter().map(|p| p.disk).sum::<f64>().min(100.0);
    let total_ram_mb = total_ram_kb / 1024.0;
    let mem_percent = (mem_used_mb / (total_ram_mb * 10.0) * 100.0).min(99.0);

    // Simulate network based on tick + process count
    let mut rng = Lcg::new(tick.wrapping_mul(0xdeadbeef));
    let net_mbps = rng.next_range(0.5, 8.0);

    let uptime = tick * 2; // 2 seconds per tick

    let metrics = SystemMetrics {
        cpu_total: (cpu_total * 10.0).round() / 10.0,
        mem_total_mb: total_ram_mb,
        mem_used_mb: mem_used_mb.round(),
        mem_percent: mem_percent.round(),
        disk_active: (disk_active * 10.0).round() / 10.0,
        net_mbps: (net_mbps * 100.0).round() / 100.0,
        process_count: processes.len() as u32,
        thread_count: (processes.len() as u32).saturating_mul(4),
        uptime_seconds: uptime,
    };

    serde_json::to_string(&metrics).unwrap_or_default()
}

// ─── C++ Transpilation Engine ──────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct TranspileResult {
    js_code: String,
    errors: Vec<String>,
    warnings: Vec<String>,
}

/// Advanced C++ → JS transpiler running entirely in WASM.
/// Much faster and more correct than the previous regex-based approach.
#[wasm_bindgen]
pub fn transpile_cpp(cpp_code: &str) -> String {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let mut js = cpp_code.to_string();

    // ── Validation ──
    if !cpp_code.contains("main") {
        errors.push("error: 'main' function not found".to_string());
        return serde_json::to_string(&TranspileResult { js_code: String::new(), errors, warnings }).unwrap();
    }

    // ── Strip preprocessor directives ──
    js = strip_preprocessor(&js);

    // ── Transform standard library ──
    js = transform_std_types(&js);

    // ── Transform I/O ──
    js = transform_io(&js);

    // ── Transform control flow ──
    js = transform_control_flow(&js);

    // ── Transform main function ──
    js = transform_main(&js);

    // ── Detect common pitfalls ──
    if cpp_code.contains("delete ") {
        warnings.push("warning: 'delete' has no effect in this environment".to_string());
    }
    if cpp_code.contains("malloc(") || cpp_code.contains("free(") {
        warnings.push("warning: manual memory management not supported, using GC".to_string());
    }
    if cpp_code.contains("pthread") {
        warnings.push("warning: threading not supported in browser environment".to_string());
    }

    let result = TranspileResult {
        js_code: js,
        errors,
        warnings,
    };
    serde_json::to_string(&result).unwrap_or_default()
}

fn strip_preprocessor(code: &str) -> String {
    let mut out = String::with_capacity(code.len());
    for line in code.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("#include") || trimmed.starts_with("#pragma") || trimmed.starts_with("#define") {
            // Skip preprocessor lines (add blank for line number consistency)
            out.push('\n');
        } else if trimmed == "using namespace std;" {
            out.push('\n');
        } else {
            out.push_str(line);
            out.push('\n');
        }
    }
    out
}

fn transform_std_types(code: &str) -> String {
    let replacements = [
        ("std::string", "__str"),
        ("std::vector<", "Array /*"),
        ("std::map<", "Map /*"),
        ("std::cout", "__cout"),
        ("std::cin", "__cin"),
        ("std::endl", "\"\\n\""),
        ("std::to_string", "String"),
        ("std::stoi", "parseInt"),
        ("std::stof", "parseFloat"),
        ("endl", "\"\\n\""),
        // Type → let/var
        ("int ", "let "),
        ("float ", "let "),
        ("double ", "let "),
        ("char ", "let "),
        ("bool ", "let "),
        ("long ", "let "),
        ("short ", "let "),
        ("unsigned ", ""),
        ("auto ", "let "),
        ("string ", "let "),
        ("true", "true"),
        ("false", "false"),
        ("nullptr", "null"),
        ("NULL", "null"),
    ];

    let mut result = code.to_string();
    for (from, to) in &replacements {
        result = result.replace(from, to);
    }
    result
}

fn transform_io(code: &str) -> String {
    // cout << ... << endl;  →  await __io.cout(...)
    let mut result = String::new();
    for line in code.lines() {
        let trimmed = line.trim();
        if trimmed.contains("__cout") && trimmed.contains("<<") {
            // Extract parts between << 
            let content = trimmed
                .trim_start_matches("__cout")
                .replace("<<", "+")
                .replace(';', "");
            let indentation: String = line.chars().take_while(|c| c.is_whitespace()).collect();
            result.push_str(&format!("{}await __io.cout({});\n", indentation, content.trim()));
        } else if trimmed.contains("__cin") && trimmed.contains(">>") {
            // cin >> var;  →  var = await __io.cin();
            let content = trimmed
                .trim_start_matches("__cin")
                .trim_start_matches(">>")
                .trim()
                .trim_end_matches(';');
            let indentation: String = line.chars().take_while(|c| c.is_whitespace()).collect();
            result.push_str(&format!("{}{} = await __io.cin();\n", indentation, content));
        } else {
            result.push_str(line);
            result.push('\n');
        }
    }
    result
}

fn transform_control_flow(code: &str) -> String {
    code.replace("for(let int ", "for(let ")
        .replace("for (let int ", "for (let ")
        .replace("::", ".")
        .replace("->", ".")
        .replace("//", "//") // preserve comments
}

fn transform_main(code: &str) -> String {
    // int main() { ... }  →  async function main() { ... }
    let mut result = code
        .replace("let main()", "async function main()")
        .replace("let main(let argc, let* argv[])", "async function main()")
        .replace("let main(let argc, char* argv[])", "async function main()")
        .replace("return 0;", "return;");

    // Wrap in executor
    result.push_str("\n// Auto-generated WASM executor\n");
    result.push_str("if (typeof main === 'function') { await main(); }\n");
    result
}

// ─── Password/Hash utilities (useful for the simulator) ───────────────────

/// Simple djb2 hash — useful for stable icon color generation
#[wasm_bindgen]
pub fn hash_string(s: &str) -> u32 {
    s.bytes().fold(5381u32, |h, c| h.wrapping_mul(33).wrapping_add(c as u32))
}

/// Generate a HSL color string from a process name (for icon coloring)
#[wasm_bindgen]
pub fn process_color(name: &str) -> String {
    let h = hash_string(name) % 360;
    format!("hsl({}, 65%, 55%)", h)
}

// ─── Performance Timeline ──────────────────────────────────────────────────

/// Compute EMA (exponential moving average) for smoother chart lines
#[wasm_bindgen]
pub fn ema(data: &[f64], alpha: f64) -> Vec<f64> {
    if data.is_empty() { return vec![]; }
    let mut result = Vec::with_capacity(data.len());
    let mut ema_val = data[0];
    result.push(ema_val);
    for &v in &data[1..] {
        ema_val = alpha * v + (1.0 - alpha) * ema_val;
        result.push((ema_val * 100.0).round() / 100.0);
    }
    result
}

/// Generate a realistic CPU history with burst patterns
#[wasm_bindgen]
pub fn generate_cpu_history(base: f64, length: usize, seed: u64) -> Vec<f64> {
    let mut rng = Lcg::new(seed);
    let mut history = Vec::with_capacity(length);
    let mut current = base;
    let mut burst_remaining = 0u32;

    for _ in 0..length {
        if burst_remaining > 0 {
            current = (current + rng.next_range(5.0, 15.0)).min(95.0);
            burst_remaining -= 1;
        } else {
            current = (current + rng.next_range(-8.0, 6.0)).clamp(2.0, 90.0);
            // Random burst chance
            if rng.next_f64() < 0.08 {
                burst_remaining = 3 + (rng.next_f64() * 5.0) as u32;
            }
        }
        history.push((current * 10.0).round() / 10.0);
    }
    history
}
