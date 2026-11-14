import type { FileItem } from '../../context/FileSystemContext';
import { genId } from '../../utils/id';
import { basename, dirname, normalizePath, splitPath } from './paths';

export type VfsBridge = {
  getFiles: () => FileItem[];
  setFiles: (updater: (prev: FileItem[]) => FileItem[]) => void;
};

const DRIVE_IDS: Record<string, string> = {
  C: 'c-drive',
};

export function pathOfItem(files: FileItem[], id: string): string | null {
  const parts: string[] = [];
  let curr = files.find((f) => f.id === id);
  if (!curr) return null;
  while (curr) {
    if (curr.type === 'drive') {
      parts.unshift('C:');
      break;
    }
    const display =
      curr.type === 'file' && curr.ext ? `${curr.name}.${curr.ext}` : curr.name;
    parts.unshift(display);
    curr = files.find((f) => f.id === curr?.parentId);
  }
  if (parts.length === 1) return 'C:\\';
  return normalizePath(parts.join('\\'));
}

export function findByPath(files: FileItem[], path: string): FileItem | null {
  const { drive, segments } = splitPath(path);
  const driveId = DRIVE_IDS[drive];
  if (!driveId) return null;
  let parentId: string | null = driveId;
  if (segments.length === 0) {
    return files.find((f) => f.id === driveId) ?? null;
  }
  let node: FileItem | null = null;
  for (const seg of segments) {
    node =
      files.find((f) => {
        if (f.parentId !== parentId) return false;
        const full =
          f.type === 'file' && f.ext ? `${f.name}.${f.ext}` : f.name;
        return full.toLowerCase() === seg.toLowerCase();
      }) ?? null;
    if (!node) return null;
    parentId = node.id;
  }
  return node;
}

function parseFileName(name: string): { base: string; ext?: string } {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return { base: name };
  return { base: name.slice(0, idx), ext: name.slice(idx + 1) };
}

export function ensureDir(bridge: VfsBridge, path: string): FileItem {
  const files = bridge.getFiles();
  const existing = findByPath(files, path);
  if (existing) {
    if (existing.type === 'file') {
      throw new Error(`ENOTDIR: ${path}`);
    }
    return existing;
  }
  const parentPath = dirname(path);
  const name = basename(path);
  if (!name) {
    const drive = findByPath(files, 'C:\\');
    if (!drive) throw new Error('ENOENT: C:\\');
    return drive;
  }
  const parent = ensureDir(bridge, parentPath);
  const id = genId();
  const folder: FileItem = {
    id,
    name,
    type: 'folder',
    modified: new Date().toLocaleDateString('es-ES'),
    parentId: parent.id,
    folderType: name === 'node_modules' ? 'node_modules' : 'normal',
  };
  bridge.setFiles((prev) => [...prev, folder]);
  return folder;
}

export function ensureFileMeta(bridge: VfsBridge, path: string): FileItem {
  const files = bridge.getFiles();
  const existing = findByPath(files, path);
  if (existing) {
    if (existing.type !== 'file') throw new Error(`EISDIR: ${path}`);
    return existing;
  }
  const parentPath = dirname(path);
  const name = basename(path);
  const parent = ensureDir(bridge, parentPath);
  const { base, ext } = parseFileName(name);
  const id = genId();
  const file: FileItem = {
    id,
    name: base,
    type: 'file',
    ext,
    size: '0 KB',
    modified: new Date().toLocaleDateString('es-ES'),
    parentId: parent.id,
  };
  bridge.setFiles((prev) => [...prev, file]);
  return file;
}

export function listChildren(files: FileItem[], dirPath: string): FileItem[] {
  const dir = findByPath(files, dirPath);
  if (!dir) return [];
  return files.filter((f) => f.parentId === dir.id);
}

export function removeTree(bridge: VfsBridge, id: string): string[] {
  const files = bridge.getFiles();
  const collect = (targetId: string): string[] => {
    const children = files.filter((f) => f.parentId === targetId);
    return [targetId, ...children.flatMap((c) => collect(c.id))];
  };
  const ids = collect(id);
  const paths = ids
    .map((i) => pathOfItem(files, i))
    .filter((p): p is string => Boolean(p));
  bridge.setFiles((prev) => prev.filter((f) => !ids.includes(f.id)));
  return paths;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, bytes)} B`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function displayName(item: FileItem): string {
  return item.type === 'file' && item.ext ? `${item.name}.${item.ext}` : item.name;
}
