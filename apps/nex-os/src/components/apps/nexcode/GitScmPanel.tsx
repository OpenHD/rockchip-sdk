import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNexFs } from '../../../context/FileSystemContext';
import { createGitService, type GitStatusRow } from '../../../runtime/git/gitService';

type Props = {
  /** Windows path of the project root on NexFs, e.g. C:\Documentos\Proyectos\nex-app */
  repoPath: string;
  palette: Record<string, string>;
  /** Bump to force refresh after editor saves */
  refreshKey?: number;
};

function classify(row: GitStatusRow): 'staged' | 'changed' | 'untracked' | 'clean' {
  if (row.head === 0 && row.workdir === 2 && row.stage === 0) return 'untracked';
  if (row.stage !== row.head && row.stage > 0) return 'staged';
  if (row.workdir !== row.stage) return 'changed';
  return 'clean';
}

export const GitScmPanel: React.FC<Props> = ({ repoPath, palette: p, refreshKey = 0 }) => {
  const nexFs = useNexFs();
  const git = useMemo(() => createGitService(nexFs), [nexFs]);
  const [branch, setBranch] = useState('main');
  const [rows, setRows] = useState<GitStatusRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRepo, setHasRepo] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const b = await git.currentBranch(repoPath);
      setBranch(b);
      setHasRepo(true);
      const matrix = await git.statusMatrix(repoPath);
      setRows(matrix.filter((r) => classify(r) !== 'clean'));
    } catch (e) {
      setHasRepo(false);
      setRows([]);
      setBranch('—');
      const msg = e instanceof Error ? e.message : String(e);
      if (!/not a git repository/i.test(msg)) setError(msg);
    }
  }, [git, repoPath]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const staged = rows.filter((r) => classify(r) === 'staged');
  const changed = rows.filter((r) => classify(r) === 'changed');
  const untracked = rows.filter((r) => classify(r) === 'untracked');

  const run = async (fn: () => Promise<string[] | void>) => {
    setBusy(true);
    setError(null);
    try {
      const out = await fn();
      if (out?.length) setLog(out.slice(0, 6));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ width: 260, background: p.sidebar, borderRight: `1px solid ${p.border}`, flexShrink: 0, fontSize: 12.5, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        fontSize: 11, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.8,
        padding: '10px 12px 8px', color: p.text,
      }}>
        Control de código fuente
      </div>

      <div style={{ padding: '0 12px 8px', color: p.textDim, fontSize: 11 }}>
        <div style={{ color: p.text, marginBottom: 4 }}>{branch}</div>
        <div style={{ opacity: 0.75, wordBreak: 'break-all' }}>{repoPath}</div>
      </div>

      {!hasRepo ? (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: p.textDim, lineHeight: 1.45 }}>
            Este folder aún no es un repo git. Inicializalo en el VFS de NEX.
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => git.init(repoPath))}
            style={btnStyle(p)}
          >
            git init
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 12px' }}>
          {!rows.length && (
            <div style={{ padding: '8px 12px', color: p.textDim }}>Working tree clean.</div>
          )}

          {staged.length > 0 && (
            <Section title="Staged" p={p}>
              {staged.map((r) => (
                <Row key={`s-${r.filepath}`} name={r.filepath} tone={p.accent} />
              ))}
            </Section>
          )}
          {changed.length > 0 && (
            <Section title="Changes" p={p}>
              {changed.map((r) => (
                <Row key={`c-${r.filepath}`} name={r.filepath} tone="#e2b340" />
              ))}
            </Section>
          )}
          {untracked.length > 0 && (
            <Section title="Untracked" p={p}>
              {untracked.map((r) => (
                <Row key={`u-${r.filepath}`} name={r.filepath} tone={p.textDim} />
              ))}
            </Section>
          )}

          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button type="button" disabled={busy} onClick={() => run(() => git.add(repoPath, ['.']))} style={btnStyle(p)}>
              Stage all
            </button>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensaje del commit"
              rows={3}
              style={{
                width: '100%', resize: 'vertical', boxSizing: 'border-box',
                background: p.bg, color: p.text, border: `1px solid ${p.border}`,
                borderRadius: 4, padding: 8, fontFamily: 'inherit', fontSize: 12,
              }}
            />
            <button
              type="button"
              disabled={busy || !message.trim()}
              onClick={() =>
                run(async () => {
                  const out = await git.commit(repoPath, message.trim());
                  setMessage('');
                  return out;
                })
              }
              style={btnStyle(p, true)}
            >
              Commit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => git.log(repoPath, { oneline: true, maxCount: 8 }))}
              style={btnStyle(p)}
            >
              Ver log
            </button>
          </div>

          {log.length > 0 && (
            <div style={{ padding: '0 12px', color: p.textDim, fontFamily: 'Consolas, monospace', fontSize: 11 }}>
              {log.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: 10, color: '#f87171', fontSize: 11, borderTop: `1px solid ${p.border}` }}>
          {error}
        </div>
      )}
    </div>
  );
};

function Section({ title, p, children }: { title: string; p: Record<string, string>; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: p.textDim, textTransform: 'uppercase' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ name, tone }: { name: string; tone: string }) {
  return (
    <div style={{ padding: '3px 12px', color: tone, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {name}
    </div>
  );
}

function btnStyle(p: Record<string, string>, primary = false): React.CSSProperties {
  return {
    border: `1px solid ${p.border}`,
    background: primary ? p.accent : p.bg,
    color: primary ? p.accentText : p.text,
    borderRadius: 4,
    padding: '7px 10px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'inherit',
  };
}

export default GitScmPanel;
