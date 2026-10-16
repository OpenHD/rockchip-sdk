# 🏛️ Arquitectura del WebOS

Este documento describe la arquitectura de alto nivel del WebOS, incluyendo componentes principales, patrones de datos, y decisiones de diseño.

---

## 🎯 Principios de Diseño

WebOS se construye sobre estos principios fundamentales:

1. **Modularidad:** Cada aplicación es independiente y auto-contenida
2. **Rendimiento:** Uso de WASM para operaciones intensivas
3. **Reactividad:** React como base para UI reactiva
4. **Escalabilidad:** Arquitectura preparada para crecer

---

## 🏛️ El Orquestador Central: `WindowManager`

El corazón de WebOS es el contexto de React `WindowManagerContext`. Actúa como el **kernel** del sistema operativo.

### Responsabilidades

```
┌─────────────────────────────────────────┐
│          WindowManager                  │
├─────────────────────────────────────────┤
│ ✓ Registro de Aplicaciones              │
│ ✓ Ciclo de Vida de Procesos             │
│ ✓ Gestión de Z-Index (capas)            │
│ ✓ Escritorios Virtuales                 │
│ ✓ Menú de Inicio                        │
│ ✓ Notificaciones                        │
└─────────────────────────────────────────┘
```

### Flujo de Estados

```
Estado Inicial
    ↓
Usuario abre aplicación
    ↓
WindowManager.openWindow()
    ↓
Nueva ventana se agrega a estado
    ↓
Component re-renderiza
    ↓
Ventana aparece en pantalla
```

### Estructura de Datos

```typescript
interface AppWindow {
  id: string;                    // ID único
  title: string;                 // Nombre de la ventana
  icon: ReactNode;               // Ícono
  content: ReactNode;            // Componente a renderizar
  desktopId: string;             // Escritorio actual
  isOpen: boolean;               // Visible
  isMinimized: boolean;          // Minimizado
  isMaximized: boolean;          // Maximizado
  zIndex: number;                // Orden de capas
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface WindowManagerContextType {
  windows: AppWindow[];
  activeDesktop: string;
  isStartMenuOpen: boolean;
  desktopIcons: DesktopIcon[];
  
  // Métodos
  openWindow: (id, title, icon, content) => void;
  closeWindow: (id) => void;
  minimizeWindow: (id) => void;
  // ... más métodos
}
```

---

## 🖼️ El Componente `Window` (HOC)

Cada aplicación se envuelve en el componente `Window`. Es un **Higher-Order Component** que añade funcionalidad del sistema.

### Responsabilidades

```
┌────────────────────────────────────────┐
│            Window (HOC)                │
├────────────────────────────────────────┤
│ ✓ Arrastre (Drag)                     │
│ ✓ Cambio de Tamaño (Resize)           │
│ ✓ Controles (Minimize/Maximize/Close) │
│ ✓ Anclaje (Snapping)                  │
│ ✓ Efectos Visuales (Backdrop Blur)    │
│ ✓ Z-Index Management                  │
└────────────────────────────────────────┘
     ↓
  ┌─────────────┐
  │  Aplicación │
  └─────────────┘
```

### Manejo de Eventos

```typescript
// Estructura simplificada de Window.tsx
export const Window: React.FC<WindowProps> = ({ 
  id, 
  title, 
  children 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  // Manejo de arrastre
  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    // ... lógica de arrastre
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX, y: e.clientY });
    }
  };
  
  return (
    <div 
      style={{ position: 'absolute', ...position }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    >
      <WindowHeader title={title} />
      {children}
    </div>
  );
};
```

---

## 📂 Sistema de Archivos Virtual (VFS)

WebOS no tiene acceso directo al disco duro por seguridad del navegador. Implementa un **Virtual File System**.

### Arquitectura VFS

```
FileSystemContext
    ↓
useFileSystem() Hook
    ↓
Componentes (File Explorer)
```

### Operaciones Soportadas

```typescript
interface FileSystemContextType {
  // Propiedades
  files: VirtualFile[];
  currentPath: string;
  
  // Métodos
  navigate: (path: string) => void;
  openFile: (file: VirtualFile) => void;
  createFolder: (name: string) => void;
  deleteFile: (path: string) => void;
  getFileContent: (path: string) => string | Buffer;
}
```

### Estructura de Archivos en Memoria

```
/
├── Users/
│   └── Default/
│       ├── Documents/
│       ├── Downloads/
│       └── Pictures/
├── Program Files/
└── Windows/
```

---

## ⚡ Capa de Rendimiento (WASM)

Para operaciones que requieren CPU intensiva, WebOS delega a WebAssembly.

### Decisión Arquitectónica

```
Task Manager (CPU-intensive)
    ↓
¿Cálculos complejos?
    ↓
JavaScript solo → ❌ Lento
WASM native → ✅ Rápido (x100)
    ↓
Browser → React Component
```

### Implementación

```typescript
// assembly/index.ts
export function calculateMetrics(
  cpuUsage: f64,
  memUsage: f64
): f64 {
  // Cálculos a velocidad nativa
  return (cpuUsage * 0.7) + (memUsage * 0.3);
}
```

