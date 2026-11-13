import { basename, dirname, resolvePath } from '../fs/paths';
import { displayName, findByPath } from '../fs/vfsBridge';
import type { FileItem } from '../../context/FileSystemContext';
import type { NexFs } from '../fs';

type ShellEvent =
  | { type: 'line'; text: string; color?: string }
  | { type: 'open'; appId: string; title: string };

type ExtraDeps = {
  files: FileItem[];
  nexFs: NexFs;
  cwd: string;
  cwdId: string;
  userName: string;
  flavor: 'bash' | 'cmd';
};

function line(text: string, color?: string): ShellEvent {
  return { type: 'line', text, color };
}

const FORTUNES = [
  'NEX OS: el escritorio cabe en una pestaña.',
  'Si compila en el celular, es un feature.',
  'git commit -m "funciona en mi máquina" — NEX edition.',
  'El kernel 5.15.0 de NEX es 40% neón, 60% fe.',
  'Ctrl+Alt+R abre Ejecutar. El celular abre el launcher.',
  'Un .nex al día mantiene al task manager contento.',
  'No es un bug, es un easter egg sin documentar.',
  'whoami: alguien que todavía no cerró las 12 ventanas.',
];

const APP_LAUNCHERS: Record<string, { appId: string; title: string }> = {
  tetris: { appId: 'tetris', title: 'Tetris' },
  calc: { appId: 'calculator', title: 'Calculadora' },
  calculator: { appId: 'calculator', title: 'Calculadora' },
  notepad: { appId: 'notepad', title: 'Bloc de notas' },
  explorer: { appId: 'file-explorer', title: 'Explorador de archivos' },
  files: { appId: 'file-explorer', title: 'Explorador de archivos' },
  paint: { appId: 'paint', title: 'Paint' },
  settings: { appId: 'settings', title: 'Configuración' },
  chrome: { appId: 'chrome', title: 'Google Chrome' },
  browser: { appId: 'chrome', title: 'Navegador' },
  code: { appId: 'vscode', title: 'NEX Code' },
  vscode: { appId: 'vscode', title: 'NEX Code' },
  clock: { appId: 'clock', title: 'Reloj' },
  photos: { appId: 'photos', title: 'Fotos' },
  store: { appId: 'nex-store', title: 'NEX Store' },
  games: { appId: 'games', title: 'Games' },
};

function walkFiles(files: FileItem[], rootId: string, prefix: string): { path: string; item: FileItem }[] {
  const out: { path: string; item: FileItem }[] = [];
  const kids = files.filter((f) => f.parentId === rootId);
  for (const f of kids) {
    const name = displayName(f);
    const path = prefix ? `${prefix}\\${name}` : name;
    out.push({ path, item: f });
    if (f.type !== 'file') out.push(...walkFiles(files, f.id, path));
  }
  return out;
}

