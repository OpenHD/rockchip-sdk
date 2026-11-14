import type { NexFs } from '../fs';
import { joinPath, normalizePath } from '../fs/paths';

export type PersistPackage = {
  name: string;
  version: string;
  description?: string;
  isDev?: boolean;
};

export type PersistProject = {
  name: string;
  version: string;
  description?: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

export function projectToPackageJson(proj: PersistProject) {
  return {
    name: proj.name,
    version: proj.version,
    description: proj.description || '',
    main: 'index.js',
    scripts: proj.scripts,
    dependencies: proj.dependencies,
    devDependencies: proj.devDependencies,
    license: 'ISC',
  };
}

export async function writePackageJson(nexFs: NexFs, cwd: string, proj: PersistProject) {
  const path = joinPath(normalizePath(cwd), 'package.json');
  await nexFs.writeFile(path, `${JSON.stringify(projectToPackageJson(proj), null, 2)}\n`);
}

export async function writeNodeModuleStub(nexFs: NexFs, cwd: string, pkg: PersistPackage) {
  const root = normalizePath(cwd);
  const nm = joinPath(root, 'node_modules');
  const pkgDir = joinPath(nm, pkg.name);
  await nexFs.mkdir(nm);
  await nexFs.mkdir(pkgDir);
  await nexFs.writeFile(
    joinPath(pkgDir, 'package.json'),
    `${JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        description: pkg.description || '',
        main: 'index.js',
      },
      null,
      2,
    )}\n`,
  );
  await nexFs.writeFile(
    joinPath(pkgDir, 'index.js'),
    `// NEX Runtime stub — ${pkg.name}@${pkg.version}\nmodule.exports = {};\n`,
  );
}

export async function readProjectFromFs(nexFs: NexFs, cwd: string): Promise<PersistProject | null> {
  const path = joinPath(normalizePath(cwd), 'package.json');
  if (!nexFs.exists(path)) return null;
  try {
    const text = await nexFs.readText(path);
    const json = JSON.parse(text) as Partial<PersistProject> & { name?: string };
    return {
      name: json.name || 'project',
      version: json.version || '1.0.0',
      description: json.description || '',
      scripts: json.scripts || {},
      dependencies: json.dependencies || {},
      devDependencies: json.devDependencies || {},
    };
  } catch {
    return null;
  }
}
