import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SLUG,
  DOC_SECTIONS,
  findPage,
  type DocBlock,
  type DocPage,
  type DocSection,
} from './content';

type FlatPage = { section: DocSection; page: DocPage; index: number };

function flattenPages(): FlatPage[] {
  const out: FlatPage[] = [];
  let i = 0;
  for (const section of DOC_SECTIONS) {
    for (const page of section.pages) {
      out.push({ section, page, index: i++ });
    }
  }
  return out;
}

const FLAT = flattenPages();

function readSlug(): string {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash && findPage(hash)) return hash;
  return DEFAULT_SLUG;
}

function pushSlug(slug: string) {
  window.history.pushState(null, '', `/docs#/${slug}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function NexLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="nxg" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3dd6c6" />
          <stop offset="1" stopColor="#60cdff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#071018" />
      <rect x="0.6" y="0.6" width="30.8" height="30.8" rx="8.4" stroke="url(#nxg)" strokeOpacity="0.85" />
      <path
        d="M8.2 22.2V9.8l6.6 9.8 6.6-9.8v12.4"
        stroke="url(#nxg)"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.2" cy="9" r="1.55" fill="#60cdff" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="nxd-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          window.setTimeout(() => setOk(false), 1400);
        } catch {
          /* ignore */
        }
      }}
    >
      {ok ? 'Copied' : 'Copy'}
    </button>
  );
}

function BlockView({ block, onNavigate }: { block: DocBlock; onNavigate: (slug: string) => void }) {
  switch (block.type) {
    case 'hero':
      return (
        <header className="nxd-hero">
          <div className="nxd-eyebrow">
            <span className="nxd-pulse" />
            {block.eyebrow}
          </div>
          <h1>{block.title}</h1>
          <p className="nxd-lead">{block.lead}</p>
        </header>
      );
    case 'p':
      return <p className="nxd-p">{block.text}</p>;
    case 'h2':
      return (
        <h2 id={block.id} className="nxd-h2">
          <a href={`#${block.id}`} className="nxd-anchor">
            #
          </a>
          {block.text}
        </h2>
      );
    case 'h3':
      return (
        <h3 id={block.id} className="nxd-h3">
          {block.text}
        </h3>
      );
    case 'ul':
      return (
        <ul className="nxd-list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="nxd-list numbered">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case 'code':
      return (
        <div className="nxd-code">
          <div className="nxd-code-bar">
            <div className="nxd-code-dots" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <span className="nxd-code-lang">{block.lang || 'code'}</span>
            <CopyButton text={block.code} />
          </div>
          <pre>
            <code>{block.code}</code>
          </pre>
        </div>
      );
    case 'callout':
      return (
        <aside className={`nxd-callout ${block.tone}`}>
          <div className="nxd-callout-icon" aria-hidden>
            {block.tone === 'tip' ? '◇' : block.tone === 'warn' ? '!' : 'i'}
          </div>
          <div>
            <strong>{block.title}</strong>
            <span>{block.text}</span>
          </div>
        </aside>
      );
    case 'table':
      return (
        <div className="nxd-table-wrap">
          <table className="nxd-table">
            <thead>
              <tr>
                {block.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'cards':
      return (
        <div className="nxd-cards">
          {block.items.map((card) => (
            <button
              key={card.slug}
              type="button"
              className="nxd-card"
              onClick={() => onNavigate(card.slug)}
            >
              <div className="nxd-card-kicker">{card.kicker}</div>
              <div className="nxd-card-title">{card.title}</div>
              <div className="nxd-card-desc">{card.description}</div>
              <div className="nxd-card-go">Abrir →</div>
            </button>
          ))}
        </div>
      );
    default:
      return null;
  }
}

function DocArticle({
  page,
  onNavigate,
}: {
  page: DocPage;
  onNavigate: (slug: string) => void;
}) {
  const toc = page.blocks.filter((b) => b.type === 'h2') as Extract<DocBlock, { type: 'h2' }>[];
  const [activeId, setActiveId] = useState<string | null>(toc[0]?.id ?? null);

  useEffect(() => {
    const ids = page.blocks.filter((b): b is Extract<DocBlock, { type: 'h2' }> => b.type === 'h2').map((t) => t.id);
    if (!ids.length) return;
    setActiveId(ids[0] ?? null);
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 1] },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [page.slug, page.blocks]);

  return (
    <div className="nxd-article-grid">
      <article className="nxd-article" key={page.slug}>
        {page.blocks.map((block, i) => (
          <BlockView key={`${page.slug}-${i}`} block={block} onNavigate={onNavigate} />
        ))}
      </article>
      {toc.length > 0 && (
        <aside className="nxd-toc">
          <div className="nxd-toc-title">On this page</div>
          <ul>
            {toc.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`} className={activeId === h.id ? 'active' : ''}>
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}

function SearchModal({
  open,
  onClose,
  onGo,
}: {
  open: boolean;
  onClose: () => void;
  onGo: (slug: string) => void;
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  const hits = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return FLAT.slice(0, 8);
    return FLAT.filter(
      ({ page, section }) =>
        page.title.toLowerCase().includes(query) ||
        page.description.toLowerCase().includes(query) ||
        page.slug.includes(query) ||
        section.title.toLowerCase().includes(query),
    ).slice(0, 10);
  }, [q]);

  if (!open) return null;

  return (
    <div className="nxd-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="nxd-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="nxd-modal-search">
          <span className="nxd-modal-icon" aria-hidden>
            ⌕
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search documentation…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && hits[0]) {
                onGo(hits[0].page.slug);
                onClose();
              }
            }}
          />
          <kbd>esc</kbd>
        </div>
        <div className="nxd-modal-list">
          {hits.map(({ page, section }) => (
            <button
              key={page.slug}
              type="button"
              className="nxd-modal-item"
              onClick={() => {
                onGo(page.slug);
                onClose();
              }}
            >
              <span className="nxd-modal-sec">{section.title}</span>
              <span className="nxd-modal-title">{page.title}</span>
              <span className="nxd-modal-desc">{page.description}</span>
            </button>
          ))}
          {hits.length === 0 && <div className="nxd-empty">No matches</div>}
        </div>
      </div>
    </div>
  );
}

export default function DocsApp() {
  const [slug, setSlugState] = useState(readSlug);
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarQ, setSidebarQ] = useState('');

  useEffect(() => {
    const onNav = () => setSlugState(readSlug());
    window.addEventListener('popstate', onNav);
    window.addEventListener('hashchange', onNav);
    return () => {
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('hashchange', onNav);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.title = `${findPage(slug)?.page.title || 'Docs'} · NEX OS Docs`;
  }, [slug]);

  const match = findPage(slug) || findPage(DEFAULT_SLUG)!;
  const flatIndex = FLAT.findIndex((f) => f.page.slug === match.page.slug);
  const prev = flatIndex > 0 ? FLAT[flatIndex - 1] : null;
  const next = flatIndex >= 0 && flatIndex < FLAT.length - 1 ? FLAT[flatIndex + 1] : null;

  const filtered = useMemo(() => {
    const q = sidebarQ.trim().toLowerCase();
    if (!q) return DOC_SECTIONS;
    return DOC_SECTIONS.map((section) => ({
      ...section,
      pages: section.pages.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.slug.includes(q),
      ),
    })).filter((s) => s.pages.length > 0);
  }, [sidebarQ]);

  const go = (nextSlug: string) => {
    pushSlug(nextSlug);
    setSlugState(nextSlug);
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="nxd-root">
      <div className="nxd-atmosphere" aria-hidden />
      <div className="nxd-gridline" aria-hidden />

      <header className="nxd-top">
        <div className="nxd-top-inner">
          <button type="button" className="nxd-menu" onClick={() => setNavOpen((v) => !v)} aria-label="Menu">
            <span />
            <span />
            <span />
          </button>

          <a
            className="nxd-brand"
            href="/docs#/introduction"
            onClick={(e) => {
              e.preventDefault();
              go('introduction');
            }}
          >
            <NexLogo />
            <div>
              <div className="nxd-brand-row">
                <span className="nxd-brand-name">NEX OS</span>
                <span className="nxd-badge">Docs</span>
              </div>
              <div className="nxd-brand-sub">Platform · SDK · Music</div>
            </div>
          </a>

          <button type="button" className="nxd-search-trigger" onClick={() => setSearchOpen(true)}>
            <span>Search docs…</span>
            <kbd>⌘K</kbd>
          </button>

          <nav className="nxd-top-links">
            <a href="/" className="nxd-pill-link">
              Desktop
            </a>
            <a href="/nex-music" className="nxd-pill-link">
              Music
            </a>
            <a
              href="https://github.com/shadownrx/windows"
              target="_blank"
              rel="noreferrer"
              className="nxd-pill-link ghost"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <div className={`nxd-body ${navOpen ? 'nav-open' : ''}`}>
        <aside className="nxd-sidebar">
          <div className="nxd-side-head">
            <input
              className="nxd-side-filter"
              value={sidebarQ}
              onChange={(e) => setSidebarQ(e.target.value)}
              placeholder="Filter…"
            />
            <div className="nxd-version">
              <span>SDK</span>
              <code>0.1.0</code>
            </div>
          </div>

          {filtered.map((section) => (
            <div key={section.id} className="nxd-nav-section">
              <div className="nxd-nav-label">{section.title}</div>
              {section.pages.map((page) => (
                <button
                  key={page.slug}
                  type="button"
                  className={`nxd-nav-item ${page.slug === match.page.slug ? 'active' : ''}`}
                  onClick={() => go(page.slug)}
                >
                  <span className="nxd-nav-dot" />
                  {page.title}
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && <div className="nxd-empty">No results</div>}
        </aside>

        <main className="nxd-main">
          <div className="nxd-page" key={match.page.slug}>
            <div className="nxd-crumb">
              <span>{match.section.title}</span>
              <span className="nxd-crumb-sep">/</span>
              <span className="nxd-crumb-cur">{match.page.title}</span>
            </div>
            <p className="nxd-desc">{match.page.description}</p>

            <DocArticle page={match.page} onNavigate={go} />

            <nav className="nxd-pager">
              {prev ? (
                <button type="button" className="nxd-pager-btn prev" onClick={() => go(prev.page.slug)}>
                  <span>Previous</span>
                  <strong>{prev.page.title}</strong>
                </button>
              ) : (
                <span />
              )}
              {next ? (
                <button type="button" className="nxd-pager-btn next" onClick={() => go(next.page.slug)}>
                  <span>Next</span>
                  <strong>{next.page.title}</strong>
                </button>
              ) : (
                <span />
              )}
            </nav>

            <footer className="nxd-foot">
              <div>
                <div className="nxd-foot-brand">NEX OS Documentation</div>
                <div className="nxd-foot-muted">Built for creators · React · Vite · Vercel</div>
              </div>
              <a href="https://github.com/shadownrx/windows" target="_blank" rel="noreferrer">
                Edit on GitHub →
              </a>
            </footer>
          </div>
        </main>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onGo={go} />
    </div>
  );
}