```typescript
// React Component
const TaskManager = () => {
  const metrics = wasmModule.calculateMetrics(0.85, 0.40);
  return <div>Carga: {metrics.toFixed(2)}%</div>;
};
```

### Rendimiento Comparativo

| Operación | JavaScript | WASM | Mejora |
|-----------|-----------|------|--------|
| Calcular 1M métricas | 150ms | 1.5ms | 100x |
| Procesar datos | 50ms | 0.5ms | 100x |

---

## 🎨 Motor de Estilos

WebOS combina Tailwind CSS con CSS personalizado para efectos avanzados.

### Capas de Estilizado

```
┌─────────────────────────────────────┐
│  Tailwind CSS (Layout & Base)       │
├─────────────────────────────────────┤
│  Custom CSS (Efectos Avanzados)     │
├─────────────────────────────────────┤
│  Dynamic Themes (Colores)           │
└─────────────────────────────────────┘
```

### Temas Disponibles

```typescript
type Theme = 
  | 'light'
  | 'dark'
  | 'cyberpunk'
  | 'matrix'
  | 'synthwave';

// Ejemplo de tema Cyberpunk
const cyberpunkTheme = {
  colors: {
    primary: '#FF006E',
    secondary: '#00D9FF',
    background: '#0A0E27',
  },
  effects: {
    glow: '0 0 20px rgba(255, 0, 110, 0.5)',
    scanlines: 'repeating-linear-gradient(...)',
  },
};
```

---

## 🔄 Flujo de Datos Global

```
┌──────────────────────────────────────────────┐
│   User Interaction                           │
│   (Click, Scroll, Type)                      │
└────────────────┬─────────────────────────────┘
                 ↓
         ┌──────────────┐
         │  Component   │
         └────────┬─────┘
                  ↓
    ┌─────────────────────────┐
    │  useWindowManager()     │
    │  useFileSystem()        │
    │  useSettings()          │
    └────────────┬────────────┘
                 ↓
    ┌─────────────────────────┐
    │  Update Context         │
    │  (Global State)         │
    └────────────┬────────────┘
                 ↓
    ┌─────────────────────────┐
    │  Re-render Components   │
    │  (React Reconciliation) │
    └────────────┬────────────┘
                 ↓
    ┌─────────────────────────┐
    │  DOM Update             │
    │  (Browser Paint)        │
    └─────────────────────────┘
```

---

## ⚡ NEX Runtime: NexFs, shell, npm/pnpm y git local

Documentación detallada: [`docs/RUNTIME.md`](./RUNTIME.md).

El runtime combina CLI simulado con **persistencia real en NexFs** (metadata VFS + blobs IndexedDB) y **git local** (`isomorphic-git`). Terminal/Cmd comparten `runShellCommand`.

### Arquitectura de NEX Runtime

```
┌──────────────────────────┐
│        NEX OS            │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│      NEX Runtime         │
├──────────────────────────┤
│ Package Manager          │
│ Process Manager          │
│ NEX Loader (.nex)        │
│ Service Registry         │
└────────────┬─────────────┘
             │
     ┌───────┼────────┐
     ▼       ▼        ▼
 WindowMgr  VFS   Telemetry
     │       │        │
     └───┬───┴────────┘
         ▼
      Apps
```

```
NexRuntimeProvider
 ├── packages / projects  ← espejo de package.json en NexFs
 ├── processes            ← PIDs de jobs (spawn/end)
 └── npmRun / pnpmRun / gitRun / resolveNex
```

### Ejecución de Archivos .nex

Los archivos `.nex` son ejecutables virtuales (análogos a `.exe` en Windows) que permiten lanzar aplicaciones registradas en el sistema.

- **Doble clic en FileExplorer**: Detecta la extensión `.nex`, lee la metadata (`nexPayload`) y utiliza `openWindow` del `WindowManager` para iniciar la aplicación correcta con su respectivo icono.
- **Diálogo Ejecutar (Ctrl+Alt+R)**: Permite lanzar archivos `.nex` de forma directa o implícita (p. ej. escribir `notepad` resuelve a `notepad.nex` usando `resolveNex`). Los atajos usan `Ctrl+Alt+*` porque Windows captura `Win+*` / `Alt+Tab` antes del browser.
- **Llamadas desde Terminal/CMD**: El comando `./vscode.nex` o `vscode.nex` busca en la ruta actual o en `C:\Program Files\NEX\` para lanzar la aplicación directamente en el entorno de ventanas.

### Flujo de Comandos de Paquetes (NPM y PNPM)

Cuando el usuario ejecuta un comando en `Terminal.tsx` o `Cmd.tsx`, la petición se procesa como un generador asíncrono (`AsyncGenerator`) que produce líneas de salida simuladas con tiempos de espera realistas:

1. **Resolución**: Se procesan los argumentos (p. ej. `install`, `run`, `create`).
2. **Mutación NexFs**: `package.json` y stubs `node_modules/<pkg>/` se escriben de verdad (Explorer/`cat` los ven).
3. **Git local**: `git init|status|add|commit|log|branch|checkout` (sin remoto todavía).

---

## 🧩 Patrones de Arquitectura

### 1. **Contexto + Hooks**

```typescript
// Definir contexto
const WindowManagerContext = createContext<ContextType>();

