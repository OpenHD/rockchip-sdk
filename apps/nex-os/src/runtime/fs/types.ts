export type NexFsEncoding = 'utf8' | undefined;

export interface NexFsStat {
  type: 'file' | 'dir';
  mode: number;
  size: number;
  ino: number;
  mtimeMs: number;
  ctimeMs: number;
  uid: number;
  gid: number;
  dev: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export class NexFsError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'NexFsError';
    this.code = code;
  }
}

export function fsErrno(code: string, path: string): NexFsError {
  const msgs: Record<string, string> = {
    ENOENT: `ENOENT: no such file or directory, '${path}'`,
    EEXIST: `EEXIST: file already exists, '${path}'`,
    ENOTDIR: `ENOTDIR: not a directory, '${path}'`,
    EISDIR: `EISDIR: illegal operation on a directory, '${path}'`,
    ENOTEMPTY: `ENOTEMPTY: directory not empty, '${path}'`,
  };
  return new NexFsError(code, msgs[code] || `${code}: ${path}`);
}
