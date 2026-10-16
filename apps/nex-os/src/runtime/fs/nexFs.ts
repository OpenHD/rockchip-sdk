import {
  blobDelete,
  blobDeletePrefix,
  blobGet,
  blobSet,
  bytesToText,
  textToBytes,
} from './blobStore';
import { basename, dirname, normalizePath } from './paths';
import { fsErrno, type NexFsStat } from './types';
import {
  displayName,
  ensureDir,
  ensureFileMeta,
  findByPath,
  formatSize,
  listChildren,
  pathOfItem,
  removeTree,
  type VfsBridge,
} from './vfsBridge';

function makeStat(type: 'file' | 'dir', size: number, ino: number): NexFsStat {
  const now = Date.now();
  return {
    type,
    mode: type === 'dir' ? 0o755 : 0o644,
    size,
    ino,
    mtimeMs: now,
    ctimeMs: now,
    uid: 1,
    gid: 1,
    dev: 1,
    isFile: () => type === 'file',
    isDirectory: () => type === 'dir',
    isSymbolicLink: () => false,
  };
}

function hashIno(path: string): number {
  let h = 0;
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) >>> 0;
  return h || 1;
}

export type NexFs = ReturnType<typeof createNexFs>;

/**
 * Path-based FS over VFS metadata + IndexedDB blobs.
 * Implements the Promise API expected by isomorphic-git.
 */