// Provider
export const WindowManagerProvider: React.FC = ({ children }) => {
  const [state, setState] = useState(initialState);
  return (
    <WindowManagerContext.Provider value={state}>
      {children}
    </WindowManagerContext.Provider>
  );
};

// Hook para consumir
export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) throw new Error('Must use within Provider');
  return context;
};
```

### 2. **Higher-Order Components (HOC)**

```typescript
export const withWindow = (Component: React.FC) => {
  return (props: any) => (
    <Window id={props.id} title={props.title}>
      <Component {...props} />
    </Window>
  );
};
```

### 3. **Compound Components**

```typescript
<Desktop>
  <Taskbar />
  <DesktopIcons />
  <StartMenu />
  <NotificationArea />
</Desktop>
```

---

## 🚀 Flujo de Inicialización

```
1. index.html cargado
   ↓
2. main.tsx ejecutado
   ↓
3. Providers inicializados (Context)
   ↓
4. App.tsx renderizado
   ↓
5. Desktop y Taskbar montados
   ↓
6. WASM módulo cargado (opcional)
   ↓
7. Desktop listo para uso
```

---

## 🎯 Patrones de Comunicación

### Entre Componentes

```
Padre → Hijo: Props
Hijo → Padre: Callback via Props
Hermano → Hermano: Context
```

### Ejemplo

```typescript
// Padre
const Parent = () => {
  const [data, setData] = useState('');
  
  return (
    <Child 
      data={data}           // Props
      onUpdate={setData}    // Callback
    />
  );
};

// Hijo
interface ChildProps {
  data: string;
  onUpdate: (value: string) => void;
}

const Child: React.FC<ChildProps> = ({ data, onUpdate }) => {
  return (
    <input 
      value={data}
      onChange={(e) => onUpdate(e.target.value)}
    />
  );
};
```

---

## 📊 Diagrama de Componentes

```
┌──────────────────────────────────────────────┐
│                    App                       │
├──────────────────────────────────────────────┤
│  ProviderComposition                         │
│  ├─ WindowManagerProvider                    │
│  ├─ FileSystemProvider                       │
│  ├─ SettingsProvider                         │
│  └─ UIProvider                               │
│       ↓                                       │
│    Desktop                                   │
│    ├─ Background3D                           │
│    ├─ DesktopIcons                           │
│    ├─ TaskView (Virtual Desktops)            │
│    ├─ Window (multiple instances)            │
│    │  └─ App Component (FileExplorer, etc)   │
│    └─ Taskbar                                │
│       ├─ StartMenu                           │
│       ├─ OpenApps                            │
│       ├─ SystemTray                          │
│       └─ Clock                               │
└──────────────────────────────────────────────┘
```

---

## ⚙️ Configuración del Sistema

### `tailwind.config.js`

Define tokens de diseño:
- Colores base y temas
- Tamaños de fuente
- Espaciado
- Efectos especiales

### `vite.config.ts`

Configuración de compilación:
- Alias de rutas
- Plugins
- Optimizaciones

### `asconfig.json`

Configuración de AssemblyScript:
- Tipos
- Rutas de salida
- Optimizaciones WASM

---

## 🔒 Seguridad

WebOS implementa varias medidas de seguridad:

1. **Aislamiento de Aplicaciones**
   - Cada app tiene su propio scope
   - Acceso limitado a contextos globales

2. **VFS Sandboxed**
   - No hay acceso al archivo real del usuario
   - Sistema de archivos simulado en memoria

3. **Validación de Tipos**
   - TypeScript estricto
   - Props tipadas

---

## 📈 Escalabilidad

WebOS está diseñado para crecer:

```
Fase 1: Core (✓ Completado)
  └─ WindowManager, Desktop, básico

Fase 2: Aplicaciones (✓ En progreso)
  └─ Suite de aplicaciones integradas

Fase 3: Extensiones (Futuro)
  └─ Sistema de plugins

Fase 4: Networking (Futuro)
  └─ Sincronización entre dispositivos
```

---

## 🎓 Decisiones de Diseño

### ¿Por qué React?

- Virtual DOM para renders eficientes
- Ecosistema maduro
- Fácil de aprender
- Performance

### ¿Por qué TypeScript?

- Type safety
- Better IDE support
- Menos bugs en producción
- Documentación automática

### ¿Por qué Tailwind?

- Clases utilitarias
- Temas configurables
- Bundle size reducido
- Desarrollo rápido

### ¿Por qué WASM?

- Performance x100 para cálculos
- Ejecución determinista
- No afecta el thread principal

---

## 🔗 Referencias Relacionadas

- [API_REFERENCE.md](./API_REFERENCE.md) - Hooks disponibles
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Estructura de carpetas
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Guía de desarrollo
- [WASM_BRIDGE.md](./WASM_BRIDGE.md) - Detalles de WASM
