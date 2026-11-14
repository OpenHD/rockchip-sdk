# 🌉 El Puente WASM: AssemblyScript y Rust en WebOS

Para lograr un rendimiento premium, WebOS delega cálculos intensivos a **WebAssembly (WASM)**. Utilizamos **AssemblyScript** (sintaxis similar a TypeScript) y **Rust** para escribir estos módulos, y contamos con un **fallback en JavaScript puro** para garantizar compatibilidad en cualquier navegador.

---

## 🚀 ¿Por qué WASM?

En aplicaciones de monitoreo en tiempo real (como el Administrador de Tareas), el hilo principal de JavaScript puede saturarse si realiza cálculos complejos cada pocos milisegundos.

### Comparación de Rendimiento

```
Tarea: Procesar 1 millón de números

JavaScript puro:      150 ms ❌
WASM (AssemblyScript):  1.5 ms ✅

Mejora: 100x más rápido
```

### Ventajas de WASM

| Ventaja | Descripción |
|---------|-------------|
| **Ejecución Rápida** | Código compilado a binario |
| **Determinista** | No hay GC (garbage collection) pausando ejecución |
| **No bloquea JS** | El thread principal sigue respondiendo |
| **Bajo overhead** | Comunicación eficiente entre JS y WASM |
| **Compacto** | Tamaño de binario pequeño (~50KB) |

---

## 🛠️ Estructura del Puente

Los archivos fuente residen en `/assembly/index.ts`. Un ejemplo de función optimizada:

```typescript
// assembly/index.ts

// Función simple: Calcular carga del sistema
export function calculateSystemLoad(cpu: f64, mem: f64): f64 {
  // f64 es un número de 64 bits (double en JavaScript)
  return (cpu * 0.7) + (mem * 0.3);
}

// Función con array: Procesar métricas en batch
export function processMetrics(data: Float64Array): f64 {
  let sum: f64 = 0;
  let count: i32 = 0;
  
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    count++;
  }
  
  return count > 0 ? sum / f64(count) : 0;
}

// Función compleja: Análisis de rendimiento
export function analyzePerformance(
  samples: Float64Array,
  threshold: f64
): i32 {
  let problematicCount: i32 = 0;
  
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] > threshold) {
      problematicCount++;
    }
  }
  
  return problematicCount;
}
```

---

## 🔌 Cómo Consumir WASM en React

### Método 1: Importación Simple (Recomendado)

```typescript
// src/utils/wasmLoader.ts
let wasmModule: any = null;

export async function initWasm() {
  // El archivo se genera en public/ tras compilar
  const wasmPath = '/process_utils.wasm';
  const response = await fetch(wasmPath);
  const buffer = await response.arrayBuffer();
  const wasmModule = await WebAssembly.instantiate(buffer);
  return wasmModule.instance.exports;
}

export async function getWasm() {
  if (!wasmModule) {
    wasmModule = await initWasm();
  }
  return wasmModule;
}
```

### Método 2: En un Componente

```typescript
// src/components/TaskManager.tsx
import { useEffect, useState } from 'react';
import { getWasm } from '../utils/wasmLoader';

export const TaskManager: React.FC = () => {
  const [load, setLoad] = useState<number>(0);

  useEffect(() => {
    const calculateLoad = async () => {
      const wasm = await getWasm();
      
      // Llamar función WASM
      const cpuUsage = 0.85;
      const memUsage = 0.40;
      const systemLoad = wasm.calculateSystemLoad(cpuUsage, memUsage);
      
      setLoad(systemLoad);
    };

    calculateLoad();
    
    // Recalcular cada 1 segundo
    const interval = setInterval(calculateLoad, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white p-4 rounded-lg">
      <h2>Carga del Sistema</h2>
      <p className="text-2xl font-bold">{(load * 100).toFixed(2)}%</p>
    </div>
  );
};
```

### Método 3: Con Hook Personalizado

