import type { NexFs } from '../fs';
import { normalizePath, resolvePath } from '../fs/paths';
import { findByPath, displayName } from '../fs/vfsBridge';
import type { FileItem } from '../../context/FileSystemContext';
import { resolveExecutable } from '../resolveExecutable';
import type { GitService } from '../git/gitService';
import { runExtraCommand } from './extraCommands';

export type ShellEvent =
  | { type: 'line'; text: string; color?: string }
  | { type: 'cwd'; path: string; dirId: string }
  | { type: 'open'; appId: string; title: string }
  | { type: 'clear' };

export type ShellDeps = {
  files: FileItem[];
  nexFs: NexFs;
  cwd: string;
  cwdId: string;
  userName: string;
  flavor: 'bash' | 'cmd';
  npmRun: (args: string[], cwd: string) => AsyncGenerator<string>;
  pnpmRun: (args: string[], cwd: string) => AsyncGenerator<string>;
  gitRun: (args: string[], cwd: string) => AsyncGenerator<string>;
  createFolder: (parentId: string, name: string) => void;
  createFile: (parentId: string, name: string, ext: string) => string;
  deleteItem: (id: string) => void;
};

function line(text: string, color?: string): ShellEvent {
  return { type: 'line', text, color };
}

async function* emitGen(
  gen: AsyncGenerator<string>,
  color?: string,
): AsyncGenerator<ShellEvent> {
  for await (const text of gen) {
    if (text === undefined || text === '') {
      yield line('');
      continue;
    }
    yield line(text, color);
  }
}

