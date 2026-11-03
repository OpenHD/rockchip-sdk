# NEX OS SDK

**`@nex-os/sdk` v0.2.0** — la API oficial para crear apps que viven dentro de NEX OS.

Abrí una ventana, anclala a la taskbar, aparecé en Buscar, Start y **Ctrl+Alt+R** (Ejecutar). Sin tocar el núcleo del shell: registrás un manifest y listo.

| | |
| :--- | :--- |
| **Package** | [`packages/nex-os-sdk`](../packages/nex-os-sdk) · npm [`@nex-os/sdk`](https://www.npmjs.com/package/@nex-os/sdk) |
| **Versión** | `0.2.0` |
| **Install** | `npm install @nex-os/sdk` |
| **Demo in-OS** | App **SDK Docs** / **Hello NEX** |
| **Ejemplo** | [`src/community-apps/HelloNex.tsx`](../src/community-apps/HelloNex.tsx) |

---

## Por qué existe

Las apps built-in viven hardcodeadas en `AppRegistry` + `constants/apps`. Eso escala mal si la comunidad quiere sumar cosas.

El SDK abre un **registro en runtime**:

```
defineApp(manifest)
        │
        ▼
  community registry  ──►  AppRegistry / Taskbar / Start / Search / Run
```

Vos escribís React. El host se encarga de ventanas, focus, minimize y chrome.

---

## Quick start (≈ 2 minutos)

### 1. Creá el módulo

```tsx
// src/community-apps/MiApp.tsx
import React from 'react';
import { defineApp } from '@nex-os/sdk';

type Props = { mode?: string };

function MiApp({ mode = 'demo' }: Props) {
  return (
    <div style={{ height: '100%', padding: 24, color: '#e8f0ff', background: '#0b1220' }}>
      <h1 style={{ margin: 0 }}>Mi App</h1>
      <p style={{ opacity: 0.7 }}>Modo: {mode}</p>
    </div>
  );
}

export default defineApp<Props>({
  id: 'mi-app',
  appId: 'mi-app',
  title: 'Mi App',
  icon: <span style={{ fontSize: 18 }}>⚡</span>,
  component: MiApp,
  description: 'Mi primera community app',
  author: '@vos',
  version: '0.1.0',
  pinToTaskbar: true,
  category: 'tools',
  permissions: ['windows', 'settings'],
  defaultProps: { mode: 'demo' },
  aliases: ['mia'],
});
```

### 2. Importalo al boot

```ts
// src/community-apps/index.ts
import './HelloNex';
import './SdkDocs';
import './MiApp'; // ← tu app
```

`main.tsx` ya importa `./community-apps`, así que el side-effect de `defineApp` registra la app al arrancar.

### 3. Corré el OS

```bash
npm run dev
```

- **Buscar** → título → Enter  
- **Ctrl+Alt+R** → `mia` (alias)  
- Si `pinToTaskbar: true`, también aparece en el dock

---

## Manifest (`NexAppManifest<TProps>`)

| Campo | Tipo | Obligatorio | Descripción |
| :--- | :--- | :---: | :--- |
| `id` | `string` | ✓ | Id de ventana (único por escritorio) |
| `appId` | `string` | ✓ | Clave que resuelve `AppRegistry` |
| `title` | `string` | ✓ | Título en chrome / taskbar / Start |
| `icon` | `ReactNode` | ✓ | Fluent icon, SVG o emoji |
| `component` | `ComponentType<TProps>` | ✓ | UI raíz (`height: 100%`) |
| `aliases` | `string[]` | | Alias (Run / Buscar), case-insensitive |
| `description` | `string` | | Texto de catálogo |
| `author` | `string` | | Handle del creador |
| `version` | `string` | | Semver informativa |
| `defaultProps` | `Partial<TProps>` | | Props al abrir (merge con las del launcher) |
| `pinToTaskbar` | `boolean` | | Visible en dock aunque esté cerrada |
| `category` | union | | `tools` \| `media` \| `games` \| `dev` \| `social` \| `other` |
| `permissions` | `NexAppPermission[]` | | Contrato documental (sandbox roadmap) |

`permissions` acepta: `windows` · `settings` · `fs` · `desktop` · `ui` · `music` · `notifications`.

---

## API del package

```ts
import {
  defineApp,
  registerApp,
  unregisterApp,
  getRegisteredApp,
  resolveRegisteredApp,
  listRegisteredApps,
  getAppsByCategory,
  getCommunityLauncherItems,
  subscribeRegistry,
  createOpenApp,
} from '@nex-os/sdk';
```

| Función | Qué hace |
| :--- | :--- |
| `defineApp<TProps>(m)` | Registra + devuelve el manifest (tipado) |
| `registerApp(m)` | Solo registra |
| `unregisterApp(appId)` | Saca del registry dinámico |
| `getRegisteredApp(appId)` | Lookup directo (aliases normalizados) |
| `resolveRegisteredApp(q)` | id / alias / título (case-insensitive) |
| `listRegisteredApps()` | Manifests únicos |
| `getAppsByCategory(cat)` | Filtro por categoría |
| `getCommunityLauncherItems()` | Items listos para Taskbar/Search |
| `createOpenApp(openWindow)` | Helper puro: abre desde el registry |
| `subscribeRegistry(fn)` | Callback en altas/bajas → unsubscribe |

---

## Hooks del host

Las community apps corren **dentro** del árbol de providers de NEX. Desde `src/community-apps/`:

```ts
import {
  useOpenApp,
  useWindowManager,
  useSettings,
  useMusicPlayer,
  useDesktop,
  useFileSystem,
  useUI,
} from '../sdk/host';
```

### `useOpenApp` (nuevo en 0.2)

```ts
const openApp = useOpenApp();
openApp('hello');                 // alias
openApp('mi-app', { mode: 'pro' }); // props
```

Devuelve `false` si no hay match en el registry community.

### `useWindowManager`

| Método / valor | Uso |
| :--- | :--- |
| `openWindow(id, appId, title, icon, props?)` | Abrir / restaurar ventana |
| `closeWindow` / `minimizeWindow` / `maximizeWindow` | Chrome |
| `snapWindow` / `restoreWindow` / `focusWindow` | Layout |
| `windows` / `focusedWindowId` | Estado |

### `useSettings`

| Valor / método | Uso |
| :--- | :--- |
| `accentColor` / `setAccentColor` | Acento del SO |
| `addNotification(title, message, icon?)` | Toast del sistema |
| `userName` / `volume` / `isWifiEnabled` | Preferencias |

### `useMusicPlayer`

Cola global de NEX Music: `playTrack`, `togglePlay`, `queue`, `favorites`, etc.

También: `useDesktop`, `useFileSystem`, `useUI`.

---

## Contrato de la UI

1. **Ocupá todo el alto** — `height: '100%'` / `flex: 1`.
2. **No dibujés titlebar propia** — NEX lo provee.
3. **Props tipadas** — `defineApp<Props>({ …, defaultProps })`.
4. **Lazy mental** — evitá trabajo pesado en el top-level salvo `defineApp`.

---

## Recetas

### Abrir otra community app

```tsx
const openApp = useOpenApp();
openApp('sdk-docs');
```

### Ejecutar (Ctrl+Alt+R)

```
hello
sdk
sdk-demo
```

Los aliases del manifest se resuelven en el Run dialog.

### Notificación

```tsx
const { addNotification, accentColor } = useSettings();
addNotification('Mi App', `Acento: ${accentColor}`);
```

### Props tipadas

```tsx
defineApp<{ mode: string }>({
  // ...
  defaultProps: { mode: 'demo' },
  component: ({ mode }) => <div>Modo: {mode}</div>,
});
```

---

## Layout del monorepo

```
packages/nex-os-sdk/          ← @nex-os/sdk
  src/types.ts
  src/registry.ts
  src/openApp.ts
  src/index.ts

src/sdk/host.ts               ← re-exports de contextos + useOpenApp
src/sdk/useOpenApp.ts
src/community-apps/           ← tus apps (side-effect register)
```

Alias Vite/TS: `'@nex-os/sdk' → packages/nex-os-sdk/src`

---

## Built-in vs community

| | Built-in | Community (`@nex-os/sdk`) |
| :--- | :--- | :--- |
| Registro | `AppRegistry` + `constants/apps` | `defineApp` |
| Lazy load | `React.lazy` | Bundle de community |
| Run / aliases | Hardcode parcial | `resolveRegisteredApp` |
| Ideal para | Apps del sistema | Experimentos, forks, demos |

---

## Roadmap

- [x] Props tipadas (`defineApp<T>`)
- [x] `useOpenApp` + Run dialog
- [x] `permissions` en manifest (contrato)
- [x] `useMusicPlayer` en host bridge
- [x] Publicar `@nex-os/sdk` en npm (`0.2.0` → https://www.npmjs.com/package/@nex-os/sdk)
- [ ] Catálogo remoto / install de apps
- [ ] Sandbox que aplique `permissions` (incl. futuro `git` / `fs`)
- [ ] Plantilla `create-nex-app`
- [ ] Lazy community (`lazy: () => import(...)`)
- [x] Runtime: NexFs + git local (ver [`docs/RUNTIME.md`](./RUNTIME.md))
- [ ] Git remoto (clone/push vía proxy)

---

## Links

- Package README: [`packages/nex-os-sdk/README.md`](../packages/nex-os-sdk/README.md)
- Demo: app **SDK Docs** dentro de NEX OS
- Contribución: [`CONTRIBUTING.md`](../CONTRIBUTING.md)
