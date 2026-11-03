# `@nex-os/sdk`

**v0.2.0** — API oficial para community apps en NEX OS.

```
defineApp(manifest)  →  registry  →  Taskbar / Start / Search / Run
useOpenApp()         →  abre por id · alias · título
```

```bash
npm install @nex-os/sdk
```

Peer: `react >= 18`. En el monorepo NEX OS el package ya está linkeado; fuera, instalalo desde npm.

Guía completa en el repo: [`docs/SDK.md`](https://github.com/shadownrx/windows/blob/main/docs/SDK.md)

---

## 30 segundos

```tsx
import { defineApp } from '@nex-os/sdk';

type Props = { mode?: string };

function MiApp({ mode = 'demo' }: Props) {
  return (
    <div style={{ height: '100%', padding: 24, color: '#fff', background: '#0b1220' }}>
      <h1>Hola NEX — {mode}</h1>
    </div>
  );
}

export default defineApp<Props>({
  id: 'mi-app',
  appId: 'mi-app',
  title: 'Mi App',
  icon: <span>⚡</span>,
  component: MiApp,
  pinToTaskbar: true,
  category: 'tools',
  permissions: ['windows', 'settings'],
  defaultProps: { mode: 'demo' },
  aliases: ['mia'],
});
```

1. Guardá en `src/community-apps/`
2. `import './MiApp'` en `index.ts`
3. `npm run dev` → Buscar **Mi App** o Ctrl+Alt+R → `mia`

---

## API 0.2

| | |
| :--- | :--- |
| `defineApp<TProps>(manifest)` | Registra con props tipadas |
| `resolveRegisteredApp(query)` | Lookup id / alias / título |
| `createOpenApp(openWindow)` | Helper puro para abrir |
| `getAppsByCategory(cat)` | Filtro por categoría |
| `registerApp` / `unregisterApp` | Alta / baja manual |
| `listRegisteredApps` | Manifests únicos |
| `getCommunityLauncherItems` | Items dock / search |
| `subscribeRegistry` | Escuchar cambios |

Tipos: `NexAppManifest`, `NexAppProps`, `NexAppPermission`, `NexTrack`, `NexLauncherItem`.

---

## Host hooks

```ts
import {
  useOpenApp,
  useWindowManager,
  useSettings,
  useMusicPlayer,
  useFileSystem,
  useDesktop,
  useUI,
} from '../sdk/host';

const openApp = useOpenApp();
openApp('hello');
openApp('mi-app', { mode: 'pro' });
```

---

## Changelog 0.2

- `defineApp<TProps>` genérico
- `resolveRegisteredApp` + `createOpenApp`
- `permissions` en el manifest
- `getAppsByCategory`
- Host: `useOpenApp`, `useMusicPlayer`
- Ctrl+Alt+R resuelve aliases community

---

## Publish (maintainers)

```bash
npm run sdk:build
npm run sdk:publish
# si npm pide 2FA: completar el link del browser / security key
```

---

MIT · [NEX OS](https://github.com/shadownrx/windows)
