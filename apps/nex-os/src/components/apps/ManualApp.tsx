import React, { useState } from 'react';
import {
  Book24Regular,
  Keyboard24Regular,
  Info24Regular,
  Flash24Regular,
  Lightbulb24Regular,
  Code24Regular,
  Wrench24Regular
} from '@fluentui/react-icons';
import { useWindowManager } from '../../context/WindowManager';

const ManualApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('welcome');
  const { openWindow } = useWindowManager();

  const shortcuts = [
    { keys: 'Win + S', action: 'Abrir Menú de Inicio / Buscar' },
    { keys: 'Win + D', action: 'Minimizar todas las ventanas' },
    { keys: 'Alt + F4', action: 'Cerrar ventana activa' },
    { keys: 'Win + Flechas', action: 'Anclar ventana (Snap)' },
    { keys: 'Win + V', action: 'Cambiar de escritorio virtual' },
  ];

  const features = [
    { title: 'WebAssembly (WASM)', description: 'NEX utiliza binarios WASM para cálculos de alto rendimiento, como en el Administrador de Tareas.', icon: <Flash24Regular /> },
    { title: 'Temas Neon', description: 'Personalización profunda con estéticas Cyberpunk, Matrix y Synthwave con efectos de brillo real.', icon: <Lightbulb24Regular /> },
    { title: 'NexBrowser Pro', description: 'Navegador avanzado con soporte nativo de YouTube, gestión de historial y seguridad integrada.', icon: <Book24Regular /> },
  ];

  return (
    <div className="nex-manual">
      <aside className="manual-sidebar">
        <div className="manual-header">
          <Book24Regular className="header-icon" />
          <div className="header-text">
            <h2>Manual del SO</h2>
            <span>Versión 2.0</span>
          </div>
        </div>

        <nav className="manual-nav">
          <button className={`nav-item ${activeTab === 'welcome' ? 'active' : ''}`} onClick={() => setActiveTab('welcome')}>
            <Lightbulb24Regular /> Guía de Inicio
          </button>
          <button className={`nav-item ${activeTab === 'shortcuts' ? 'active' : ''}`} onClick={() => setActiveTab('shortcuts')}>
            <Keyboard24Regular /> Atajos de Teclado
          </button>
          <button className={`nav-item ${activeTab === 'custom' ? 'active' : ''}`} onClick={() => setActiveTab('custom')}>
            <Lightbulb24Regular /> Personalización
          </button>
          <button className={`nav-item ${activeTab === 'browser' ? 'active' : ''}`} onClick={() => setActiveTab('browser')}>
            <Book24Regular /> Navegación
          </button>
          <button className={`nav-item ${activeTab === 'tech' ? 'active' : ''}`} onClick={() => setActiveTab('tech')}>
            <Flash24Regular /> Tecnología NEX
          </button>
          <button className={`nav-item ${activeTab === 'sdk' ? 'active' : ''}`} onClick={() => setActiveTab('sdk')}>
            <Code24Regular /> SDK Creators
          </button>
          <button className={`nav-item ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>
            <Info24Regular /> Acerca de
          </button>
        </nav>
      </aside>

      <main className="manual-main">
        {activeTab === 'welcome' && (
          <section className="manual-content animate-in">
            <h1>Bienvenido a NEX OS</h1>
            <p className="lead">El sistema operativo web más avanzado, diseñado para la fluidez y el rendimiento.</p>

            <div className="feature-grid">
              {features.map((f, i) => (
                <div key={i} className="feature-card">
                  <div className="feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.description}</p>
                </div>
              ))}
            </div>

            <div className="tip-box">
              <Lightbulb24Regular className="tip-icon" />
              <div>
                <h4>Pro-Tip:</h4>
                <p>Puedes arrastrar las ventanas hacia los bordes de la pantalla para anclarlas automáticamente en divisiones perfectas.</p>
              </div>
            </div>

            <div className="tip-box" style={{ marginTop: '15px', background: 'rgba(59, 130, 246, 0.05)', borderLeft: '4px solid #60a5fa' }}>
              <Flash24Regular className="tip-icon" style={{ color: '#60a5fa' }} />
              <div>
                <h4>Motor 3D Activo:</h4>
                <p>NEX OS 2.0 utiliza Three.js para renderizar fondos inmersivos cuando activas los temas Neon.</p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'shortcuts' && (
          <section className="manual-content animate-in">
            <h1>Atajos de Teclado</h1>
            <p>Domina NEX como un profesional con estas combinaciones de teclas:</p>

            <div className="shortcut-table">
              {shortcuts.map((s, i) => (
                <div key={i} className="shortcut-row">
                  <span className="shortcut-action">{s.action}</span>
                  <kbd className="shortcut-keys">{s.keys}</kbd>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'custom' && (
          <section className="manual-content animate-in">
            <h1>Experiencia Neon</h1>
            <p className="lead">NEX OS 3.0 introduce un sistema de temas dinámicos con renderizado de bordes brillantes.</p>
            
            <div className="feature-grid">
              <div className="feature-card">
                <h3>Cyberpunk 2077</h3>
                <p>Estética rosa y cian con filtros de scanlines y ruido analógico. Ideal para entornos de alta energía.</p>
              </div>
              <div className="feature-card">
                <h3>Matrix Digital</h3>
                <p>Inspirado en el código fuente de la simulación. Tonos verdes, tipografía monoespaciada y alto contraste.</p>
              </div>
              <div className="feature-card">
                <h3>Synthwave 80s</h3>
                <p>Viaje retro-futurista con degradados púrpura/magenta y bordes de neón suave. Pura nostalgia visual.</p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'browser' && (
          <section className="manual-content animate-in">
            <h1>NexBrowser Pro</h1>
            <p className="lead">Un sistema de navegación inteligente que va más allá de un simple iframe.</p>
            
            <div className="tech-stack">
              <div className="tech-item">
                <span className="tech-badge">YT-ENGINE</span>
                <p>Detección inteligente de enlaces de YouTube para conversión automática al reproductor embebido oficial.</p>
              </div>
              <div className="tech-item">
                <span className="tech-badge">HISTORY</span>
                <p>Gestión de historial independiente por pestaña con soporte para botones de navegación de hardware.</p>
              </div>
              <div className="tech-item">
                <span className="tech-badge">SECURITY</span>
                <p>Capa de protección ante errores de ancestros (X-Frame-Options) con redirección a zonas seguras.</p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'tech' && (
          <section className="manual-content animate-in">
            <h1>Ingeniería de NEX</h1>
            <p>NEX no es solo CSS. Debajo del capó corre un motor de última generación:</p>

            <div className="tech-stack">
              <div className="tech-item">
                <span className="tech-badge">WASM</span>
                <p>Los cálculos del Administrador de Tareas corren a velocidad nativa gracias a AssemblyScript.</p>
              </div>
              <div className="tech-item">
                <span className="tech-badge">TypeScript</span>
                <p>Código 100% tipado para una estabilidad comparable a un SO real.</p>
              </div>
              <div className="tech-item">
                <span className="tech-badge">GPU</span>
                <p>Visualizaciones aceleradas por hardware para telemetría instantánea.</p>
              </div>
              <div className="tech-item">
                <span className="tech-badge">Three.js</span>
                <p>Renderizado 3D de alto rendimiento para fondos dinámicos y efectos visuales de partículas.</p>
              </div>
              <div className="tech-item">
                <span className="tech-badge">React.js</span>
                <p>Framework de JavaScript para la construcción de interfaces de usuario.</p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'sdk' && (
          <section className="manual-content animate-in">
            <h1>NEX OS SDK</h1>
            <p className="lead">
              Creá tus propias apps con <code>@nex-os/sdk</code> — registro en runtime, sin tocar el núcleo del shell.
            </p>

            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon"><Code24Regular /></div>
                <h3>defineApp()</h3>
                <p>Manifest + componente React. Aparece en Start, Taskbar y Buscar.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><Flash24Regular /></div>
                <h3>Host hooks</h3>
                <p>Ventanas, settings, FS y escritorios vía <code>src/sdk/host</code>.</p>
              </div>
            </div>

            <div className="tip-box" style={{ marginBottom: 16 }}>
              <Code24Regular className="tip-icon" />
              <div>
                <h4>Empezá acá</h4>
                <p>
                  Sitio web: <a href="/docs#/sdk" target="_blank" rel="noreferrer">/docs#/sdk</a>
                  {' · '}Markdown <code>docs/SDK.md</code>
                  {' · '}Demo in-OS: app <strong>SDK Docs</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openWindow('sdk-docs', 'sdk-docs', 'SDK Docs', <span>⬡</span>)}
              style={{
                border: 'none',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#93c5fd',
                padding: '12px 18px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Abrir SDK Docs
            </button>
          </section>
        )}

        {activeTab === 'about' && (
          <section className="manual-content animate-in">
            <h1>Acerca de NEX</h1>
            <div className="about-branding">
              <div className="logo-placeholder">NEX</div>
              <p>NEX OS</p>
              <p className="sub">Build 2026.6.21</p>
            </div>

            <div className="credits">
              <p>Desarrollado con ❤️ por Salvador juarez</p>
            </div>
          </section>
        )}
      </main>

      <style>{`
        .nex-manual { display: flex; height: 100%; background: #0f1115; color: #e1e4e8; font-family: 'Segoe UI', system-ui, sans-serif; overflow: hidden; }
        
        .manual-sidebar { width: 260px; background: rgba(255, 255, 255, 0.02); padding: 30px 15px; border-right: 1px solid rgba(255,255,255,0.05); }
        .manual-header { display: flex; align-items: center; gap: 12px; margin-bottom: 40px; padding: 0 10px; }
        .header-icon { font-size: 32px; color: #3b82f6; }
        .header-text h2 { margin: 0; font-size: 16px; font-weight: 600; }
        .header-text span { font-size: 11px; opacity: 0.5; }

        .manual-nav { display: flex; flex-direction: column; gap: 6px; }
        .nav-item { 
          display: flex; align-items: center; gap: 12px; padding: 12px 14px; 
          background: transparent; border: none; color: #a1a1aa; border-radius: 8px; 
          cursor: pointer; text-align: left; font-size: 14px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: white; transform: translateX(4px); }
        .nav-item.active { background: rgba(59, 130, 246, 0.1); color: #60a5fa; border-left: 3px solid #3b82f6; font-weight: 500; }

        .manual-main { flex: 1; padding: 50px 70px; overflow-y: auto; background: linear-gradient(180deg, #111827 0%, #0f172a 100%); position: relative; }
        .manual-content h1 { font-size: 36px; font-weight: 700; margin-bottom: 10px; background: linear-gradient(90deg, #fff 0%, #94a3b8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .lead { font-size: 18px; color: #94a3b8; margin-bottom: 40px; }

        .feature-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 40px; }
        .feature-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 25px; border-radius: 16px; transition: 0.3s; }
        .feature-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(59, 130, 246, 0.3); transform: translateY(-5px); }
        .feature-icon { font-size: 24px; color: #3b82f6; margin-bottom: 15px; }
        .feature-card h3 { margin: 0 0 10px 0; font-size: 16px; font-weight: 600; }
        .feature-card p { margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5; }

        .tip-box { display: flex; align-items: flex-start; gap: 15px; background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 20px; border-radius: 8px; }
        .tip-icon { font-size: 20px; color: #3b82f6; margin-top: 2px; }
        .tip-box h4 { margin: 0; font-size: 14px; font-weight: 600; color: #60a5fa; }
        .tip-box p { margin: 5px 0 0 0; font-size: 13px; color: #94a3b8; }

        .shortcut-table { background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; }
        .shortcut-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .shortcut-row:last-child { border-bottom: none; }
        .shortcut-action { font-size: 14px; color: #e1e4e8; }
        .shortcut-keys { background: #334155; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-family: monospace; border-bottom: 2px solid #1e293b; }

        .tech-stack { display: flex; flex-direction: column; gap: 15px; }
        .tech-item { display: flex; align-items: center; gap: 20px; background: rgba(255,255,255,0.02); padding: 15px 20px; border-radius: 12px; }
        .tech-badge { background: #3b82f6; color: white; font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 4px; min-width: 50px; text-align: center; }
        .tech-item p { margin: 0; font-size: 13px; color: #94a3b8; }

        .about-branding { text-align: center; padding: 40px 0; }
        .logo-placeholder { font-size: 48px; font-weight: 900; letter-spacing: -2px; color: #3b82f6; margin-bottom: 10px; }
        .sub { font-size: 12px; opacity: 0.5; }
        .credits { margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center; font-size: 13px; color: #94a3b8; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ManualApp;