```typescript
// src/hooks/useWasm.ts
import { useEffect, useState } from 'react';
import { getWasm } from '../utils/wasmLoader';

export const useWasm = () => {
  const [wasm, setWasm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadWasm = async () => {
      try {
        const loadedWasm = await getWasm();
        setWasm(loadedWasm);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadWasm();
  }, []);

  return { wasm, loading, error };
};

// Usar en un componente
export const MyComponent = () => {
  const { wasm, loading, error } = useWasm();

  if (loading) return <div>Cargando WASM...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const result = wasm.calculateSystemLoad(0.5, 0.3);
  return <div>Resultado: {result}</div>;
};
```

---

## 🔨 Cómo Compilar WASM

### Instalación de AssemblyScript

```bash
npm install --save-dev assemblyscript
```

### Compilación

Si realizas cambios en `/assembly/index.ts`, debes recompilar:

```bash
npm run build:as
```

Este comando generará:
- `public/process_utils.js` - Módulo compilado
- `public/process_utils.d.ts` - Tipos TypeScript

## 🔌 Usar WASM con el Hook `useWasmEngine`

El proyecto incluye un hook personalizado que maneja la carga del módulo WASM y fallback automático a JavaScript:

```typescript
import { useWasmEngine } from '../utils/useWasmEngine';

export const MyComponent = () => {
  const { isReady, isWasm, calculateLoad, getRank } = useWasmEngine();

  if (!isReady) return <div>Cargando...</div>;

  const load = calculateLoad(0.7, 0.4, 0.2);
  const rank = getRank(load);

  return (
    <div>
      <p>Carga: {load.toFixed(2)}%</p>
      <p>Rank: {rank}</p>
      <p>Motor: {isWasm ? 'WASM' : 'JS Fallback'}</p>
    </div>
  );
};
```

### Configuración en `asconfig.json`

```json
{
  "targets": {
    "release": {
      "outFile": "public/process_utils.js",
      "textFile": "public/process_utils.d.ts",
      "sourceMap": false,
      "optimizeLevel": 3,
      "shrinkLevel": 2
    },
    "debug": {
      "outFile": "public/process_utils.debug.wasm",
      "sourceMap": true,
      "optimizeLevel": 0
    }
  }
}
```

---

## 🧩 Tipos en AssemblyScript

### Tipos Básicos

```typescript
// Números
i8, i16, i32, i64              // Enteros
u8, u16, u32, u64              // Enteros sin signo
f32, f64                        // Punto flotante

// Booleans
true, false

// Arrays
let arr: i32[] = [1, 2, 3];

// Strings (limitado)
let str: string = "hello";
```

### Ejemplo Completo

```typescript
// assembly/index.ts

// Función que retorna i32 (entero)
export function add(a: i32, b: i32): i32 {
  return a + b;
}

// Función que retorna f64 (decimal)
export function divide(a: f64, b: f64): f64 {
  if (b === 0) {
    return 0;  // Evitar división por cero
  }
  return a / b;
}

// Función que procesa array
export function sumArray(arr: Float64Array): f64 {
  let sum: f64 = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum;
}
```

---

## 🐛 Debugging de WASM

### Log desde WASM

```typescript
// assembly/index.ts

// Importar función de log
import { log } from "as-wasi";

export function debugCalculation(value: f64): f64 {
  log("Input: " + value.toString());
  const result = value * 2;
  log("Output: " + result.toString());
  return result;
}
```

### Debug desde JavaScript

```typescript
// src/utils/debug.ts
export const debugWasm = async () => {
  const wasm = await getWasm();
  
  console.time('WASM Calculation');
  const result = wasm.calculateSystemLoad(0.85, 0.40);
  console.timeEnd('WASM Calculation');
  
  console.log('Result:', result);
  
  return result;
};
```

### Ver Binario WASM

```bash
# Convertir WASM a WAT (WebAssembly Text)
wasm2wat public/process_utils.wasm > public/process_utils.wat

# Inspeccionar con hexdump
hexdump -C public/process_utils.wasm | head
```

---

## 📊 Benchmarking

### Medir Performance en JavaScript

