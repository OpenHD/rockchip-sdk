# 🏗️ Estructura del Proyecto — WebOS

Esta documentación explica la organización de archivos y carpetas del proyecto.

---

## 📁 Vista General

```
windows/
├── src/                       # Código fuente principal
├── assembly/                  # Código WebAssembly (AssemblyScript)
├── wasm-engine/               # Código WebAssembly (Rust)
├── public/                    # Archivos estáticos
├── docs/                      # Documentación
├── dist/                      # Build compilado (generado por npm run build)
│
├── package.json               # Dependencias y scripts
├── tsconfig.json              # Configuración de TypeScript
├── vite.config.ts             # Configuración de Vite + PWA
├── tailwind.config.js         # Temas y tokens de color
├── eslint.config.js           # Reglas de linting
├── asconfig.json              # Configuración de AssemblyScript
│
├── README.md                  # Descripción general del proyecto
├── CONTRIBUTING.md            # Guía de contribución
└── CODE_OF_CONDUCT.md         # Código de conducta
```

---

## 📂 Carpeta `src/` — Código Principal

```
src/
├── components/
│   ├── apps/                  # ← Aplicaciones del escritorio (ver tabla abajo)
│   ├── system/                # Componentes del OS (boot, login, 3D bg…)
│   ├── nexos/                 # Escritorio alternativo NEX OS
│   │
│   ├── Desktop.tsx            # Escritorio principal (íconos, drag, context menu)
│   ├── Window.tsx             # HOC de ventana: drag, resize, snap, maximize
│   ├── Taskbar.tsx            # Barra de tareas inferior
│   ├── StartMenu.tsx          # Menú de Inicio
│   ├── ContextMenu.tsx        # Menú contextual (clic derecho)
│   ├── SearchPane.tsx         # Panel de búsqueda global
│   ├── CalendarMenu.tsx       # Popover de calendario en la taskbar
│   └── NotificationsMenu.tsx  # Panel de notificaciones
│
├── context/
│   ├── WindowManager.tsx      # 🧠 Núcleo: ventanas, foco, z-index, snap
│   ├── SettingsContext.tsx    # Preferencias: tema, volumen, wallpaper…
│   ├── FileSystemContext.tsx  # Sistema de archivos virtual
│   ├── DesktopContext.tsx     # Íconos del escritorio + escritorios virtuales
│   └── UIContext.tsx          # Estado global de UI (Start, Widgets, Switcher)
│
├── constants/
│   └── apps.tsx               # Registro central de todas las aplicaciones
│
├── utils/
│   ├── cppEngine.ts           # Motor de compilación C++ (llama a g++)
│   ├── gpuCharts.ts           # Gráficos para Task Manager
│   ├── useWasmEngine.ts       # Hook para usar el motor WASM (con fallback JS)
│   ├── id.ts                  # Generador de IDs únicos
│   └── browserUrls.ts         # URLs predefinidas para el navegador
│
├── assets/                    # Imágenes, íconos, sonidos
├── App.tsx                    # Componente raíz + máquina de estados del OS
├── main.tsx                   # Punto de entrada React
├── index.css                  # CSS global + variables de tema + utilidades
└── vite-env.d.ts              # Tipos de entorno Vite
```

---

## 📱 Aplicaciones del Escritorio (`src/components/apps/`)

