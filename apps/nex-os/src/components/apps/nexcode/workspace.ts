export type NexFileEntry = { language: string; content: string };
export type NexWorkspace = {
  files: Record<string, NexFileEntry>;
  openFiles: string[];
  activeFile: string;
  themeName: string;
  dirty?: Record<string, boolean>;
};

export const NEX_CODE_STORAGE_KEY = 'nexCodeWorkspace_v1';

export function languageForPath(path: string): string {
  const ext = (path.split('.').pop() || '').toLowerCase();
  if (ext === 'tsx') return 'tsx';
  if (ext === 'ts') return 'ts';
  if (ext === 'jsx' || ext === 'js') return 'javascript';
  if (ext === 'css') return 'css';
  if (ext === 'json') return 'json';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'html') return 'html';
  return 'plaintext';
}

export function loadWorkspace(fallback: NexWorkspace): NexWorkspace {
  try {
    const raw = localStorage.getItem(NEX_CODE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<NexWorkspace>;
    if (!parsed.files || typeof parsed.files !== 'object') return fallback;
    const files = parsed.files;
    const openFiles = Array.isArray(parsed.openFiles)
      ? parsed.openFiles.filter((f) => files[f])
      : Object.keys(files).slice(0, 4);
    const activeFile =
      parsed.activeFile && files[parsed.activeFile]
        ? parsed.activeFile
        : openFiles[0] || Object.keys(files)[0] || '';
    return {
      files,
      openFiles: openFiles.length ? openFiles : activeFile ? [activeFile] : [],
      activeFile,
      themeName: parsed.themeName || fallback.themeName,
      dirty: parsed.dirty || {},
    };
  } catch {
    return fallback;
  }
}

export function saveWorkspace(state: NexWorkspace) {
  try {
    localStorage.setItem(
      NEX_CODE_STORAGE_KEY,
      JSON.stringify({
        files: state.files,
        openFiles: state.openFiles,
        activeFile: state.activeFile,
        themeName: state.themeName,
        dirty: state.dirty || {},
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export type TreeNode =
  | { type: 'folder'; name: string; children: TreeNode[] }
  | { type: 'file'; name: string; path: string };

/** Build explorer tree from flat path map. */
export function buildFileTree(paths: string[]): TreeNode[] {
  type DirMap = Map<string, { kind: 'dir'; name: string; children: DirMap } | { kind: 'file'; name: string; path: string }>;
  const root: DirMap = new Map();

  for (const path of [...paths].sort()) {
    const parts = path.split('/').filter(Boolean);
    let cur = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      if (isFile) {
        cur.set(part, { kind: 'file', name: part, path });
      } else {
        let next = cur.get(part);
        if (!next || next.kind !== 'dir') {
          next = { kind: 'dir', name: part, children: new Map() };
          cur.set(part, next);
        }
        cur = next.children;
      }
    });
  }

  const toArr = (dir: DirMap): TreeNode[] =>
    [...dir.values()].map((n) => {
      if (n.kind === 'dir') {
        return { type: 'folder' as const, name: n.name, children: toArr(n.children) };
      }
      return { type: 'file' as const, name: n.name, path: n.path };
    });

  return toArr(root);
}

export type SearchHit = {
  path: string;
  line: number;
  column: number;
  endColumn: number;
  preview: string;
};

export function searchWorkspace(
  files: Record<string, NexFileEntry>,
  query: string,
  limit = 80,
): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const hits: SearchHit[] = [];
  for (const [path, file] of Object.entries(files)) {
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const idx = lines[i].toLowerCase().indexOf(lower);
      if (idx === -1) continue;
      hits.push({
        path,
        line: i + 1,
        column: idx + 1,
        endColumn: idx + 1 + q.length,
        preview: lines[i].trim().slice(0, 120),
      });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}
