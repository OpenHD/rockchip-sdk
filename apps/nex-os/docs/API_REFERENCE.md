# 🔌 Referencia de API — WebOS

WebOS expone una serie de **hooks de React** que permiten a cualquier aplicación interactuar con el núcleo del sistema operativo. Esta documentación es la referencia completa y actualizada.

---

## 🪟 `useWindowManager()`

El hook más importante. Controla el ciclo de vida de todas las ventanas.

```typescript
import { useWindowManager } from '../context/WindowManager';
```

### Tipos

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
  /** Tamaño guardado antes de maximizar, para restauración precisa */
  savedSize?: { width: number; height: number; x: number; y: number };
}
```

### Métodos

| Método | Parámetros | Descripción |
| :--- | :--- | :--- |
| `openWindow` | `id, title, icon, content` | Abre una ventana. Si ya existe, la restaura y la trae al frente. |
| `closeWindow` | `id` | Cierra y elimina la ventana del estado. |
| `minimizeWindow` | `id` | Minimiza la ventana a la taskbar. |
| `minimizeAllWindows` | — | Minimiza todas las ventanas (`Win+D`). |
| `maximizeWindow` | `id, currentSize?` | Alterna maximizado. Guarda el tamaño anterior en `savedSize`. |
| `restoreWindow` | `id` | Restaura desde minimizado **sin reinicializar** el contenido. |
| `snapWindow` | `id, direction` | Acopla la ventana en un cuadrante o mitad de pantalla. |
| `focusWindow` | `id` | Trae al frente y actualiza el z-index. |
| `closeFocusedWindow` | — | Cierra la ventana actualmente enfocada (`Alt+F4`). |

### Propiedades

| Propiedad | Tipo | Descripción |
| :--- | :--- | :--- |
| `windows` | `AppWindow[]` | Lista de todas las ventanas (abiertas y minimizadas). |
| `focusedWindowId` | `string \| null` | ID de la ventana actualmente enfocada. |

### Ejemplo

```typescript
import { useWindowManager } from '../context/WindowManager';
import MiApp from './apps/MiApp';

export const LauncherButton = () => {
  const { openWindow, restoreWindow, windows } = useWindowManager();

  const handleClick = () => {
    const existing = windows.find(w => w.id === 'mi-app');
    if (existing?.isMinimized) {
      restoreWindow('mi-app');          // Restaurar sin reinicializar
    } else {
      openWindow('mi-app', 'Mi App', <span>🚀</span>, <MiApp />);
    }
  };

  return <button onClick={handleClick}>Abrir Mi App</button>;
};
```

---

## ⚙️ `useSettings()`

Accede y modifica la configuración global del sistema. Todos los valores se persisten en `localStorage` automáticamente.

```typescript
import { useSettings } from '../context/SettingsContext';
```

### Propiedades de Estado

| Propiedad | Tipo | Default | Descripción |
| :--- | :--- | :--- | :--- |
| `theme` | `'light' \| 'dark'` | `'dark'` | Tema base del OS. |
| `neonTheme` | `'none' \| 'cyberpunk' \| 'matrix' \| 'synthwave'` | `'none'` | Tema neon activo. |
| `wallpaper` | `string` | URL Unsplash | URL del fondo de pantalla. |
| `accentColor` | `string` | `'#60cdff'` | Color de acento del sistema. |
| `brightness` | `number` (0–100) | `100` | Brillo de pantalla. |
| `volume` | `number` (0–100) | `50` | Volumen del sistema. |
| `isWifiEnabled` | `boolean` | `true` | Estado del WiFi simulado. |
| `isBluetoothEnabled` | `boolean` | `true` | Estado del Bluetooth simulado. |
| `isNightLightEnabled` | `boolean` | `false` | Filtro de luz azul. |
| `userName` | `string` | `'Martín'` | Nombre del usuario activo. |
| `systemState` | `SystemState` | `'OFF'` | Estado del ciclo de vida del OS. |
| `osType` | `'windows' \| 'nexos'` | `'windows'` | Sistema operativo activo. |
| `notifications` | `Notification[]` | `[]` | Cola de notificaciones del sistema. |
| `isTaskViewOpen` | `boolean` | `false` | Vista de tareas (`Win+Tab`) abierta. |

### Métodos

| Método | Parámetros | Descripción |
| :--- | :--- | :--- |
| `setBrightness` | `value: number` | Cambia el brillo (0–100). |
| `setVolume` | `value: number` | Ajusta el volumen (0–100). |
| `setAccentColor` | `color: string` | Cambia el color de acento. |
| `setWallpaper` | `url: string` | Cambia el fondo de pantalla. |
| `toggleTheme` | — | Alterna entre `light` y `dark`. |
| `setNeonTheme` | `theme` | Aplica un tema neon al OS. |
| `lockSystem` | — | Bloquea el OS (vuelve a login). |
| `addNotification` | `title, message, icon?` | Agrega una notificación al centro. |
| `removeNotification` | `id: string` | Elimina una notificación. |
| `playSound` | `'startup' \| 'notif' \| 'error' \| 'beep'` | Reproduce un sonido del sistema. |
| `setSystemState` | `SystemState` | Cambia el estado del ciclo de vida del OS. |

### Tipo `SystemState`

```typescript
type SystemState =
  | 'OFF'
  | 'BOOTING'
  | 'UEFI'
  | 'WINDOWS_BOOT'
  | 'LOGIN'
  | 'DESKTOP'
  | 'SHUTTING_DOWN'
  | 'RESTARTING';
```

### Ejemplo

```typescript
import { useSettings } from '../context/SettingsContext';