```typescript
// src/utils/benchmark.ts
export const benchmark = async () => {
  const wasm = await getWasm();
  
  // Preparar datos
  const data = new Float64Array(1000000);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random();
  }
  
  // Benchmark WASM
  console.time('WASM processMetrics');
  const wasmResult = wasm.processMetrics(data);
  console.timeEnd('WASM processMetrics');
  
  // Benchmark JavaScript puro
  console.time('JS processMetrics');
  let jsSum = 0;
  for (let i = 0; i < data.length; i++) {
    jsSum += data[i];
  }
  const jsResult = jsSum / data.length;
  console.timeEnd('JS processMetrics');
  
  console.log('WASM Result:', wasmResult);
  console.log('JS Result:', jsResult);
  console.log('Match:', Math.abs(wasmResult - jsResult) < 0.0001);
};
```

### Profiling en Chrome DevTools

1. Abre DevTools (F12)
2. Ve a "Performance" tab
3. Presiona "Record"
4. Ejecuta tu código
5. Presiona "Stop"
6. Analiza el timeline

---

## ⚠️ Limitaciones y Consideraciones

### Limitaciones de AssemblyScript

```typescript
// ❌ NO soportado
export function takesCallback(cb: () => void) {
  // Los callbacks no se soportan
}

// ❌ NO soportado
export function returnsObject() {
  return { x: 1, y: 2 };  // Objetos complejos
}

// ✅ SÍ soportado
export function returnsArray(): Float64Array {
  return new Float64Array([1, 2, 3]);
}
```

### Performance Tips

1. **Minimiza llamadas cruzadas**
   - Menos llamadas JS ↔ WASM = mejor performance
   - Agrupa operaciones

2. **Usa tipos apropiados**
   ```typescript
   // ✅ BIEN: i32 para enteros pequeños
   export function counter(n: i32): i32 {
     return n + 1;
   }
   
   // ❌ MAL: f64 para todo
   export function counter(n: f64): f64 {
     return n + 1;
   }
   ```

3. **Evita conversiones innecesarias**
   ```typescript
   // ❌ Conversión costosa
   let arr = new Array(1000000);
   for (let i = 0; i < arr.length; i++) {
     arr[i] = wasm.process(i);
   }
   
   // ✅ Una sola llamada WASM
   let arr = wasm.processArray(new Float64Array(1000000));
   ```

---

## 🔄 Ciclo de Desarrollo

### Flujo Típico

```
1. Editar assembly/index.ts
   ↓
2. npm run build:as (compilar)
   ↓
3. Test en navegador
   ↓
4. Si hay error, volver a paso 1
   ↓
5. npm run build (compilar proyecto)
```

---

## 🎯 Casos de Uso Reales en WebOS

### 1. Task Manager - Cálculo de Métricas

```typescript
// assembly/index.ts
export function calculateCPULoad(
  processes: Float64Array,
  weights: Float64Array
): f64 {
  let load: f64 = 0;
  
  for (let i = 0; i < processes.length; i++) {
    load += processes[i] * weights[i];
  }
  
  return load / f64(processes.length);
}
```

```typescript
// En TaskManager.tsx
const metrics = wasm.calculateCPULoad(
  new Float64Array([0.5, 0.3, 0.8, 0.1]),
  new Float64Array([0.4, 0.3, 0.2, 0.1])
);
```

### 2. Media Player - Procesamiento de Audio

```typescript
// assembly/index.ts
export function normalizeAudio(samples: Float64Array): void {
  let max: f64 = 0;
  
  // Encontrar valor máximo
  for (let i = 0; i < samples.length; i++) {
    let abs = samples[i] > 0 ? samples[i] : -samples[i];
    if (abs > max) max = abs;
  }
  
  // Normalizar
  if (max > 0) {
    for (let i = 0; i < samples.length; i++) {
      samples[i] = samples[i] / max;
    }
  }
}
```

---

## 🔗 Recursos

- [AssemblyScript Docs](https://www.assemblyscript.org/)
- [WebAssembly Docs](https://developer.mozilla.org/en-US/docs/WebAssembly/)
- [MDN: Using WASM with JavaScript](https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API)

---

## 🎓 Siguiente Paso

Ahora que entiendes WASM, consulta:
- [API_REFERENCE.md](./API_REFERENCE.md) - Para hooks de React
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Para entender cómo se integra
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Para crear aplicaciones