export async function* runShellCommand(
  rawLine: string,
  deps: ShellDeps,
): AsyncGenerator<ShellEvent> {
  const {
    files,
    nexFs,
    cwd,
    cwdId,
    userName,
    flavor,
    npmRun,
    pnpmRun,
    gitRun,
    createFolder,
    createFile,
    deleteItem,
  } = deps;

  const trimmed = rawLine.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const command = (parts[0] || '').toLowerCase();
  const args = parts.slice(1);
  const err = flavor === 'bash' ? '#f87171' : '#f87171';
  const ok = '#4ade80';

  if (command === 'npm') {
    yield* emitGen(npmRun(args, cwd), ok);
    return;
  }
  if (command === 'pnpm') {
    yield* emitGen(pnpmRun(args, cwd), '#a78bfa');
    return;
  }
  if (command === 'git') {
    yield* emitGen(gitRun(args, cwd), '#e2e8f0');
    return;
  }

  const isNex =
    command.endsWith('.nex') || command.startsWith('./') || command.startsWith('.\\');
  if (isNex || command === 'start') {
    const q = command === 'start' ? args[0] || '' : command;
    const exe = resolveExecutable(q, files);
    if (exe) {
      yield line(`Iniciando ${exe.title}...`, '#60a5fa');
      yield { type: 'open', appId: exe.appId, title: exe.title };
    } else {
      yield line(
        flavor === 'bash'
          ? `bash: ${q}: Archivo no encontrado`
          : `'${q}' no se reconoce como un comando interno o externo.`,
        err,
      );
    }
    return;
  }

  switch (command) {
    case 'clear':
    case 'cls':
      yield { type: 'clear' };
      return;

    case 'ls':
    case 'dir': {
      const items = files.filter((f) => f.parentId === cwdId);
      if (!items.length) {
        yield line('(vacío)', '#9ca3af');
        break;
      }
      for (const f of items) {
        const name = displayName(f);
        const isDir = f.type === 'folder' || f.type === 'drive';
        const color = f.ext === 'nex' ? '#60a5fa' : isDir ? '#fbbf24' : undefined;
        yield line(
          `${isDir ? 'd' : '-'}rwxr-xr-x  ${f.size ?? '4.0K'}  ${f.modified}  ${name}`,
          color,
        );
      }
      break;
    }

    case 'cd': {
      if (!args[0]) {
        yield line(cwd);
        break;
      }
      let nextId = cwdId;
      let nextPath = cwd;
      if (args[0] === '..') {
        const curr = files.find((f) => f.id === cwdId);
        if (curr?.parentId) {
          nextId = curr.parentId;
          nextPath = nexFs.pathOfId(nextId) || 'C:\\';
        }
      } else if (args[0] === '~' || args[0] === '/' || args[0] === '\\') {
        nextId = 'c-drive';
        nextPath = 'C:\\';
      } else {
        const target = resolvePath(cwd, args.join(' '));
        const folder = findByPath(files, target);
        if (folder && folder.type !== 'file') {
          nextId = folder.id;
          nextPath = normalizePath(target);
        } else {
          yield line(
            flavor === 'bash'
              ? `bash: cd: ${args[0]}: No existe el archivo o el directorio`
              : `El sistema no puede encontrar la ruta especificada.`,
            err,
          );
          break;
        }
      }
      yield { type: 'cwd', path: nextPath, dirId: nextId };
      break;
    }

    case 'mkdir': {
      if (!args[0]) {
        yield line('mkdir: falta operando', err);
        break;
      }
      const name = args.join(' ');
      const target = resolvePath(cwd, name);
      if (nexFs.exists(target)) {
        yield line(`mkdir: no se puede crear '${name}': ya existe`, err);
      } else {
        await nexFs.mkdir(target);
        yield line(`Directorio creado: ${name}`, ok);
      }
      break;
    }

    case 'touch': {
      if (!args[0]) {
        yield line('touch: falta operando', err);
        break;
      }
      const target = resolvePath(cwd, args[0]);
      await nexFs.writeFile(target, '');
      yield line(`Archivo creado: ${args[0]}`, ok);
      break;
    }

    case 'rm':
    case 'rmdir':
    case 'del': {
      if (!args[0]) {
        yield line(`${command}: falta operando`, err);
        break;
      }
      const recursive = args.includes('-r') || args.includes('-rf') || args.includes('/s');
      const name = args.filter((a) => !a.startsWith('-') && a !== '/s')[0];
      const target = resolvePath(cwd, name);
      try {
        await nexFs.rm(target, { recursive: recursive || command === 'rm' });
        yield line(`Eliminado: ${name}`, ok);
      } catch (e) {
        // fallback id-based
        const item = files.find(
          (f) =>
            f.parentId === cwdId &&
            (f.name === name || `${f.name}.${f.ext}` === name),
        );
        if (item) {
          deleteItem(item.id);
          yield line(`Eliminado: ${name}`, ok);
        } else {
          yield line(
            `${command}: no se puede eliminar '${name}': ${e instanceof Error ? e.message : 'error'}`,
            err,
          );
        }
      }
      break;
    }

    case 'echo':
      yield line(args.join(' '));
      break;

    case 'pwd':
    case 'cd.':
      yield line(cwd);
      break;

    case 'whoami':
      yield line(`${userName.toLowerCase()}@nexos`);
      break;

    case 'uname':
      yield line('NEX OS 2.0.1278 x86_64 NEX-Kernel/5.15.0');
      break;

    case 'node':
    case 'node.exe':
      if (!args[0] || args[0] === '--version' || args[0] === '-v') {
        yield line('v20.15.0', ok);
      } else {
        yield line(`Running ${args[0]}...`, '#9ca3af');
        yield line('Process exited with code 0', '#9ca3af');
      }
      break;

    case 'which':
    case 'where': {
      const map: Record<string, string> = {
        node: 'C:\\Program Files\\nodejs\\node.exe',
        npm: 'C:\\Program Files\\nodejs\\npm.cmd',
        pnpm: 'C:\\Users\\User\\AppData\\Roaming\\npm\\pnpm.cmd',
        git: 'C:\\Program Files\\Git\\cmd\\git.exe',
      };
      const hit = map[args[0]];
      yield line(hit ?? `${args[0]} not found`, hit ? ok : err);
      break;
    }

    case 'env':
    case 'set':
      yield line('NODE_ENV=development');
      yield line('PATH=C:\\Program Files\\nodejs;C:\\Program Files\\Git\\cmd');
      yield line(`USER=${userName.toLowerCase()}`);
      yield line(`HOME=C:\\Users\\${userName}`);
      yield line('SHELL=/bin/bash');
      break;

    case 'cat':
    case 'type': {
      if (!args[0]) {
        yield line(`${command}: falta operando`, err);
        break;
      }
      const target = resolvePath(cwd, args[0]);
      try {
        const text = await nexFs.readText(target);
        if (!text) yield line('(archivo vacío)', '#9ca3af');
        else for (const l of text.split(/\r?\n/)) yield line(l);
      } catch {
        yield line(`${command}: ${args[0]}: No existe el archivo`, err);
      }
      break;
    }

    case 'ping': {
      const host = args[0] || '127.0.0.1';
      yield line(`PING ${host}: 56 data bytes`);
      for (let i = 0; i < 4; i++) {
        yield line(
          `64 bytes from ${host}: icmp_seq=${i} ttl=64 time=${(Math.random() * 3).toFixed(3)} ms`,
        );
      }
      yield line('');
      yield line(`--- ${host} ping statistics ---`);
      yield line('4 packets transmitted, 4 received, 0% packet loss');
      break;
    }

    case 'help': {
      yield line('Comandos disponibles:', '#60a5fa');
      yield line('');
      yield line('  Archivos   ls dir cd mkdir touch rm cp mv cat head tail wc grep find tree');
      yield line('  Sistema    pwd whoami uname date uptime hostname df du free ps top neofetch');
      yield line('  Red        ping ipconfig traceroute nslookup curl wget');
      yield line('  Apps       games tetris calc notepad explorer paint chrome code open <app>');
      yield line('  Fun        cowsay fortune sl cmatrix cal factor expr');
      yield line('  Runtime    node python env which clear help');
      yield line('');
      yield line('  npm <cmd>    Gestor npm (escribe package.json en el VFS)', ok);
      yield line('  pnpm <cmd>   Gestor pnpm', '#a78bfa');
      yield line('  git <cmd>    Git local (init/status/add/commit/log)', '#e2e8f0');
      yield line('  <app>.nex    Ejecuta un binario / community app', '#60a5fa');
      break;
    }

    case '':
      break;

    default: {
      const handled = yield* runExtraCommand(command, args, {
        files,
        nexFs,
        cwd,
        cwdId,
        userName,
        flavor,
      });
      if (handled) break;
      const exe = resolveExecutable(command, files);
      if (exe) {
        yield line(`Iniciando ${exe.title}...`, '#60a5fa');
        yield { type: 'open', appId: exe.appId, title: exe.title };
      } else {
        yield line(
          flavor === 'bash'
            ? `bash: ${command}: command not found`
            : `'${command}' no se reconoce como un comando interno o externo.`,
          err,
        );
        yield line(`Escribe 'help' para ver los comandos disponibles.`, '#9ca3af');
      }
    }
  }

  // silence unused (createFolder/createFile kept for API parity / future)
  void createFolder;
  void createFile;
}

export type { GitService };
