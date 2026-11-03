/** Canonical Windows-style paths: `C:\foo\bar` (no trailing slash except `C:\`). */

export function normalizePath(input: string): string {
  let p = (input || '').trim().replace(/\//g, '\\');
  if (!p) return 'C:\\';

  // Allow /c/foo style
  if (/^\/[a-zA-Z]\//.test(p.replace(/\\/g, '/'))) {
    const s = p.replace(/\\/g, '/');
    p = `${s[1].toUpperCase()}:\\${s.slice(3).replace(/\//g, '\\')}`;
  }

  if (/^[a-zA-Z]:$/.test(p)) p = `${p}\\`;
  if (/^[a-zA-Z]:[^\\]/.test(p)) p = `${p[0]}:\\${p.slice(2)}`;

  const driveMatch = p.match(/^([a-zA-Z]):(.*)$/);
  if (!driveMatch) {
    // relative — caller should resolve against cwd
    p = p.replace(/\\+/g, '\\').replace(/\\$/, '') || '.';
    return p;
  }

  const drive = driveMatch[1].toUpperCase();
  let rest = driveMatch[2].replace(/\\+/g, '\\');
  if (rest.startsWith('\\')) rest = rest.slice(1);

  const parts: string[] = [];
  for (const seg of rest.split('\\')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }

  if (parts.length === 0) return `${drive}:\\`;
  return `${drive}:\\${parts.join('\\')}`;
}

export function resolvePath(cwd: string, target: string): string {
  const t = (target || '').trim();
  if (!t) return normalizePath(cwd);
  if (/^[a-zA-Z]:/.test(t) || t.startsWith('/') || t.startsWith('\\')) {
    return normalizePath(t);
  }
  const base = normalizePath(cwd);
  const joined = base.endsWith('\\') ? `${base}${t}` : `${base}\\${t}`;
  return normalizePath(joined);
}

export function dirname(path: string): string {
  const p = normalizePath(path);
  if (/^[a-zA-Z]:\\$/.test(p)) return p;
  const idx = p.lastIndexOf('\\');
  if (idx <= 2) return `${p[0]}:\\`;
  return p.slice(0, idx);
}

export function basename(path: string): string {
  const p = normalizePath(path);
  if (/^[a-zA-Z]:\\$/.test(p)) return '';
  const idx = p.lastIndexOf('\\');
  return idx >= 0 ? p.slice(idx + 1) : p;
}

export function joinPath(...parts: string[]): string {
  if (!parts.length) return 'C:\\';
  let acc = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const next = parts[i].replace(/^\\+/, '');
    acc = resolvePath(acc, next);
  }
  return normalizePath(acc);
}

export function splitPath(path: string): { drive: string; segments: string[] } {
  const p = normalizePath(path);
  const drive = p[0].toUpperCase();
  if (/^[a-zA-Z]:\\$/.test(p)) return { drive, segments: [] };
  const rest = p.slice(3);
  return { drive, segments: rest ? rest.split('\\') : [] };
}
