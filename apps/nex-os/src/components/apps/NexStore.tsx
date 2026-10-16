import React, { useEffect, useMemo, useState } from 'react';
import { getCommunityLauncherItems, listRegisteredApps, subscribeRegistry } from '@nex-os/sdk';
import { useWindowManager } from '../../context/WindowManager';
import { useSettings } from '../../context/SettingsContext';
import { APPS } from '../../constants/apps';
import { Cart24Regular, Checkmark24Regular, Flash24Regular } from '@fluentui/react-icons';

type StoreCard = {
  id: string;
  appId: string;
  title: string;
  description: string;
  author: string;
  category: string;
  installed: boolean;
  icon: React.ReactNode;
};

const FEATURED_HINTS: Record<string, string> = {
  'hello-nex': 'Plantilla oficial del SDK — tipado, props y useOpenApp.',
  'sdk-docs': 'Docs interactivas de @nex-os/sdk dentro del escritorio.',
};

const NexStore: React.FC = () => {
  const { openWindow } = useWindowManager();
  const { addNotification, accentColor } = useSettings();
  const [, setTick] = useState(0);
  useEffect(() => subscribeRegistry(() => setTick((n) => n + 1)), []);

  const cards: StoreCard[] = useMemo(() => {
    const community = listRegisteredApps().map((m) => ({
      id: m.id,
      appId: m.appId,
      title: m.title,
      description: m.description || FEATURED_HINTS[m.id] || 'Community app registrada con @nex-os/sdk',
      author: m.author || 'Community',
      category: m.category || 'other',
      installed: true,
      icon: m.icon,
    }));

    const builtinExtras: StoreCard[] = [
      {
        id: 'vscode',
        appId: 'vscode',
        title: 'NEX Code',
        description: 'Editor con SCM git local · isomorphic-git en el runtime.',
        author: 'NEX',
        category: 'dev',
        installed: true,
        icon: APPS.find((a) => a.id === 'vscode')?.icon ?? <Flash24Regular />,
      },
      {
        id: 'virtual-dj',
        appId: 'virtual-dj',
        title: 'NEX DJ',
        description: 'Dos decks, waveforms y biblioteca local + YouTube.',
        author: 'NEX',
        category: 'media',
        installed: true,
        icon: APPS.find((a) => a.id === 'virtual-dj')?.icon ?? <Flash24Regular />,
      },
      {
        id: 'hermes',
        appId: 'hermes',
        title: 'Hermes Agent',
        description: 'Agente AI embebido en el escritorio.',
        author: 'NEX',
        category: 'tools',
        installed: true,
        icon: APPS.find((a) => a.id === 'hermes')?.icon ?? <Flash24Regular />,
      },
    ];

    const ids = new Set(community.map((c) => c.id));
    return [...community, ...builtinExtras.filter((b) => !ids.has(b.id))];
  }, []);

  const launcher = getCommunityLauncherItems();

  const openApp = (card: StoreCard) => {
    openWindow(card.id, card.appId, card.title, card.icon);
    addNotification('NEX Store', `${card.title} abierta`);
  };

  const accent = accentColor || '#3dd6c6';

  return (
    <div className="store-root">
      <header className="store-hero">
        <div>
          <div className="store-kicker">NEX Store</div>
          <h1>Apps que hacen que digan <em>che, necesito eso</em></h1>
          <p>
            Community apps vía <code>@nex-os/sdk</code> · {launcher.length} en el registry ·
            publicá la tuya con <code>defineApp</code>.
          </p>
        </div>
        <div className="store-badge" style={{ borderColor: accent, color: accent }}>
          <Cart24Regular />
          v0.2
        </div>
      </header>

      <section className="store-grid">
        {cards.map((card) => (
          <article key={card.id} className="store-card">
            <div className="store-card-icon">{card.icon}</div>
            <div className="store-card-body">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <div className="store-meta">
                <span>{card.author}</span>
                <span>·</span>
                <span>{card.category}</span>
                {card.installed && (
                  <span className="store-installed">
                    <Checkmark24Regular /> Instalada
                  </span>
                )}
              </div>
            </div>
            <button type="button" style={{ background: accent }} onClick={() => openApp(card)}>
              Abrir
            </button>
          </article>
        ))}
      </section>

      <footer className="store-foot">
        Para publicar: <code>npm i @nex-os/sdk</code> → <code>defineApp</code> → import en{' '}
        <code>community-apps/</code>
      </footer>

      <style>{`
        .store-root {
          height: 100%; overflow: auto; padding: 28px;
          background: radial-gradient(circle at 10% 0%, rgba(61,214,198,0.12), transparent 40%),
            linear-gradient(160deg, #0a0f14, #0d1520 60%, #0a1018);
          color: #e8f1f7; font-family: Segoe UI, system-ui, sans-serif;
        }
        .store-hero {
          display: flex; justify-content: space-between; gap: 20px; align-items: flex-start;
          margin-bottom: 28px;
        }
        .store-kicker {
          font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.55; margin-bottom: 8px;
        }
        .store-hero h1 {
          margin: 0 0 10px; font-size: 28px; font-weight: 700; max-width: 520px; line-height: 1.2;
        }
        .store-hero h1 em { font-style: normal; color: var(--win-accent, #3dd6c6); }
        .store-hero p { margin: 0; opacity: 0.7; max-width: 520px; line-height: 1.5; font-size: 14px; }
        .store-hero code, .store-foot code {
          background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px; font-size: 12px;
        }
        .store-badge {
          display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 999px;
          border: 1px solid; font-weight: 600; font-size: 13px;
        }
        .store-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .store-card {
          display: grid; grid-template-columns: 48px 1fr auto; gap: 12px; align-items: center;
          padding: 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
        }
        .store-card-icon { font-size: 28px; display: grid; place-items: center; }
        .store-card-body h3 { margin: 0 0 4px; font-size: 15px; }
        .store-card-body p { margin: 0; font-size: 12px; opacity: 0.65; line-height: 1.4; }
        .store-meta {
          margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
          font-size: 11px; opacity: 0.5;
        }
        .store-installed { display: inline-flex; align-items: center; gap: 2px; color: #3dd6c6; opacity: 1; }
        .store-card button {
          border: 0; border-radius: 8px; padding: 8px 14px; color: #041014; font-weight: 700;
          cursor: pointer; font-size: 13px;
        }
        .store-foot { margin-top: 28px; font-size: 12px; opacity: 0.55; }
      `}</style>
    </div>
  );
};

export default NexStore;