export const ThemeToggle = () => {
  const { theme, toggleTheme, neonTheme, setNeonTheme, addNotification } = useSettings();

  const activateCyberpunk = () => {
    setNeonTheme('cyberpunk');
    addNotification('Tema activado', 'Modo Cyberpunk 🟣 encendido');
  };

  return (
    <div>
      <button onClick={toggleTheme}>
        Cambiar a {theme === 'dark' ? 'Claro' : 'Oscuro'}
      </button>
      <button onClick={activateCyberpunk}>
        Cyberpunk
      </button>
    </div>
  );
};
```

---

## 📂 `useFileSystem()`

Interactúa con el sistema de archivos virtual en memoria.

```typescript
import { useFileSystem } from '../context/FileSystemContext';
```

### Propiedades

| Propiedad | Tipo | Descripción |
| :--- | :--- | :--- |
| `files` | `VirtualFile[]` | Lista de todos los archivos virtuales. |

### Métodos

| Método | Parámetros | Descripción |
| :--- | :--- | :--- |
| `createFile` | `location, name, ext` | Crea un archivo y retorna su ID. |
| `updateFileContent` | `id, content` | Actualiza el contenido de un archivo. |

### Tipo `VirtualFile`

```typescript
interface VirtualFile {
  id: string;
  name: string;
  location: string;
  extension: string;
  content: string;
  createdAt: Date;
}
```

### Ejemplo (Notepad)

```typescript
import { useFileSystem } from '../../context/FileSystemContext';

export const Notepad = ({ fileId }: { fileId?: string }) => {
  const { files, updateFileContent } = useFileSystem();
  const file = files.find(f => f.id === fileId);

  const handleSave = (text: string) => {
    if (fileId) updateFileContent(fileId, text);
  };

  return <textarea defaultValue={file?.content} onBlur={e => handleSave(e.target.value)} />;
};
```

---

## 🖥️ `useDesktop()`

Gestiona los íconos del escritorio y los escritorios virtuales.

```typescript
import { useDesktop } from '../context/DesktopContext';
```

### Métodos principales

| Método | Parámetros | Descripción |
| :--- | :--- | :--- |
| `addDesktopIcon` | `icon: Partial<DesktopIcon>` | Añade un ícono al escritorio activo. |
| `updateDesktopIcon` | `id, changes` | Actualiza posición o propiedades de un ícono. |
| `removeDesktopIcon` | `id` | Elimina un ícono del escritorio. |
| `sortDesktopIcons` | `by: 'name' \| 'type' \| 'position'` | Ordena los íconos. |
| `switchDesktop` | `desktopId: string` | Cambia de escritorio virtual. |
| `addDesktop` | — | Agrega un nuevo escritorio virtual. |

---

## 🎨 `useUI()`

Estado de visibilidad de los paneles del sistema.

```typescript
import { useUI } from '../context/UIContext';
```

| Propiedad / Método | Tipo | Descripción |
| :--- | :--- | :--- |
| `isStartOpen` | `boolean` | Si el Start Menu está abierto. |
| `toggleStart / closeStart` | `() => void` | Abre/cierra el Start Menu. |
| `isWidgetsOpen` | `boolean` | Si el panel de Widgets está abierto. |
| `toggleWidgets / closeWidgets` | `() => void` | Abre/cierra los Widgets. |
| `isDesktopSwitcherOpen` | `boolean` | Si el selector de escritorios está visible. |

---

## 🎯 Mejores Prácticas

### 1. Siempre usar `restoreWindow` en lugar de `openWindow` para ventanas existentes

```typescript
const { windows, openWindow, restoreWindow } = useWindowManager();

const launchApp = () => {
  const existing = windows.find(w => w.id === 'my-app');
  if (existing) {
    restoreWindow('my-app');  // ✅ No reinicializa el estado interno
  } else {
    openWindow('my-app', 'Mi App', icon, <MyApp />);
  }
};
```

### 2. Usar `React.memo` para contenido de ventanas pesadas

```typescript
// ✅ Evita re-renders innecesarios cuando el WindowManager actualiza z-index
const HeavyApp = React.memo(() => {
  return <div>Contenido pesado...</div>;
});
```

### 3. Tipado correcto de `snap` al maximizar

```typescript
const { maximizeWindow } = useWindowManager();

// Pasar el tamaño actual para que se restaure correctamente
const handleMaximize = () => {
  maximizeWindow(windowId, { width: size.width, height: size.height, x: pos.x, y: pos.y });
};
```

---

## 📝 Ejemplo Completo: Nueva Aplicación

```typescript
import React, { useState } from 'react';
import { useWindowManager } from '../context/WindowManager';
import { useSettings } from '../context/SettingsContext';

// La app en sí — no necesita saber que está dentro de una ventana
export default function MiApp() {
  const { neonTheme, addNotification } = useSettings();
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(c => c + 1);
    if (count === 9) {
      addNotification('¡Logro desbloqueado!', 'Hiciste clic 10 veces 🎉');
    }
  };

  return (
    <div style={{
      padding: 32,
      background: neonTheme !== 'none' ? 'rgba(0,0,0,0.8)' : '#1c1c1c',
      height: '100%',
      color: 'white',
    }}>
      <h2>Contador: {count}</h2>
      <button onClick={handleClick}>Incrementar</button>
    </div>
  );
}
```

```typescript
// Registrar en constants/apps.tsx
import MiApp from '../components/apps/MiApp';
import { Star24Regular } from '@fluentui/react-icons';

{ id: 'mi-app', icon: <Star24Regular />, label: 'Mi App', component: () => <MiApp /> }
```

---

Para más información sobre la arquitectura del sistema, consulta [ARCHITECTURE.md](./ARCHITECTURE.md).
Para la integración con WebAssembly, consulta [WASM_BRIDGE.md](./WASM_BRIDGE.md).