| Archivo | App | Descripción |
| :--- | :--- | :--- |
| `BrowserApp.tsx` | NexBrowser Pro | Navegador integrado con historial y YouTube |
| `Calculator.tsx` | Calculadora | Calculadora funcional |
| `Calendar.tsx` | Calendario | Vista mensual con eventos |
| `Clock.tsx` ⭐ | Reloj | Reloj analógico/digital, cronómetro, temporizador, zonas horarias |
| `Cmd.tsx` | Terminal | Símbolo del sistema con comandos simulados |
| `ControlPanel.tsx` | Panel de Control | Configuración completa del sistema |
| `counter.tsx` | Counter-Strike | Mini-app de juego retro |
| `DevCpp2026.tsx` | Dev-C++ 2026 | IDE con compilación real con g++ |
| `FileExplorer.tsx` | Explorador | Navegación de archivos virtuales |
| `IEApp.tsx` | Internet Explorer | IE simulado retro |
| `ImageViewer.tsx` | Visor de Imágenes | Previsualización de imágenes |
| `ManualApp.tsx` | Manual | Manual del sistema WebOS |
| `mediaplayer.tsx` | Reproductor | Reproductor multimedia |
| `Notepad.tsx` ⭐ | Notepad 2.0 | Editor con menús, zoom, fuentes, status bar y contador |
| `Paint.tsx` | Paint | Editor de dibujo con canvas |
| `Photos.tsx` ⭐ | Fotos | Galería con lightbox, zoom, rotación y URLs personalizadas |
| `RecycleBin.tsx` | Papelera | Papelera de reciclaje |
| `SearchApp.tsx` | Buscar | Búsqueda global de aplicaciones |
| `Settings.tsx` | Configuración | Panel de ajustes |
| `SpotifyMini.tsx` ⭐ | Spotify | Reproductor simulado con playlist y controles |
| `TaskManager.tsx` | Administrador de Tareas | CPU/RAM en tiempo real vía WASM + PowerShell |
| `Terminal.tsx` | Terminal Pro | Terminal alternativa |
| `VsCode.tsx` | VS Code | Editor de código completo |
| `WindowsDefender.tsx` | Seguridad | Windows Defender simulado |
| `WordPad.tsx` | WordPad | Editor de texto enriquecido |

> ⭐ = Nuevas o mejoradas en la última actualización (Mayo 2026)

---

## 🖥️ Componentes del Sistema (`src/components/system/`)

```
system/
├── Background3D.tsx           # Orquestador de fondos 3D (delega por tema)
├── BootScreen.tsx             # POST / BIOS animado
├── WindowsBoot.tsx            # Animación de arranque de Windows
├── LoginScreen.tsx            # Pantalla de login con wallpaper
├── OffScreen.tsx              # Pantalla apagada (botón de encendido)
├── ShutdownScreen.tsx         # Pantalla de apagado
├── RestartScreen.tsx          # Pantalla de reinicio
├── UEFI.tsx                   # Selector de OS en el arranque
├── TaskView.tsx               # Vista de tareas (Win+Tab)
├── NotificationToast.tsx      # Sistema de notificaciones toast
├── WidgetsPanel.tsx           # Panel lateral de widgets
│
├── 3d/
│   ├── CyberpunkBG.tsx        # Fondo Cyberpunk (Three.js)
│   ├── MatrixBG.tsx           # Fondo Matrix (lluvia de código)
│   └── SynthwaveBG.tsx        # Fondo Synthwave (rejilla retro)
│
└── widgets/
    ├── WeatherWidget.tsx      # Widget de clima
    ├── NewsWidget.tsx         # Widget de noticias
    └── StocksWidget.tsx       # Widget de acciones
```

---

## 🧠 Contextos (`src/context/`)

### `WindowManager.tsx` — Núcleo del Sistema

Gestiona el ciclo de vida de todas las ventanas.

```typescript
interface AppWindow {
  id: string;
  title: string;
  icon: ReactNode;
  content: ReactNode;
  desktopId: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  snap?: 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none';
  zIndex: number;
  savedSize?: { width: number; height: number; x: number; y: number }; // ← Nuevo: memoria de tamaño
}
```

**Métodos disponibles:**

| Método | Descripción |
| :--- | :--- |
| `openWindow(id, title, icon, content)` | Abre o restaura una ventana |
| `closeWindow(id)` | Cierra y elimina una ventana |
| `minimizeWindow(id)` | Minimiza a la taskbar |
| `minimizeAllWindows()` | Minimiza todas (`Win+D`) |
| `maximizeWindow(id, currentSize?)` | Maximiza guardando el tamaño anterior |
| `restoreWindow(id)` | Restaura desde minimizado sin reinicializar |
| `snapWindow(id, direction)` | Acopla la ventana en un cuadrante |
| `focusWindow(id)` | Trae al frente y actualiza z-index |
| `closeFocusedWindow()` | Cierra la ventana activa (`Alt+F4`) |

### `SettingsContext.tsx`

Almacena y persiste preferencias del usuario en `localStorage`.