export function createNexFs(bridge: VfsBridge) {
  const api = {
    async readFile(path: string, opts?: { encoding?: string } | string): Promise<Uint8Array | string> {
      const p = normalizePath(path);
      const item = findByPath(bridge.getFiles(), p);
      if (!item) throw fsErrno('ENOENT', p);
      if (item.type !== 'file') throw fsErrno('EISDIR', p);

      let bytes = await blobGet(p);
      if (!bytes && item.content != null) {
        bytes = textToBytes(item.content);
      }
      if (!bytes) bytes = new Uint8Array(0);

      const encoding = typeof opts === 'string' ? opts : opts?.encoding;
      if (encoding === 'utf8') return bytesToText(bytes);
      return bytes;
    },

    async writeFile(
      path: string,
      data: Uint8Array | string,
      _opts?: { encoding?: string } | string,
    ): Promise<void> {
      const p = normalizePath(path);
      const bytes = typeof data === 'string' ? textToBytes(data) : data;
      ensureFileMeta(bridge, p);
      await blobSet(p, bytes);
      const item = findByPath(bridge.getFiles(), p);
      if (item) {
        bridge.setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  content: undefined,
                  size: formatSize(bytes.byteLength),
                  modified: new Date().toLocaleDateString('es-ES'),
                }
              : f,
          ),
        );
      }
    },

    async unlink(path: string): Promise<void> {
      const p = normalizePath(path);
      const item = findByPath(bridge.getFiles(), p);
      if (!item) throw fsErrno('ENOENT', p);
      if (item.type !== 'file') throw fsErrno('EISDIR', p);
      await blobDelete(p);
      bridge.setFiles((prev) => prev.filter((f) => f.id !== item.id));
    },

    async readdir(path: string): Promise<string[]> {
      const p = normalizePath(path);
      const item = findByPath(bridge.getFiles(), p);
      if (!item) throw fsErrno('ENOENT', p);
      if (item.type === 'file') throw fsErrno('ENOTDIR', p);
      return listChildren(bridge.getFiles(), p).map(displayName);
    },

    async mkdir(path: string, _opts?: { recursive?: boolean }): Promise<void> {
      const p = normalizePath(path);
      const existing = findByPath(bridge.getFiles(), p);
      if (existing) {
        if (existing.type === 'file') throw fsErrno('ENOTDIR', p);
        return; // recursive-friendly
      }
      ensureDir(bridge, p);
    },

    async rmdir(path: string): Promise<void> {
      const p = normalizePath(path);
      const item = findByPath(bridge.getFiles(), p);
      if (!item) throw fsErrno('ENOENT', p);
      if (item.type === 'file') throw fsErrno('ENOTDIR', p);
      const kids = listChildren(bridge.getFiles(), p);
      if (kids.length) throw fsErrno('ENOTEMPTY', p);
      const paths = removeTree(bridge, item.id);
      await Promise.all(paths.map((x) => blobDelete(x)));
    },

    async stat(path: string): Promise<NexFsStat> {
      const p = normalizePath(path);
      const item = findByPath(bridge.getFiles(), p);
      if (!item) throw fsErrno('ENOENT', p);
      if (item.type === 'file') {
        const blob = await blobGet(p);
        const size =
          blob?.byteLength ??
          (item.content != null ? textToBytes(item.content).byteLength : 0);
        return makeStat('file', size, hashIno(p));
      }
      return makeStat('dir', 0, hashIno(p));
    },

    async lstat(path: string): Promise<NexFsStat> {
      return api.stat(path);
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      const from = normalizePath(oldPath);
      const to = normalizePath(newPath);
      const item = findByPath(bridge.getFiles(), from);
      if (!item) throw fsErrno('ENOENT', from);
      if (findByPath(bridge.getFiles(), to)) throw fsErrno('EEXIST', to);

      ensureDir(bridge, dirname(to));
      const parent = findByPath(bridge.getFiles(), dirname(to));
      if (!parent) throw fsErrno('ENOENT', dirname(to));

      const name = basename(to);
      const idx = name.lastIndexOf('.');
      const base = item.type === 'file' && idx > 0 ? name.slice(0, idx) : name;
      const ext = item.type === 'file' && idx > 0 ? name.slice(idx + 1) : item.ext;

      bridge.setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                name: base,
                ext: item.type === 'file' ? ext : undefined,
                parentId: parent.id,
                modified: new Date().toLocaleDateString('es-ES'),
              }
            : f,
        ),
      );

      const data = await blobGet(from);
      if (data) {
        await blobSet(to, data);
        await blobDelete(from);
      }
    },

    async symlink(_target: string, _path: string): Promise<void> {
      throw new Error('ENOTSUP: symlinks not supported in NexFs');
    },

    async readlink(_path: string): Promise<string> {
      throw new Error('EINVAL: not a symlink');
    },

    /** Delete file or directory tree (runtime helper, not required by git). */
    async rm(path: string, opts?: { recursive?: boolean }): Promise<void> {
      const p = normalizePath(path);
      const item = findByPath(bridge.getFiles(), p);
      if (!item) throw fsErrno('ENOENT', p);
      if (item.type === 'file') {
        await api.unlink(p);
        return;
      }
      if (!opts?.recursive) {
        await api.rmdir(p);
        return;
      }
      const paths = removeTree(bridge, item.id);
      await blobDeletePrefix(p);
      await Promise.all(paths.map((x) => blobDelete(x)));
    },

    /** Read text with VFS inline fallback (for Terminal cat). */
    async readText(path: string): Promise<string> {
      const data = await api.readFile(path, { encoding: 'utf8' });
      return typeof data === 'string' ? data : bytesToText(data);
    },

    exists(path: string): boolean {
      return Boolean(findByPath(bridge.getFiles(), normalizePath(path)));
    },

    pathOfId(id: string): string | null {
      return pathOfItem(bridge.getFiles(), id);
    },

    idOfPath(path: string): string | null {
      return findByPath(bridge.getFiles(), normalizePath(path))?.id ?? null;
    },
  };

  return api;
}

/** isomorphic-git expects this shape (promises). */
export function toGitFs(nexFs: NexFs) {
  return {
    promises: {
      readFile: nexFs.readFile.bind(nexFs),
      writeFile: nexFs.writeFile.bind(nexFs),
      unlink: nexFs.unlink.bind(nexFs),
      readdir: nexFs.readdir.bind(nexFs),
      mkdir: nexFs.mkdir.bind(nexFs),
      rmdir: nexFs.rmdir.bind(nexFs),
      stat: nexFs.stat.bind(nexFs),
      lstat: nexFs.lstat.bind(nexFs),
      rename: nexFs.rename.bind(nexFs),
      symlink: nexFs.symlink.bind(nexFs),
      readlink: nexFs.readlink.bind(nexFs),
    },
  };
}
