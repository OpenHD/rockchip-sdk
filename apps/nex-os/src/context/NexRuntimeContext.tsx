import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import { useNexFs } from './FileSystemContext';
import { createGitService } from '../runtime/git/gitService';
import { writeNodeModuleStub, writePackageJson, readProjectFromFs } from '../runtime/npm/persist';
import { resolveExecutable } from '../runtime/resolveExecutable';
import { normalizePath } from '../runtime/fs/paths';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NexPackage {
  name: string;
  version: string;
  description?: string;
  isDev?: boolean;
  size?: string;
}

export interface NexProcess {
  pid: number;
  name: string;
  cmd: string;
  startedAt: string;
  status: 'running' | 'done' | 'error';
}

export interface NexProject {
  name: string;
  version: string;
  description?: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

import type { NexExecutable } from '../runtime/nexRegistry';
export type { NexExecutable } from '../runtime/nexRegistry';
export { NEX_EXECUTABLE_REGISTRY } from '../runtime/nexRegistry';

// Well-known npm/pnpm packages with realistic metadata
export const KNOWN_PACKAGES: Record<string, Omit<NexPackage, 'name'>> = {
  'react':           { version: '18.3.1',  description: 'React is a JavaScript library for building user interfaces', size: '7.2 kB' },
  'react-dom':       { version: '18.3.1',  description: 'React package for working with the DOM', size: '130 kB' },
  'vue':             { version: '3.4.31',  description: 'The progressive JavaScript framework', size: '622 kB' },
  'express':         { version: '4.19.2',  description: 'Fast, unopinionated, minimalist web framework', size: '214 kB' },
  'next':            { version: '14.2.4',  description: 'The React Framework for the Web', size: '98.9 MB' },
  'typescript':      { version: '5.5.2',   description: 'TypeScript is a language for application-scale JavaScript', size: '68.7 MB' },
  'vite':            { version: '5.3.1',   description: 'Next generation frontend tooling', size: '4.6 MB' },
  'axios':           { version: '1.7.2',   description: 'Promise based HTTP client', size: '472 kB' },
  'lodash':          { version: '4.17.21', description: 'Lodash modular utilities', size: '1.4 MB' },
  'tailwindcss':     { version: '3.4.4',   description: 'A utility-first CSS framework', size: '5.3 MB' },
  'framer-motion':   { version: '11.2.11', description: 'A production-ready motion library for React', size: '6.1 MB' },
  'zustand':         { version: '4.5.4',   description: 'Bear necessities for state management in React', size: '91.6 kB' },
  'prisma':          { version: '5.16.0',  description: 'Next-generation ORM for Node.js', size: '24.1 MB' },
  'zod':             { version: '3.23.8',  description: 'TypeScript-first schema declaration and validation', size: '693 kB' },
  'eslint':          { version: '9.5.0',   description: 'An AST-based pattern checker for JavaScript', size: '8.2 MB' },
  'webpack':         { version: '5.92.0',  description: 'Packs CommonJs/AMD modules for the browser', size: '18.4 MB' },
  'babel':           { version: '7.24.7',  description: 'Babel compiler core', size: '12.1 MB' },
  '@babel/core':     { version: '7.24.7',  description: 'Babel compiler core', size: '12.1 MB' },
  'jest':            { version: '29.7.0',  description: 'Delightful JavaScript Testing', size: '8.7 MB' },
  'prettier':        { version: '3.3.2',   description: 'Prettier is an opinionated code formatter', size: '8.5 MB' },
  'nodemon':         { version: '3.1.4',   description: 'Simple monitor script for use during development', size: '3.2 MB' },
  'dotenv':          { version: '16.4.5',  description: 'Loads environment variables from .env', size: '34.9 kB' },
  'cors':            { version: '2.8.5',   description: 'Node.js CORS middleware', size: '17.9 kB' },
  'mongoose':        { version: '8.4.3',   description: 'Mongoose MongoDB ODM', size: '5.1 MB' },
  'socket.io':       { version: '4.7.5',   description: 'Realtime application framework', size: '4.9 MB' },
  'sharp':           { version: '0.33.4',  description: 'High performance Node.js image processing', size: '14.8 MB' },
  'uuid':            { version: '10.0.0',  description: 'RFC4122 UUIDs', size: '32.5 kB' },
  'dayjs':           { version: '1.11.11', description: '2KB immutable date-time library', size: '84.9 kB' },
  'clsx':            { version: '2.1.1',   description: 'A tiny utility for constructing className strings', size: '7.3 kB' },
  'lucide-react':    { version: '0.396.0', description: 'Lucide icon library for React', size: '31.2 MB' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface NexRuntimeContextType {
  packages: Record<string, NexPackage[]>;
  projects: Record<string, NexProject>;
  processes: NexProcess[];

  npmRun: (args: string[], cwd: string) => AsyncGenerator<string>;
  pnpmRun: (args: string[], cwd: string) => AsyncGenerator<string>;
  gitRun: (args: string[], cwd: string) => AsyncGenerator<string>;

  resolveNex: (nameOrPath: string) => NexExecutable | null;

  getPackages: (cwd: string) => NexPackage[];
  getProject: (cwd: string) => NexProject | null;

  spawnProcess: (name: string, cmd: string) => number;
  endProcess: (pid: number, status?: 'done' | 'error') => void;
  listProcesses: () => NexProcess[];
}

const NexRuntimeContext = createContext<NexRuntimeContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

const resolvePackageMeta = (name: string): Omit<NexPackage, 'name'> => {
  return KNOWN_PACKAGES[name] ?? {
    version: `1.0.${Math.floor(Math.random() * 20)}`,
    description: `Package ${name}`,
    size: `${(Math.random() * 500 + 10).toFixed(1)} kB`,
  };
};

const npmVersion = '10.8.1';
const nodeVersion = 'v20.15.0';
const pnpmVersion = '9.5.0';

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const NexRuntimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const nexFs = useNexFs();
  const gitService = useMemo(
    () => createGitService(nexFs, { name: 'NEX User', email: 'nex@local' }),
    [nexFs],
  );

  const [packages, setPackages] = useState<Record<string, NexPackage[]>>({});
  const [projects, setProjects] = useState<Record<string, NexProject>>({});
  const [processes, setProcesses] = useState<NexProcess[]>([]);
  const pidCounter = useRef(1000);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  const spawnProcess = useCallback((name: string, cmd: string) => {
    const pid = pidCounter.current++;
    const proc: NexProcess = {
      pid,
      name,
      cmd,
      startedAt: new Date().toISOString(),
      status: 'running',
    };
    setProcesses((prev) => [...prev, proc]);
    return pid;
  }, []);

  const endProcess = useCallback((pid: number, status: 'done' | 'error' = 'done') => {
    setProcesses((prev) =>
      prev.map((p) => (p.pid === pid ? { ...p, status } : p)),
    );
  }, []);

  const listProcesses = useCallback(() => processes, [processes]);

  // ── helpers ──────────────────────────────────────────────────────────────

  const addPkg = useCallback((cwd: string, pkg: NexPackage) => {
    setPackages(prev => {
      const existing = prev[cwd] ?? [];
      const filtered = existing.filter(p => p.name !== pkg.name);
      return { ...prev, [cwd]: [...filtered, pkg] };
    });
  }, []);

  const removePkg = useCallback((cwd: string, name: string) => {
    setPackages(prev => ({
      ...prev,
      [cwd]: (prev[cwd] ?? []).filter(p => p.name !== name),
    }));
  }, []);

  const getPackages = useCallback((cwd: string): NexPackage[] => {
    return packages[cwd] ?? [];
  }, [packages]);

  const getProject = useCallback((cwd: string): NexProject | null => {
    return projects[cwd] ?? null;
  }, [projects]);

  const initProject = useCallback(async (cwd: string, name: string) => {
    const key = normalizePath(cwd);
    const proj: NexProject = projectsRef.current[key] ?? {
      name,
      version: '1.0.0',
      description: '',
      scripts: {
        test: 'echo "Error: no test specified" && exit 1',
        dev: 'vite',
        build: 'vite build',
      },
      dependencies: {},
      devDependencies: {},
    };
    setProjects((prev) => ({ ...prev, [key]: proj }));
    await writePackageJson(nexFs, key, proj);
    await nexFs.writeFile(
      `${key}\\index.js`,
      `console.log('Hello from ${name}');\n`,
    );
  }, [nexFs]);

  const addProjectDep = useCallback(async (cwd: string, pkg: NexPackage, isDev = false) => {
    const key = normalizePath(cwd);
    let proj = projectsRef.current[key];
    if (!proj) {
      const fromDisk = await readProjectFromFs(nexFs, key);
      proj = fromDisk ?? {
        name: key.split('\\').pop() || 'project',
        version: '1.0.0',
        description: '',
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
        dependencies: {},
        devDependencies: {},
      };
    }
    const depKey = isDev ? 'devDependencies' : 'dependencies';
    const next: NexProject = {
      ...proj,
      [depKey]: { ...proj[depKey], [pkg.name]: `^${pkg.version}` },
    };
    setProjects((prev) => ({ ...prev, [key]: next }));
    await writePackageJson(nexFs, key, next);
    await writeNodeModuleStub(nexFs, key, pkg);
  }, [nexFs]);

  // ── npm generator ────────────────────────────────────────────────────────

  async function* npmRun(args: string[], cwd: string): AsyncGenerator<string> {
    const sub = args[0]?.toLowerCase() ?? '';
    const rest = args.slice(1);

    switch (sub) {
      // ── npm --version / -v ─────────────────────────────────────────────
      case '--version':
      case '-v':
        yield npmVersion;
        break;

      // ── npm init ──────────────────────────────────────────────────────
      case 'init': {
        const folderName = cwd.split('\\').pop() ?? 'project';
        yield 'This utility will walk you through creating a package.json file.';
        yield 'It only covers the most common items, and tries to guess sensible defaults.';
        yield '';
        yield `package name: (${folderName}) `;
        await sleep(200);
        yield `version: (1.0.0) `;
        await sleep(150);
        yield `description: `;
        await sleep(150);
        yield `entry point: (index.js) `;
        await sleep(150);
        yield `test command: `;
        await sleep(150);
        yield `git repository: `;
        await sleep(150);
        yield `keywords: `;
        await sleep(150);
        yield `author: `;
        await sleep(150);
        yield `license: (ISC) `;
        await sleep(300);
        yield '';
        yield 'About to write to ' + cwd + '\\package.json:';
        yield '';
        const proj: NexProject = {
          name: folderName,
          version: '1.0.0',
          description: '',
          scripts: { test: 'echo "Error: no test specified" && exit 1' },
          dependencies: {},
          devDependencies: {},
        };
        yield JSON.stringify(proj, null, 2);
        yield '';
        yield 'Is this OK? (yes) ';
        await sleep(200);
        const pid = spawnProcess('npm', `npm init (${folderName})`);
        await initProject(cwd, folderName);
        endProcess(pid);
        break;
      }

      // ── npm install / i ────────────────────────────────────────────────
      case 'install':
      case 'i':
      case 'add': {
        if (rest.length === 0) {
          // npm install (no args) — install from package.json
          const proj = getProject(cwd);
          if (!proj) {
            yield 'npm warn saveError ENOENT: no such file or directory, open \'' + cwd + '\\package.json\'';
            yield 'npm notice created a lockfile as package-lock.json. You should commit this file.';
            yield 'npm warn You have not listed your package in the "files" field of package.json.';
            break;
          }
          const allDeps = { ...proj.dependencies, ...proj.devDependencies };
          const depNames = Object.keys(allDeps);
          if (depNames.length === 0) {
            yield 'up to date, audited 1 package in 512ms';
            yield '';
            yield 'found 0 vulnerabilities';
            break;
          }
          yield '';
          const pid = spawnProcess('npm', 'npm install');
          for (const name of depNames) {
            const meta = resolvePackageMeta(name);
            await sleep(Math.random() * 300 + 100);
            yield `added ${name}@${meta.version}`;
            const pkg = { name, ...meta };
            addPkg(cwd, pkg);
            await writeNodeModuleStub(nexFs, cwd, pkg);
          }
          endProcess(pid);
          await sleep(400);
          yield '';
          yield `added ${depNames.length} packages, and audited ${depNames.length + 1} packages in ${(Math.random() * 3 + 0.5).toFixed(1)}s`;
          yield '';
          yield `${Math.floor(Math.random() * 5)} packages are looking for funding`;
          yield '  run \`npm fund\` for details';
          yield '';
          yield 'found 0 vulnerabilities';
          break;
        }

        // npm install <pkg> [<pkg2>...]
        const isDev = rest.includes('--save-dev') || rest.includes('-D');
        const pkgNames = rest.filter(r => !r.startsWith('-'));
        yield '';

        const installed: NexPackage[] = [];
        for (const name of pkgNames) {
          const meta = resolvePackageMeta(name);
          yield `npm warn deprecated ${name}@${meta.version}: This version is no longer supported.`.replace(
            // Only show deprecation notice ~30% of the time
            /npm warn.*/, Math.random() > 0.3 ? '' : `npm warn deprecated old-package: Use ${name} instead`
          );
          await sleep(Math.random() * 600 + 200);
          
          const pkg: NexPackage = { name, ...meta, isDev };
          installed.push(pkg);
          addPkg(cwd, pkg);
          await addProjectDep(cwd, pkg, isDev);
        }

        await sleep(300);
        yield '';

        const totalAdded = installed.length + Math.floor(Math.random() * 8 + 1);
        const auditTotal = totalAdded + 1;
        const timeS = (Math.random() * 4 + 0.8).toFixed(1);

        yield `added ${totalAdded} package${totalAdded > 1 ? 's' : ''}, and audited ${auditTotal} packages in ${timeS}s`;
        yield '';
        yield `${Math.floor(Math.random() * 5 + 1)} packages are looking for funding`;
        yield `  run \`npm fund\` for details`;
        yield '';
        yield `found 0 vulnerabilities`;
        break;
      }

      // ── npm uninstall / remove / rm / un ──────────────────────────────
      case 'uninstall':
      case 'remove':
      case 'rm':
      case 'un': {
        if (rest.length === 0) {
          yield 'npm error Usage: npm uninstall <package> [<package> ...]';
          break;
        }
        for (const name of rest.filter(r => !r.startsWith('-'))) {
          removePkg(cwd, name);
          yield '';
          yield `removed 1 package, and audited 1 package in 289ms`;
          yield '';
          yield `found 0 vulnerabilities`;
        }
        break;
      }

      // ── npm run ────────────────────────────────────────────────────────
      case 'run': {
        const scriptName = rest[0];
        if (!scriptName) {
          yield 'Lifecycle scripts included in project:';
          const proj = getProject(cwd);
          if (proj) {
            for (const [s, cmd] of Object.entries(proj.scripts)) {
              yield `  ${s}`;
              yield `    ${cmd}`;
            }
          } else {
            yield '  (no scripts found — run npm init first)';
          }
          break;
        }
        const proj = getProject(cwd);
        const script = proj?.scripts[scriptName];
        if (!script) {
          yield `npm error Missing script: "${scriptName}"`;
          yield '';
          yield `npm error To see a list of scripts, run:`;
          yield `npm error   npm run`;
          break;
        }
        yield '';
        yield `> ${proj?.name ?? 'project'}@${proj?.version ?? '1.0.0'} ${scriptName}`;
        yield `> ${script}`;
        yield '';

        // Simulate common dev scripts
        if (scriptName === 'dev' || scriptName === 'start') {
          await sleep(500);
          yield `  VITE v5.3.1  ready in 312 ms`;
          yield '';
          yield `  ➜  Local:   http://localhost:5173/`;
          yield `  ➜  Network: http://192.168.1.105:5173/`;
          yield `  ➜  press h + enter to show help`;
        } else if (scriptName === 'build') {
          await sleep(400);
          yield `vite v5.3.1 building for production...`;
          await sleep(600);
          yield `✓ 42 modules transformed.`;
          await sleep(300);
          yield `dist/index.html                  0.46 kB │ gzip:  0.30 kB`;
          yield `dist/assets/index-BNFqPHx3.css  32.74 kB │ gzip:  5.30 kB`;
          yield `dist/assets/index-Dj2HLSUk.js  147.23 kB │ gzip: 47.60 kB`;
          await sleep(200);
          yield `✓ built in 1.45s`;
        } else if (scriptName === 'test') {
          await sleep(300);
          yield `PASS src/App.test.tsx`;
          yield `  ✓ renders without crashing (23ms)`;
          yield '';
          yield `Test Suites: 1 passed, 1 total`;
          yield `Tests:       1 passed, 1 total`;
          yield `Snapshots:   0 total`;
          yield `Time:        1.234s`;
        } else {
          await sleep(200);
          yield script;
        }
        break;
      }

      // ── npm list / ls ─────────────────────────────────────────────────
      case 'list':
      case 'ls': {
        const proj = getProject(cwd);
        const pkgs = getPackages(cwd);
        const name = proj?.name ?? cwd.split('\\').pop() ?? 'project';
        const version = proj?.version ?? '1.0.0';
        yield `${name}@${version} ${cwd}`;
        if (pkgs.length === 0) {
          yield '└── (empty)';
        } else {
          for (let i = 0; i < pkgs.length; i++) {
            const p = pkgs[i];
            const isLast = i === pkgs.length - 1;
            yield `${isLast ? '└──' : '├──'} ${p.name}@${p.version}`;
          }
        }
        break;
      }

      // ── npm fund ──────────────────────────────────────────────────────
      case 'fund': {
        const pkgs = getPackages(cwd);
        yield `${cwd.split('\\').pop()}@1.0.0`;
        yield `└─┬ Funding`;
        const fundList = pkgs.slice(0, 3);
        for (const p of fundList) {
          yield `  ├── ${p.name}@${p.version}`;
          yield `  │   type: opencollective`;
          yield `  │   url: https://opencollective.com/${p.name}`;
        }
        break;
      }

      // ── npm audit ─────────────────────────────────────────────────────
      case 'audit': {
        await sleep(400);
        const pkgs = getPackages(cwd);
        yield `found 0 vulnerabilities in ${pkgs.length + 1} scanned packages`;
        break;
      }

      // ── npm cache clean ───────────────────────────────────────────────
      case 'cache': {
        if (rest[0] === 'clean' || rest[0] === 'clear') {
          await sleep(500);
          yield 'Cache cleaned successfully.';
        }
        break;
      }

      // ── npm --help / help ─────────────────────────────────────────────
      case '--help':
      case 'help':
      default: {
        if (sub && sub !== '--help' && sub !== 'help') {
          yield `npm error Unknown command: "${sub}"`;
          yield '';
          yield `npm error Did you mean one of these?`;
          yield `npm error     install`;
          yield `npm error     run`;
          yield `npm error     list`;
          yield '';
        }
        yield `npm <command>`;
        yield '';
        yield `Usage:`;
        yield '';
        yield `npm install       install all the dependencies in your project`;
        yield `npm install <foo> add the <foo> dependency to your project`;
        yield `npm init          create a package.json file`;
        yield `npm run <foo>     run the 'foo' package script`;
        yield `npm uninstall     remove a package`;
        yield `npm list          print all the packages and their dependencies`;
        yield `npm audit         check for known security issues`;
        yield `npm fund          retrieve funding information`;
        yield `npm cache clean   delete all data out of the cache folder`;
        yield '';
        yield `Specify configs in the ini-formatted file:`;
        yield `    C:\\Users\\User\\.npmrc`;
        yield `or on the command line via: npm <command> --key=value`;
        yield '';
        yield `npm@${npmVersion} (NEX OS Runtime)`;
        yield `node@${nodeVersion}`;
        break;
      }
    }
  }

  // ── pnpm generator ───────────────────────────────────────────────────────

  async function* pnpmRun(args: string[], cwd: string): AsyncGenerator<string> {
    const sub = args[0]?.toLowerCase() ?? '';
    const rest = args.slice(1);

    switch (sub) {
      case '--version':
      case '-v':
        yield pnpmVersion;
        break;

      // ── pnpm install ──────────────────────────────────────────────────
      case 'install':
      case 'i': {
        const proj = getProject(cwd);
        const deps = { ...proj?.dependencies ?? {}, ...proj?.devDependencies ?? {} };
        const depNames = Object.keys(deps);
        if (depNames.length === 0) {
          yield 'Already up to date';
          break;
        }
        yield 'Lockfile is up to date, resolution step is skipped';
        yield 'Progress: resolved 1, reused 0, downloaded 0, added 0';
        await sleep(200);
        for (const name of depNames) {
          const meta = resolvePackageMeta(name);
          await sleep(Math.random() * 200 + 80);
          addPkg(cwd, { name, ...meta });
        }
        yield `Progress: resolved ${depNames.length + 5}, reused ${depNames.length}, downloaded 0, added ${depNames.length}`;
        yield '';
        yield `dependencies:`;
        for (const name of depNames.slice(0, Math.min(depNames.length, 5))) {
          const meta = resolvePackageMeta(name);
          yield `+ ${name} ${meta.version}`;
        }
        yield '';
        yield `Done in ${(Math.random() * 2 + 0.3).toFixed(1)}s`;
        break;
      }

      // ── pnpm add ──────────────────────────────────────────────────────
      case 'add': {
        if (rest.length === 0) {
          yield 'Usage: pnpm add <pkg>';
          break;
        }
        const isDev = rest.includes('--save-dev') || rest.includes('-D');
        const pkgNames = rest.filter(r => !r.startsWith('-'));

        yield ' WARN  deprecated behaviour: pnpm v10 will now enforce strict package installs.';
        yield '';
        yield 'Packages: +' + pkgNames.length;
        yield '++' + '+'.repeat(pkgNames.length * 3);
        await sleep(300);

        for (const name of pkgNames) {
          const meta = resolvePackageMeta(name);
          await sleep(Math.random() * 400 + 150);
          yield `Progress: resolved ${Math.floor(Math.random() * 50 + 20)}, reused ${Math.floor(Math.random() * 10)}, downloaded ${pkgNames.indexOf(name) + 1}, added ${pkgNames.indexOf(name) + 1}`;
          const pkg: NexPackage = { name, ...meta, isDev };
          addPkg(cwd, pkg);
          const proj = getProject(cwd);
          if (proj) addProjectDep(cwd, pkg, isDev);
        }

        await sleep(200);
        yield '';
        yield 'dependencies:';
        for (const name of pkgNames) {
          const meta = resolvePackageMeta(name);
          yield `+ ${name} ${meta.version}`;
        }
        yield '';
        yield `Done in ${(Math.random() * 1.5 + 0.2).toFixed(1)}s`;
        break;
      }

      // ── pnpm remove ───────────────────────────────────────────────────
      case 'remove':
      case 'rm':
      case 'uninstall':
      case 'un': {
        for (const name of rest.filter(r => !r.startsWith('-'))) {
          removePkg(cwd, name);
          yield `Packages: -1`;
          yield `--`;
          yield `- ${name}`;
          yield '';
          yield `Done in 0.${Math.floor(Math.random() * 900 + 100)}s`;
        }
        break;
      }

      // ── pnpm run ──────────────────────────────────────────────────────
      case 'run': {
        const scriptName = rest[0];
        const proj = getProject(cwd);
        const script = proj?.scripts[scriptName];
        if (!script) {
          yield ` ERR_PNPM_NO_SCRIPT  Missing script: "${scriptName}"`;
          break;
        }
        yield '';
        yield `> ${proj?.name ?? 'project'}@${proj?.version ?? '1.0.0'} ${scriptName} ${cwd}`;
        yield `> ${script}`;
        yield '';
        if (scriptName === 'dev' || scriptName === 'start') {
          await sleep(400);
          yield `  VITE v5.3.1  ready in 289 ms`;
          yield '';
          yield `  ➜  Local:   http://localhost:5173/`;
          yield `  ➜  Network: http://192.168.1.105:5173/`;
        } else if (scriptName === 'build') {
          await sleep(500);
          yield `vite v5.3.1 building for production...`;
          await sleep(700);
          yield `✓ 38 modules transformed.`;
          yield `dist/index.html      0.46 kB`;
          yield `dist/assets/index.js 134.56 kB`;
          yield `✓ built in 1.12s`;
        } else {
          yield script;
        }
        break;
      }

      // ── pnpm list ─────────────────────────────────────────────────────
      case 'list':
      case 'ls': {
        const pkgs = getPackages(cwd);
        const proj = getProject(cwd);
        yield `Legend: production dependency, optional only, dev only`;
        yield '';
        yield `${proj?.name ?? cwd.split('\\').pop()} ${proj?.version ?? '1.0.0'} ${cwd}`;
        yield '';
        const prodPkgs = pkgs.filter(p => !p.isDev);
        if (prodPkgs.length > 0) {
          yield `dependencies:`;
          for (const p of prodPkgs) {
            yield `${p.name} ${p.version}`;
          }
        }
        const devPkgs = pkgs.filter(p => p.isDev);
        if (devPkgs.length > 0) {
          yield '';
          yield `devDependencies:`;
          for (const p of devPkgs) {
            yield `${p.name} ${p.version}`;
          }
        }
        if (pkgs.length === 0) yield '(empty)';
        break;
      }

      // ── pnpm create ───────────────────────────────────────────────────
      case 'create': {
        const template = rest[0] ?? 'vite';
        yield `Packages: +1`;
        yield `+`;
        await sleep(400);
        yield `Progress: resolved 1, reused 1, downloaded 0, added 1`;
        await sleep(300);
        yield '';
        if (template === 'vite' || template === 'vite@latest') {
          yield `✔ Project name: … vite-project`;
          yield `✔ Select a framework: › React`;
          yield `✔ Select a variant: › TypeScript`;
          yield '';
          yield `Scaffolding project in ./vite-project...`;
          await sleep(400);
          yield '';
          yield `Done. Now run:`;
          yield '';
          yield `  cd vite-project`;
          yield `  pnpm install`;
          yield `  pnpm run dev`;
        } else if (template === 'next' || template === 'next-app') {
          yield `✔ What is your project named? … my-next-app`;
          yield `✔ Would you like to use TypeScript? … Yes`;
          yield `✔ Would you like to use ESLint? … Yes`;
          yield `✔ Would you like to use Tailwind CSS? … Yes`;
          await sleep(600);
          yield `Creating a new Next.js app in ./my-next-app.`;
          yield '';
          yield `Installing dependencies...`;
          await sleep(800);
          yield `Done in 3.2s`;
        } else {
          yield `Creating project from template: ${template}`;
          await sleep(500);
          yield `Done!`;
        }
        break;
      }

      // ── pnpm --help / default ─────────────────────────────────────────
      case '--help':
      case 'help':
      default: {
        if (sub && sub !== '--help' && sub !== 'help') {
          yield `ERROR  Unknown command '${sub}'.`;
          yield '';
        }
        yield `Usage: pnpm [command]`;
        yield '';
        yield `Commands:`;
        yield `  add       Installs a package and any packages that it depends on.`;
        yield `  install   Install all dependencies for a project`;
        yield `  remove    Removes packages from node_modules and from the project's package file`;
        yield `  run       Runs a defined package script`;
        yield `  list      Print all the versions of packages that are installed`;
        yield `  create    Create a project from a template`;
        yield '';
        yield `Options:`;
        yield `  -v, --version  Print pnpm version`;
        yield `  -h, --help     Output usage information`;
        yield '';
        yield `pnpm@${pnpmVersion} (NEX OS Runtime)`;
        break;
      }
    }
  }

  // ── resolveNex / git ─────────────────────────────────────────────────────

  const resolveNex = useCallback((nameOrPath: string): NexExecutable | null => {
    const hit = resolveExecutable(nameOrPath);
    if (!hit) return null;
    return { appId: hit.appId, title: hit.title, args: hit.args };
  }, []);

  async function* gitRunImpl(args: string[], cwd: string): AsyncGenerator<string> {
    const pid = spawnProcess('git', `git ${args.join(' ')}`);
    try {
      for await (const line of gitService.run(args, cwd)) {
        yield line;
      }
      endProcess(pid, 'done');
    } catch (e) {
      endProcess(pid, 'error');
      yield e instanceof Error ? e.message : String(e);
    }
  }

  // Keep runner identities stable across renders (large generators redefined each pass).
  const npmRunRef = useRef(npmRun);
  const pnpmRunRef = useRef(pnpmRun);
  const gitRunRef = useRef(gitRunImpl);
  npmRunRef.current = npmRun;
  pnpmRunRef.current = pnpmRun;
  gitRunRef.current = gitRunImpl;

  const npmRunStable = useCallback((args: string[], cwd: string) => npmRunRef.current(args, cwd), []);
  const pnpmRunStable = useCallback((args: string[], cwd: string) => pnpmRunRef.current(args, cwd), []);
  const gitRunStable = useCallback((args: string[], cwd: string) => gitRunRef.current(args, cwd), []);

  const value = useMemo(
    () => ({
      packages,
      projects,
      processes,
      npmRun: npmRunStable,
      pnpmRun: pnpmRunStable,
      gitRun: gitRunStable,
      resolveNex,
      getPackages,
      getProject,
      spawnProcess,
      endProcess,
      listProcesses,
    }),
    [
      packages,
      projects,
      processes,
      npmRunStable,
      pnpmRunStable,
      gitRunStable,
      resolveNex,
      getPackages,
      getProject,
      spawnProcess,
      endProcess,
      listProcesses,
    ],
  );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <NexRuntimeContext.Provider value={value}>
      {children}
    </NexRuntimeContext.Provider>
  );
};

export const useNexRuntime = () => {
  const ctx = useContext(NexRuntimeContext);
  if (!ctx) throw new Error('useNexRuntime must be used inside NexRuntimeProvider');
  return ctx;
};
