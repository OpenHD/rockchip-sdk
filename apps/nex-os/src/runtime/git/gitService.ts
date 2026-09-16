import { toGitFs, type NexFs } from '../fs';
import { normalizePath } from '../fs/paths';

export type GitAuthor = { name: string; email: string };

const DEFAULT_AUTHOR: GitAuthor = { name: 'NEX User', email: 'nex@local' };

type GitApi = typeof import('isomorphic-git').default;

let gitModulePromise: Promise<GitApi> | null = null;

/** Load isomorphic-git + Buffer only on first git command (keeps boot bundle lean). */
async function loadGit(): Promise<GitApi> {
  if (!gitModulePromise) {
    gitModulePromise = (async () => {
      const { Buffer } = await import('buffer');
      (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
      const mod = await import('isomorphic-git');
      return mod.default;
    })();
  }
  return gitModulePromise;
}

/** isomorphic-git uses posix joins — feed forward-slash dirs. */
export function toGitDir(winPath: string): string {
  return normalizePath(winPath).replace(/\\/g, '/');
}

export type GitStatusRow = {
  filepath: string;
  head: 0 | 1;
  workdir: 0 | 1 | 2;
  stage: 0 | 1 | 2 | 3;
};

function statusLabel(row: GitStatusRow): string {
  // isomorphic-git status matrix
  if (row.head === 0 && row.workdir === 2 && row.stage === 0) return '??'; // untracked
  if (row.head === 1 && row.workdir === 2 && row.stage === 1) return ' M'; // modified
  if (row.head === 1 && row.workdir === 2 && row.stage === 2) return 'MM'; // staged+mod
  if (row.head === 1 && row.workdir === 0 && row.stage === 0) return ' D'; // deleted
  if (row.head === 0 && row.workdir === 2 && row.stage === 2) return 'A '; // added
  if (row.head === 1 && row.workdir === 1 && row.stage === 2) return 'M '; // staged mod
  if (row.head === 1 && row.workdir === 0 && row.stage === 3) return 'D '; // staged del
  return '  ';
}

export function createGitService(nexFs: NexFs, author: GitAuthor = DEFAULT_AUTHOR) {
  const fs = toGitFs(nexFs);

  async function ensureRepo(cwd: string) {
    const git = await loadGit();
    const dir = toGitDir(cwd);
    try {
      await git.findRoot({ fs, filepath: dir });
    } catch {
      throw new Error(`fatal: not a git repository (or any of the parent directories): .git`);
    }
    return dir;
  }

  return {
    author,

    async init(cwd: string): Promise<string[]> {
      const git = await loadGit();
      const dir = toGitDir(cwd);
      await git.init({ fs, dir, defaultBranch: 'main' });
      return [
        `Initialized empty Git repository in ${normalizePath(cwd)}\\.git\\`,
      ];
    },

    async status(cwd: string): Promise<string[]> {
      const git = await loadGit();
      const dir = await ensureRepo(cwd);
      const matrix = (await git.statusMatrix({ fs, dir })) as Array<
        [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3]
      >;
      const branch = await git.currentBranch({ fs, dir, fullname: false }).catch(() => 'main');
      const lines: string[] = [`On branch ${branch || 'main'}`, ''];

      const rows: GitStatusRow[] = matrix.map(([filepath, head, workdir, stage]) => ({
        filepath,
        head,
        workdir,
        stage,
      }));

      const staged = rows.filter((r) => r.stage !== r.head && r.stage > 0);
      const unstaged = rows.filter(
        (r) => r.workdir !== r.stage && !(r.head === 0 && r.workdir === 2 && r.stage === 0),
      );
      const untracked = rows.filter((r) => r.head === 0 && r.workdir === 2 && r.stage === 0);

      if (!staged.length && !unstaged.length && !untracked.length) {
        lines.push('nothing to commit, working tree clean');
        return lines;
      }

      if (staged.length) {
        lines.push('Changes to be committed:');
        for (const r of staged) {
          lines.push(`\t${statusLabel(r).trim() || 'staged'}:   ${r.filepath}`);
        }
        lines.push('');
      }
      if (unstaged.length) {
        lines.push('Changes not staged for commit:');
        for (const r of unstaged) {
          if (r.head === 0 && r.workdir === 2 && r.stage === 0) continue;
          lines.push(`\tmodified:   ${r.filepath}`);
        }
        lines.push('');
      }
      if (untracked.length) {
        lines.push('Untracked files:');
        for (const r of untracked) lines.push(`\t${r.filepath}`);
        lines.push('');
      }
      return lines;
    },

    async statusMatrix(cwd: string): Promise<GitStatusRow[]> {
      const git = await loadGit();
      const dir = await ensureRepo(cwd);
      const matrix = (await git.statusMatrix({ fs, dir })) as Array<
        [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3]
      >;
      return matrix.map(([filepath, head, workdir, stage]) => ({
        filepath,
        head,
        workdir,
        stage,
      }));
    },

    async add(cwd: string, paths: string[]): Promise<string[]> {
      const git = await loadGit();
      const dir = await ensureRepo(cwd);
      const targets = paths.length ? paths : ['.'];
      for (const filepath of targets) {
        if (filepath === '.') {
          const matrix = await git.statusMatrix({ fs, dir });
          for (const [file] of matrix) {
            await git.add({ fs, dir, filepath: file });
          }
        } else {
          await git.add({ fs, dir, filepath: filepath.replace(/\\/g, '/') });
        }
      }
      return [];
    },

    async commit(cwd: string, message: string): Promise<string[]> {
      const git = await loadGit();
      const dir = await ensureRepo(cwd);
      if (!message.trim()) {
        return ['Aborting commit due to empty commit message.'];
      }
      const sha = await git.commit({
        fs,
        dir,
        message,
        author: { name: author.name, email: author.email },
      });
      const branch = (await git.currentBranch({ fs, dir, fullname: false })) || 'main';
      return [`[${branch} ${sha.slice(0, 7)}] ${message}`, ''];
    },

    async log(cwd: string, opts?: { oneline?: boolean; maxCount?: number }): Promise<string[]> {
      const git = await loadGit();
      const dir = await ensureRepo(cwd);
      const commits = await git.log({
        fs,
        dir,
        depth: opts?.maxCount ?? 20,
      });
      if (!commits.length) return ['fatal: your current branch does not have any commits yet'];
      const lines: string[] = [];
      for (const c of commits) {
        if (opts?.oneline) {
          lines.push(`${c.oid.slice(0, 7)} ${c.commit.message.split('\n')[0]}`);
        } else {
          lines.push(`commit ${c.oid}`);
          lines.push(`Author: ${c.commit.author.name} <${c.commit.author.email}>`);
          lines.push(
            `Date:   ${new Date((c.commit.author.timestamp || 0) * 1000).toUTCString()}`,
          );
          lines.push('');
          lines.push(`    ${c.commit.message.trim()}`);
          lines.push('');
        }
      }
      return lines;
    },

    async branch(cwd: string, name?: string): Promise<string[]> {
      const git = await loadGit();
      const dir = await ensureRepo(cwd);
      if (name) {
        await git.branch({ fs, dir, ref: name });
        return [];
      }
      const branches = await git.listBranches({ fs, dir });
      const current = (await git.currentBranch({ fs, dir, fullname: false })) || 'main';
      return branches.map((b) => (b === current ? `* ${b}` : `  ${b}`));
    },

    async checkout(cwd: string, ref: string): Promise<string[]> {
      const git = await loadGit();
      const dir = await ensureRepo(cwd);
      const branches = await git.listBranches({ fs, dir });
      if (!branches.includes(ref)) {
        await git.branch({ fs, dir, ref });
      }
      await git.checkout({ fs, dir, ref });
      return [`Switched to branch '${ref}'`];
    },

    async currentBranch(cwd: string): Promise<string> {
      const git = await loadGit();
      const dir = await ensureRepo(cwd);
      return (await git.currentBranch({ fs, dir, fullname: false })) || 'main';
    },

    async* run(args: string[], cwd: string): AsyncGenerator<string> {
      const sub = args[0]?.toLowerCase() ?? '';
      const rest = args.slice(1);

      try {
        switch (sub) {
          case '':
          case '--help':
          case 'help':
            yield 'usage: git <command>';
            yield '';
            yield 'Local commands (NEX Runtime):';
            yield '   init       Create an empty Git repository';
            yield '   status     Show the working tree status';
            yield '   add        Add file contents to the index';
            yield '   commit     Record changes (-m <msg>)';
            yield '   log        Show commit logs [--oneline] [-n N]';
            yield '   branch     List or create branches';
            yield '   checkout   Switch branches';
            yield '';
            yield 'Remote (clone/push/pull) — roadmap.';
            break;

          case 'init':
            for (const l of await this.init(cwd)) yield l;
            break;

          case 'status':
          case 'st':
            for (const l of await this.status(cwd)) yield l;
            break;

          case 'add': {
            const paths = rest.filter((a) => !a.startsWith('-'));
            await this.add(cwd, paths.length ? paths : ['.']);
            break;
          }

          case 'commit': {
            let message = '';
            const mi = rest.indexOf('-m');
            if (mi >= 0) {
              message = rest.slice(mi + 1).join(' ').replace(/^["']|["']$/g, '');
            }
            for (const l of await this.commit(cwd, message)) yield l;
            break;
          }

          case 'log': {
            const oneline = rest.includes('--oneline');
            let maxCount = 20;
            const ni = rest.indexOf('-n');
            if (ni >= 0 && rest[ni + 1]) maxCount = Number(rest[ni + 1]) || 20;
            for (const l of await this.log(cwd, { oneline, maxCount })) yield l;
            break;
          }

          case 'branch': {
            const name = rest.find((a) => !a.startsWith('-'));
            for (const l of await this.branch(cwd, name)) yield l;
            break;
          }

          case 'checkout':
          case 'switch': {
            const ref = rest.find((a) => !a.startsWith('-'));
            if (!ref) {
              yield 'fatal: you must specify a branch';
              break;
            }
            for (const l of await this.checkout(cwd, ref)) yield l;
            break;
          }

          case 'clone':
          case 'push':
          case 'pull':
          case 'fetch':
            yield `git: '${sub}' is not available yet in NEX Runtime (local-only).`;
            yield 'Remote git is on the roadmap.';
            break;

          default:
            yield `git: '${sub}' is not a git command. See 'git --help'.`;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        yield msg.startsWith('fatal:') || msg.startsWith('git:') ? msg : `fatal: ${msg}`;
      }
    },
  };
}

export type GitService = ReturnType<typeof createGitService>;
