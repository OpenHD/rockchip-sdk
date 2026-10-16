export { createNexFs, toGitFs, type NexFs } from './nexFs';
export { normalizePath, resolvePath, dirname, basename, joinPath } from './paths';
export { fsErrno, type NexFsStat, NexFsError } from './types';
export type { VfsBridge } from './vfsBridge';
export { findByPath, pathOfItem, displayName } from './vfsBridge';
