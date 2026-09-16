# NEX Runtime

Motor de filesystem, shell, npm/pnpm y **git local** dentro del browser.

| | |
| :--- | :--- |
| **FS** | [`src/runtime/fs`](../src/runtime/fs) — paths Windows + blobs IndexedDB |
| **Shell** | [`src/runtime/shell/runCommand.ts`](../src/runtime/shell/runCommand.ts) |
| **Git** | [`src/runtime/git/gitService.ts`](../src/runtime/git/gitService.ts) (`isomorphic-git`) |
| **npm persist** | [`src/runtime/npm/persist.ts`](../src/runtime/npm/persist.ts) |
| **Context** | [`src/context/NexRuntimeContext.tsx`](../src/context/NexRuntimeContext.tsx) |

---

## Modelo

```
Terminal / Cmd / NexCode SCM
        │
        ▼
  runShellCommand ──► npm / pnpm / git / builtins
        │
        ▼
      NexFs ──► FileItem metadata (localStorage)
           └──► file blobs (IndexedDB)
```

Una sola verdad de archivos: Explorer, Terminal (`cat`), npm y git leen/escriben el mismo árbol.

---

## NexFs

API path-based (`C:\Documentos\Proyectos\…`):

- `readFile` / `writeFile` / `mkdir` / `readdir` / `stat` / `unlink` / `rmdir` / `rename` / `rm`
- Compatible con `isomorphic-git` vía `toGitFs()`
- Hook: `useNexFs()` desde `src/sdk/host` o `FileSystemContext`

Metadata (nombres, carpetas) sigue en React + `win11_fs`. El contenido vive en IndexedDB (`nex-fs-blobs`) para no reventar la cuota con `.git/objects`.

---

## Shell + procesos

`runShellCommand` es el despachador único (Terminal y Cmd lo consumen).

Comandos clave:

| Cmd | Efecto |
| :--- | :--- |
| `npm init` / `install` | Escribe `package.json` + stubs en `node_modules/` |
| `git init/status/add/commit/log/branch/checkout` | Git local real |
| `ls` `cd` `mkdir` `cat` `rm` … | VFS |
| `<app>.nex` / community | Abre ventana |

`NexProcess` registra PIDs de jobs (`spawnProcess` / `endProcess` / `listProcesses`).

---

## Git local

Stack: **isomorphic-git** sobre NexFs.

Soportado: `init`, `status`, `add`, `commit -m`, `log`, `branch`, `checkout`.

**No soportado aún:** `clone`, `push`, `pull`, `fetch` (remoto / CORS — roadmap).

Author por defecto: `NEX User <nex@local>`.

NexCode SCM apunta a `C:\Documentos\Proyectos\nex-app` y sincroniza el workspace al VFS al guardar.

---

## Smoke test

```text
cd Documentos\Proyectos
mkdir demo
cd demo
npm init
git init
echo hola > README.md
git add .
git commit -m "first"
git log --oneline
```

En Explorer deberías ver `package.json`, `.git/` y `README.md`.

---

## Límites

- No es Node nativo: scripts `npm run` siguen simulados.
- Repos grandes pueden llenar IndexedDB; OPFS es la evolución natural.
- Sin auth remota / proxy git todavía.