function hashText(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function launcherFor(command: string) {
  return APP_LAUNCHERS[command] ?? null;
}

export async function* runExtraCommand(
  command: string,
  args: string[],
  deps: ExtraDeps,
): AsyncGenerator<ShellEvent, boolean> {
  const { files, nexFs, cwd, cwdId, userName, flavor } = deps;
  const err = '#f87171';
  const ok = '#4ade80';
  const dim = '#9ca3af';
  const acc = '#60a5fa';

  const launch = launcherFor(command);
  if (launch) {
    yield line(`Iniciando ${launch.title}...`, acc);
    yield { type: 'open', appId: launch.appId, title: launch.title };
    return true;
  }

  switch (command) {
    case 'date':
      yield line(new Date().toString());
      return true;

    case 'time':
      yield line(new Date().toLocaleTimeString());
      return true;

    case 'hostname':
      yield line('NEX-NODE-01');
      return true;

    case 'uptime': {
      const sec = Math.floor(performance.now() / 1000);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      yield line(`up ${h}h ${m}m ${s}s · load 0.${Math.floor(Math.random() * 40)} 0.${Math.floor(Math.random() * 30)}`);
      return true;
    }

    case 'id':
      yield line(`uid=1000(${userName.toLowerCase()}) gid=1000(nex) groups=1000(nex),27(sudo)`);
      return true;

    case 'ver':
    case 'version':
      yield line('NEX OS [Version 2.0.1278]');
      return true;

    case 'who':
    case 'users':
      yield line(`${userName.toLowerCase()}    console    ${new Date().toLocaleTimeString()}`);
      return true;

    case 'df':
      yield line('Filesystem     Size  Used Avail Use% Mounted on');
      yield line('C:             256G   42G  214G  17% C:\\');
      yield line('nexfs          2.0G  128M  1.9G   7% /nex');
      return true;

    case 'du': {
      const kids = files.filter((f) => f.parentId === cwdId);
      if (!kids.length) {
        yield line('0\t.');
        return true;
      }
      for (const f of kids) {
        yield line(`${(f.size || '4.0K').toString().padStart(8)}  ${displayName(f)}`);
      }
      return true;
    }

    case 'free':
      yield line('              total        used        free');
      yield line('Mem:         16384        4820       11564');
      yield line('Swap:         4096           0        4096');
      return true;

    case 'ps':
    case 'tasklist':
      yield line('PID   TTY      TIME  CMD');
      yield line('  1   ?    00:00:01  nex-init');
      yield line(' 42   pts/0 00:00:00  bash');
      yield line('128   ?    00:00:08  nex-wm');
      yield line('256   ?    00:00:03  nex-runtime');
      return true;

    case 'top':
      yield line('top - NEX Kernel 5.15.0 · 2 cores');
      yield line('%CPU  12.4   %MEM  29.4');
      yield line('PID  USER   %CPU  COMMAND');
      yield line('128  nex    6.1   nex-wm');
      yield line('256  nex    3.2   nex-runtime');
      return true;

    case 'lscpu':
      yield line('Architecture:        x86_64');
      yield line('CPU(s):              2');
      yield line('Model name:          NEX Virtual CPU @ 2.40GHz');
      yield line('Hypervisor:          NEX Runtime');
      return true;

    case 'ipconfig':
    case 'ifconfig':
    case 'ip':
      yield line('nex0: flags=4163<UP,BROADCAST,RUNNING>  mtu 1500');
      yield line('        inet 10.0.0.42  netmask 255.255.255.0');
      yield line('        ether 4e:45:58:00:00:01');
      return true;

    case 'nslookup':
    case 'dig': {
      const host = args[0] || 'nexos.local';
      yield line(`Server:  1.1.1.1`);
      yield line(`Name:    ${host}`);
      yield line('Address: 10.0.0.42');
      return true;
    }

    case 'traceroute':
    case 'tracert': {
      const host = args[0] || '1.1.1.1';
      yield line(`traceroute to ${host}, 8 hops max`);
      yield line(' 1  nex-gw (10.0.0.1)  1.1 ms');
      yield line(' 2  core.nex (10.8.0.1)  4.2 ms');
      yield line(` 3  ${host}  12.8 ms`);
      return true;
    }

    case 'sleep': {
      const sec = Math.min(8, Math.max(0, Number(args[0]) || 1));
      await new Promise((r) => setTimeout(r, sec * 1000));
      return true;
    }

    case 'seq': {
      const nums = args.map(Number).filter((n) => !Number.isNaN(n));
      let start = 1;
      let end = nums[0] ?? 1;
      let step = 1;
      if (nums.length === 2) {
        start = nums[0];
        end = nums[1];
      } else if (nums.length >= 3) {
        start = nums[0];
        step = nums[1] || 1;
        end = nums[2];
      }
      const max = 200;
      let n = 0;
      for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
        yield line(String(i));
        if (++n >= max) break;
      }
      return true;
    }

    case 'yes': {
      const word = args.join(' ') || 'y';
      for (let i = 0; i < 12; i++) yield line(word);
      yield line('(nex: yes limitado a 12 líneas)', dim);
      return true;
    }

    case 'true':
      return true;

    case 'false':
      yield line('exit 1', err);
      return true;

    case 'basename':
      yield line(basename(resolvePath(cwd, args[0] || cwd)));
      return true;

    case 'dirname':
      yield line(dirname(resolvePath(cwd, args[0] || cwd)));
      return true;

    case 'printf':
      yield line(args.join(' ').replace(/\\n/g, '\n'));
      return true;

    case 'rev':
      yield line(args.join(' ').split('').reverse().join(''));
      return true;

    case 'factor': {
      let n = Math.abs(Math.floor(Number(args[0])));
      if (!n) {
        yield line('factor: falta un número', err);
        return true;
      }
      const parts: number[] = [];
      for (let d = 2; d * d <= n; d++) {
        while (n % d === 0) {
          parts.push(d);
          n /= d;
        }
      }
      if (n > 1) parts.push(n);
      yield line(`${args[0]}: ${parts.join(' ')}`);
      return true;
    }

    case 'expr': {
      const exp = args.join(' ');
      if (!/^[\d\s+\-*/().]+$/.test(exp)) {
        yield line('expr: expresión no numérica', err);
        return true;
      }
      try {
        const val = Function(`"use strict"; return (${exp})`)();
        yield line(String(val));
      } catch {
        yield line('expr: error de sintaxis', err);
      }
      return true;
    }

    case 'python':
    case 'python3':
    case 'py':
      if (!args[0] || args[0] === '--version' || args[0] === '-V') {
        yield line('Python 3.12.4 (NEX Runtime)');
      } else if (args[0] === '-c') {
        yield line('NEX Python: solo --version en este runtime', dim);
      } else {
        yield line(`python: no se puede abrir '${args[0]}'`, err);
      }
      return true;

    case 'chmod':
    case 'chown':
      yield line(`${command}: OK (NexFs ignora permisos reales)`, dim);
      return true;

    case 'sudo':
      yield line(`${userName.toLowerCase()} no está en el archivo sudoers. Este incidente se reportará.`, err);
      return true;

    case 'exit':
    case 'logout':
      yield line('Sesión de terminal activa. Cerrá la ventana para salir.', dim);
      return true;

    case 'history':
      yield line('Usá ↑ / ↓ para recorrer el historial de esta sesión.', dim);
      return true;

    case 'man': {
      const topic = (args[0] || 'help').toLowerCase();
      yield line(`NEX-MAN(1)                    ${topic}`, acc);
      yield line('');
      yield line('Escribí help para el índice de comandos del shell NEX.');
      return true;
    }

    case 'alias':
      yield line('ll="ls"');
      yield line('cls="clear"');
      yield line('tetris="start tetris"');
      return true;

    case 'export':
    case 'printenv':
      yield line('NODE_ENV=development');
      yield line(`USER=${userName.toLowerCase()}`);
      yield line(`HOME=C:\\Users\\${userName}`);
      yield line('SHELL=/bin/bash');
      yield line('NEX_OS=2.0.1278');
      return true;

    case 'cal': {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const first = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      yield line(now.toLocaleString('es', { month: 'long', year: 'numeric' }));
      yield line('do lu ma mi ju vi sa');
      let row = '   '.repeat(first);
      for (let d = 1; d <= days; d++) {
        row += String(d).padStart(2, ' ') + ' ';
        if ((first + d) % 7 === 0 || d === days) {
          yield line(row.trimEnd());
          row = '';
        }
      }
      return true;
    }

    case 'head':
    case 'tail': {
      if (!args[0]) {
        yield line(`${command}: falta archivo`, err);
        return true;
      }
      const nFlag = args.find((a) => a.startsWith('-') && /\d/.test(a));
      const n = Math.min(80, Math.max(1, Number(nFlag?.replace('-', '')) || 10));
      const file = args.find((a) => !a.startsWith('-')) || '';
      try {
        const text = await nexFs.readText(resolvePath(cwd, file));
        const lines = text.split(/\r?\n/);
        const slice = command === 'head' ? lines.slice(0, n) : lines.slice(-n);
        for (const l of slice) yield line(l);
      } catch {
        yield line(`${command}: ${file}: No existe el archivo`, err);
      }
      return true;
    }

    case 'wc': {
      if (!args[0]) {
        yield line('wc: falta archivo', err);
        return true;
      }
      try {
        const text = await nexFs.readText(resolvePath(cwd, args[0]));
        const lines = text.length ? text.split(/\r?\n/).length : 0;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        yield line(`${String(lines).padStart(8)} ${String(words).padStart(8)} ${String(text.length).padStart(8)} ${args[0]}`);
      } catch {
        yield line(`wc: ${args[0]}: No existe el archivo`, err);
      }
      return true;
    }

    case 'grep': {
      const pat = args[0];
      const file = args[1];
      if (!pat || !file) {
        yield line('uso: grep <patrón> <archivo>', err);
        return true;
      }
      try {
        const text = await nexFs.readText(resolvePath(cwd, file));
        const re = new RegExp(pat, 'i');
        let hits = 0;
        for (const l of text.split(/\r?\n/)) {
          if (re.test(l)) {
            yield line(l);
            hits += 1;
          }
        }
        if (!hits) yield line('(sin coincidencias)', dim);
      } catch {
        yield line(`grep: ${file}: No existe el archivo`, err);
      }
      return true;
    }

    case 'find': {
      const root = args[0] && !args[0].startsWith('-') ? args[0] : '.';
      const nameIdx = args.findIndex((a) => a === '-name');
      const needle = (nameIdx >= 0 ? args[nameIdx + 1] : '').replace(/\*/g, '').toLowerCase();
      const start = root === '.' ? cwdId : findByPath(files, resolvePath(cwd, root))?.id;
      if (!start) {
        yield line('find: ruta no encontrada', err);
        return true;
      }
      const items = walkFiles(files, start, root === '.' ? '.' : root);
      for (const { path, item } of items) {
        const name = displayName(item).toLowerCase();
        if (!needle || name.includes(needle)) yield line(path);
      }
      return true;
    }

    case 'tree': {
      const walk = (id: string, prefix: string) => {
        const kids = files.filter((f) => f.parentId === id);
        const events: ShellEvent[] = [];
        kids.forEach((f, i) => {
          const last = i === kids.length - 1;
          const branch = last ? '└── ' : '├── ';
          events.push(line(`${prefix}${branch}${displayName(f)}`, f.type === 'file' ? undefined : '#fbbf24'));
          if (f.type !== 'file') {
            events.push(...walk(f.id, prefix + (last ? '    ' : '│   ')));
          }
        });
        return events;
      };
      yield line(cwd, acc);
      for (const ev of walk(cwdId, '')) yield ev;
      return true;
    }

    case 'cp':
    case 'copy': {
      if (args.length < 2) {
        yield line(`uso: ${command} <origen> <destino>`, err);
        return true;
      }
      const src = resolvePath(cwd, args[0]);
      let dest = resolvePath(cwd, args[1]);
      try {
        const destItem = findByPath(files, dest);
        if (destItem && destItem.type !== 'file') {
          dest = resolvePath(dest, basename(src));
        }
        const text = await nexFs.readText(src);
        await nexFs.writeFile(dest, text);
        yield line(`Copiado: ${args[0]} → ${args[1]}`, ok);
      } catch (e) {
        yield line(`${command}: ${e instanceof Error ? e.message : 'error'}`, err);
      }
      return true;
    }

    case 'mv':
    case 'move':
    case 'ren':
    case 'rename': {
      if (args.length < 2) {
        yield line(`uso: ${command} <origen> <destino>`, err);
        return true;
      }
      try {
        await nexFs.rename(resolvePath(cwd, args[0]), resolvePath(cwd, args[1]));
        yield line(`Movido: ${args[0]} → ${args[1]}`, ok);
      } catch (e) {
        yield line(`${command}: ${e instanceof Error ? e.message : 'error'}`, err);
      }
      return true;
    }

    case 'md5sum':
    case 'sha1sum': {
      if (!args[0]) {
        yield line(`${command}: falta archivo`, err);
        return true;
      }
      try {
        const text = await nexFs.readText(resolvePath(cwd, args[0]));
        yield line(`${hashText(text)}  ${args[0]}`);
      } catch {
        yield line(`${command}: ${args[0]}: No existe el archivo`, err);
      }
      return true;
    }

    case 'base64': {
      if (!args[0] || args[0] === '-') {
        yield line('uso: base64 <archivo> | base64 -d <archivo>', err);
        return true;
      }
      const decode = args[0] === '-d';
      const file = decode ? args[1] : args[0];
      if (!file) {
        yield line('base64: falta archivo', err);
        return true;
      }
      try {
        const text = await nexFs.readText(resolvePath(cwd, file));
        if (decode) yield line(atob(text.replace(/\s/g, '')));
        else yield line(btoa(text));
      } catch {
        yield line(`base64: ${file}: error`, err);
      }
      return true;
    }

    case 'curl':
    case 'wget': {
      const url = args.find((a) => /^https?:\/\//i.test(a));
      if (!url) {
        yield line(`uso: ${command} https://ejemplo.com`, err);
        return true;
      }
      try {
        const res = await fetch(url);
        const text = await res.text();
        yield line(`HTTP ${res.status} ${res.statusText}`, acc);
        for (const l of text.split(/\r?\n/).slice(0, 40)) yield line(l);
        if (text.split(/\r?\n/).length > 40) yield line('… (primeras 40 líneas)', dim);
      } catch {
        yield line(`${command}: no se pudo conectar (CORS o red)`, err);
      }
      return true;
    }

    case 'neofetch':
    case 'screenfetch': {
      const art = [
        '      ████      ',
        '   ██      ██   ',
        '  ██  NEX   ██  ',
        '  ██   OS   ██  ',
        '   ██      ██   ',
        '      ████      ',
      ];
      const info = [
        `${userName.toLowerCase()}@nexos`,
        '----------------',
        'OS: NEX OS 2.0.1278',
        'Kernel: NEX-Kernel/5.15.0',
        'Shell: nex-sh',
        `WM: ${flavor === 'bash' ? 'NEX Desktop' : 'cmd.exe'}`,
        'Terminal: NEX Terminal',
        'CPU: NEX Virtual @ 2.40GHz (2)',
        'Memory: 4820MiB / 16384MiB',
      ];
      const rows = Math.max(art.length, info.length);
      for (let i = 0; i < rows; i++) {
        const a = (art[i] || '').padEnd(18);
        yield line(`${a}${info[i] || ''}`, i < 6 ? '#22d3ee' : undefined);
      }
      return true;
    }

    case 'cowsay': {
      const msg = args.join(' ') || 'NEX OS';
      const w = Math.min(40, Math.max(msg.length, 4));
      yield line(` ${'_'.repeat(w + 2)}`);
      yield line(`< ${msg.padEnd(w)} >`);
      yield line(` ${'-'.repeat(w + 2)}`);
      yield line('        \\   ^__^');
      yield line('         \\  (oo)\\_______');
      yield line('            (__)\\       )\\/\\');
      yield line('                ||----w |');
      yield line('                ||     ||');
      return true;
    }

    case 'fortune':
      yield line(FORTUNES[Math.floor(Math.random() * FORTUNES.length)], '#fbbf24');
      return true;

    case 'sl':
      yield line('      ====        ________                ___________', acc);
      yield line('  _D _|  |_______/        \\__I_I_____===__|_________|', acc);
      yield line('   |(_)---  |   H\\________/ |   |        =|___ ___|  ', acc);
      yield line('   /     |  |   H  |  |     |   |         ||_| |_||  ', acc);
      yield line('  |      |  |   H  |__--------------------| [___] |  ', acc);
      yield line('  | ________|___H__/__|_____/[][]~\\_______|       |  ', acc);
      yield line('  |/ |   |-----------I_____I [][] []  D   |=======|__', acc);
      return true;

    case 'cmatrix':
    case 'matrix':
      for (let i = 0; i < 8; i++) {
        let row = '';
        for (let j = 0; j < 48; j++) row += Math.random() > 0.55 ? '01'[j % 2] : ' ';
        yield line(row, '#4ade80');
      }
      return true;

    case 'open': {
      const q = (args[0] || '').toLowerCase();
      const hit = launcherFor(q);
      if (hit) {
        yield line(`Iniciando ${hit.title}...`, acc);
        yield { type: 'open', appId: hit.appId, title: hit.title };
      } else {
        yield line(`open: no sé abrir '${args[0] || ''}'`, err);
      }
      return true;
    }

    default:
      return false;
  }
}