| Clave | Tipo | Descripción |
| :--- | :--- | :--- |
| `brightness` | `0–100` | Brillo de pantalla |
| `volume` | `0–100` | Volumen del sistema |
| `accentColor` | `string` | Color de acento (CSS hex) |
| `theme` | `'light' \| 'dark'` | Tema del OS |
| `neonTheme` | `'none' \| 'cyberpunk' \| 'matrix' \| 'synthwave'` | Tema neon |
| `wallpaper` | `string` | URL del fondo de pantalla |
| `isWifiEnabled` | `boolean` | Estado del WiFi |
| `isBluetoothEnabled` | `boolean` | Estado del Bluetooth |
| `isNightLightEnabled` | `boolean` | Luz nocturna |
| `userName` | `string` | Nombre del usuario |

### `FileSystemContext.tsx`

Sistema de archivos virtual en memoria con soporte para crear, leer, actualizar y eliminar archivos/carpetas. Al borrar una carpeta, se eliminan todos sus archivos y subcarpetas de forma recursiva.

### `DesktopContext.tsx`

Gestiona los íconos del escritorio, su posición (drag & drop), orden y escritorios virtuales.

### `UIContext.tsx`

Estado de visibilidad de panels del sistema: Start Menu, Widgets, Desktop Switcher.

---

## 📦 Registro de Aplicaciones (`src/constants/apps.tsx`)

Todas las aplicaciones de la **Taskbar** se registran aquí:

```typescript
export const APPS: AppItem[] = [
  { id: 'notepad', icon: <Document24Regular />, label: 'Bloc de notas', component: (props) => <Notepad {...props} /> },
  { id: 'clock',   icon: <Clock24Regular />,    label: 'Reloj',          component: (props) => <Clock {...props} /> },
  { id: 'photos',  icon: <Image24Regular />,    label: 'Fotos',          component: (props) => <Photos {...props} /> },
  { id: 'spotify', icon: <MusicNote2Regular />, label: 'Spotify',        component: (props) => <SpotifyMini {...props} /> },
  // ...
];
```

Para agregar una nueva app: 1) crear el componente en `apps/`, 2) importarlo aquí, 3) agregar la entrada al array.

---

## ⚙️ WebAssembly (`assembly/` y `wasm-engine/`)

### AssemblyScript (`assembly/`)
```
assembly/
├── index.ts        # Funciones exportadas (calculateLoad, getRank…)
└── tsconfig.json   # Configuración TS para AssemblyScript
```

Compila con:
```bash
npm run build:as
# Genera: public/process_utils.js + public/process_utils.wasm
```

### Rust (`wasm-engine/`)
```
wasm-engine/
├── src/lib.rs      # Motor WASM completo en Rust: calculos, procesos, transpiler C++
├── Cargo.toml      # Configuración del proyecto Rust
└── Cargo.lock      # Bloqueo de dependencias
```

---

## 📊 Tamaños de Build (Mayo 2026)

| Archivo | Sin comprimir | Gzip |
| :--- | :--- | :--- |
| `dist/assets/index.js` | 1,863 KB | 499 KB |
| `dist/assets/index.css` | 27.6 KB | 6.4 KB |
| `dist/index.html` | 1.2 KB | 0.6 KB |

---

## 🔄 Operaciones Comunes

### Agregar una Nueva Aplicación

```bash
# 1. Crear el componente
touch src/components/apps/MiApp.tsx

# 2. Desarrollar el componente
export default function MiApp() {
  return <div style={{ padding: 24 }}>Hola desde Mi App</div>;
}

# 3. Registrar en constants/apps.tsx
import MiApp from '../components/apps/MiApp';
{ id: 'mi-app', icon: <MyIcon />, label: 'Mi App', component: () => <MiApp /> }

# 4. (Opcional) Agregar al StartMenu.tsx
```

### Agregar un Widget

```bash
# 1. Crear en system/widgets/
# 2. Importar en WidgetsPanel.tsx
```

### Modificar Temas

Editar las variables CSS en `src/index.css`:
```css
:root[data-neon='cyberpunk'] {
  --win-accent: #ff00ff;
  --neon-glow: 0 0 10px rgba(255, 0, 255, 0.8);
}
```

---

## 📚 Referencias

- [DEVELOPMENT.md](./DEVELOPMENT.md) — Cómo desarrollar
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Arquitectura en profundidad
- [API_REFERENCE.md](./API_REFERENCE.md) — Referencia de hooks y APIs
- [WASM_BRIDGE.md](./WASM_BRIDGE.md) — Integración WebAssembly
