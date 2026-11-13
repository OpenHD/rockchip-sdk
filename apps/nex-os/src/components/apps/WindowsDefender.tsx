import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheckmark48Regular,
  ShieldCheckmark24Regular,
  Home24Regular,
  Person24Regular,
  LockShield24Regular,
  AppGeneric24Regular,
  DeviceEq24Regular,
  Heart24Regular,
  People24Regular,
  CheckmarkCircle24Filled,
  Info24Regular,
  ChevronRight24Regular,
  Navigation24Regular,
  Settings24Regular
} from '@fluentui/react-icons';

const WindowsDefender: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const startScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsScanning(false), 500);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
  };

  const navItems = [
    { id: 'home', icon: <Home24Regular />, label: 'Inicio' },
    { id: 'virus', icon: <ShieldCheckmark24Regular />, label: 'Protección contra virus y amenazas' },
    { id: 'account', icon: <Person24Regular />, label: 'Protección de cuentas' },
    { id: 'firewall', icon: <LockShield24Regular />, label: 'Firewall y protección de red' },
    { id: 'apps', icon: <AppGeneric24Regular />, label: 'Control de aplicaciones y explorador' },
    { id: 'device', icon: <DeviceEq24Regular />, label: 'Seguridad del dispositivo' },
    { id: 'performance', icon: <Heart24Regular />, label: 'Rendimiento y estado del dispositivo' },
    { id: 'family', icon: <People24Regular />, label: 'Opciones de familia' },
  ];

  const securityCards = [
    { id: 'virus', title: 'Protección contra virus y amenazas', sub: 'No se requieren acciones.', icon: <ShieldCheckmark24Regular /> },
    { id: 'account', title: 'Protección de cuentas', sub: 'No se requieren acciones.', icon: <Person24Regular /> },
    { id: 'firewall', title: 'Firewall y protección de red', sub: 'No se requieren acciones.', icon: <LockShield24Regular /> },
    { id: 'apps', title: 'Control de aplicaciones y explorador', sub: 'No se requieren acciones.', icon: <AppGeneric24Regular /> },
    { id: 'device', title: 'Seguridad del dispositivo', sub: 'No se requieren acciones.', icon: <DeviceEq24Regular /> },
    { id: 'performance', title: 'Rendimiento y estado del dispositivo', sub: 'No se requieren acciones.', icon: <Heart24Regular /> },
    { id: 'family', title: 'Opciones de familia', sub: 'Administra la vida digital de tu familia.', icon: <People24Regular /> },
  ];

  return (
    <div className="defender-container">
      {/* SIDEBAR */}
      <aside className="defender-sidebar">
        <div className="sidebar-top">
          <button className="nav-toggle-btn"><Navigation24Regular /></button>
        </div>
        <nav className="defender-nav">
          {navItems.map(item => (
            <button 
              key={item.id} 
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item">
            <span className="nav-icon"><Settings24Regular /></span>
            <span className="nav-label">Configuración</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="defender-content custom-scrollbar">
        <header className="content-header">
          {activeTab === 'home' ? (
            <div className="home-banner">
              <div className="status-indicator">
                <CheckmarkCircle24Filled className="check-icon-large" />
              </div>
              <div className="header-text">
                <h1>Seguridad de un vistazo</h1>
                <p>Consulta lo que ocurre con la seguridad y el estado de tu dispositivo y toma las medidas necesarias.</p>
              </div>
            </div>
          ) : (
            <div className="subpage-header">
              <h1>{navItems.find(n => n.id === activeTab)?.label}</h1>
            </div>
          )}
        </header>

        <section className="content-body">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="security-grid"
              >
                {securityCards.map(card => (
                  <div key={card.id} className="security-card" onClick={() => setActiveTab(card.id)}>
                    <div className="card-icon">{card.icon}</div>
                    <div className="card-info">
                      <h3>{card.title}</h3>
                      <p>{card.sub}</p>
                    </div>
                    <CheckmarkCircle24Filled className="card-check" />
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'virus' && (
              <motion.div 
                key="virus"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="virus-protection-page"
              >
                <div className="protection-status-card">
                  <div className="status-header">
                    <ShieldCheckmark48Regular className="status-icon" />
                    <div className="status-title">
                      <h2>Amenazas actuales</h2>
                      <p>No hay amenazas actuales.</p>
                    </div>
                  </div>
                  
                  <div className="status-details">
                    <div className="detail-item">Último examen: Hoy a las 11:24 (examen rápido)</div>
                    <div className="detail-item">0 amenazas encontradas.</div>
                    <div className="detail-item">El examen duró 44 segundos.</div>
                    <div className="detail-item">18.542 archivos examinados.</div>
                  </div>

                  <div className="action-area">
                    {isScanning ? (
                      <div className="scanning-container">
                        <div className="scan-info">Examinando... {scanProgress}%</div>
                        <div className="progress-bar-bg">
                          <motion.div 
                            className="progress-bar-fill"
                            style={{ width: `${scanProgress}%` }}
                          />
                        </div>
                        <button className="defender-btn secondary" onClick={() => setIsScanning(false)}>Cancelar</button>
                      </div>
                    ) : (
                      <button className="defender-btn primary" onClick={startScan}>Examen rápido</button>
                    )}
                    <button className="defender-text-link">Opciones de examen</button>
                  </div>
                </div>

                <div className="settings-section">
                  <h3>Configuración de antivirus y protección contra amenazas</h3>
                  <div className="settings-card">
                    <p>No se requiere ninguna acción.</p>
                    <button className="defender-text-link">Administrar la configuración</button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab !== 'home' && activeTab !== 'virus' && (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="placeholder-view"
              >
                <div className="info-banner">
                  <Info24Regular />
                  <span>Esta sección está siendo protegida activamente por Windows. No se requieren acciones en este momento.</span>
                </div>
                <div className="mock-details">
                  <p>Configuración del sistema administrada por NEX OS Security Engine.</p>
                  <button className="defender-btn secondary">Ver detalles</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <style>{`
        .defender-container {
          display: flex;
          height: 100%;
          background: #f3f3f3;
          color: #1c1c1c;
          font-family: 'Segoe UI Variable', 'Segoe UI', sans-serif;
        }

        /* SIDEBAR */
        .defender-sidebar {
          width: 280px;
          background: #f3f3f3;
          border-right: 1px solid #e5e5e5;
          display: flex;
          flex-direction: column;
          padding: 12px 0;
          flex-shrink: 0;
        }

        .sidebar-top { padding: 0 16px 12px 16px; }
        .nav-toggle-btn {
          background: transparent;
          border: none;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
        }
        .nav-toggle-btn:hover { background: #eaeaea; }

        .defender-nav { flex: 1; }
        .nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 14px;
          text-align: left;
          color: #1c1c1c;
          position: relative;
        }
        .nav-item:hover { background: #eaeaea; }
        .nav-item.active { background: #ffffff; font-weight: 600; }
        .nav-item.active::before {
          content: "";
          position: absolute;
          left: 0;
          top: 8px;
          bottom: 8px;
          width: 3px;
          background: #0067c0;
          border-radius: 0 4px 4px 0;
        }
        .nav-icon { font-size: 20px; display: flex; align-items: center; }

        /* CONTENT AREA */
        .defender-content {
          flex: 1;
          padding: 40px 60px;
          overflow-y: auto;
          background: #ffffff;
        }

        .content-header { margin-bottom: 32px; }
        .home-banner {
          display: flex;
          align-items: flex-start;
          gap: 24px;
        }
        .check-icon-large { color: #008a17; font-size: 48px !important; margin-top: 4px; }
        .header-text h1 { font-size: 28px; font-weight: 600; margin: 0 0 8px 0; }
        .header-text p { font-size: 15px; opacity: 0.8; margin: 0; }

        .subpage-header h1 { font-size: 24px; font-weight: 600; margin: 0; }

        /* SECURITY GRID */
        .security-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .security-card {
          padding: 24px;
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.2s;
          position: relative;
        }
        .security-card:hover {
          background: #fafafa;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          border-color: #d0d0d0;
        }
        .card-icon { color: #0067c0; font-size: 24px; margin-top: 2px; }
        .card-info h3 { font-size: 15px; font-weight: 600; margin: 0 0 4px 0; color: #0067c0; }
        .card-info p { font-size: 13px; opacity: 0.7; margin: 0; }
        .card-check { position: absolute; top: 12px; right: 12px; color: #008a17; font-size: 18px !important; }

        /* VIRUS PROTECTION PAGE */
        .protection-status-card {
          padding: 0 0 32px 0;
          border-bottom: 1px solid #eeeeee;
          margin-bottom: 32px;
        }
        .status-header { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; }
        .status-icon { color: #008a17; }
        .status-title h2 { font-size: 18px; font-weight: 600; margin: 0; }
        .status-title p { font-size: 14px; margin: 4px 0 0 0; opacity: 0.8; }

        .status-details { margin-bottom: 24px; }
        .detail-item { font-size: 13px; color: #616161; margin-bottom: 4px; }

        .action-area { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
        
        .defender-btn {
          padding: 6px 24px;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .defender-btn.primary {
          background: #0067c0;
          color: white;
          border: 1px solid #0067c0;
        }
        .defender-btn.primary:hover { background: #005fb8; }
        .defender-btn.secondary {
          background: #ffffff;
          color: #1c1c1c;
          border: 1px solid #d1d1d1;
        }
        .defender-btn.secondary:hover { background: #f5f5f5; }

        .defender-text-link {
          background: transparent;
          border: none;
          color: #0067c0;
          font-size: 13px;
          cursor: pointer;
          padding: 0;
        }
        .defender-text-link:hover { text-decoration: underline; }

        .scanning-container {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .scan-info { font-size: 13px; font-weight: 500; }
        .progress-bar-bg {
          height: 4px;
          background: #e5e5e5;
          border-radius: 2px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: #0067c0;
        }

        .settings-section h3 { font-size: 16px; font-weight: 600; margin: 0 0 16px 0; }
        .settings-card { padding: 16px; border: 1px solid #e5e5e5; border-radius: 4px; }
        .settings-card p { font-size: 13px; margin: 0 0 12px 0; opacity: 0.8; }

        .placeholder-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .info-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #f0f7ff;
          border-left: 4px solid #0067c0;
          font-size: 14px;
          line-height: 1.4;
        }
        .mock-details {
          padding: 24px;
          background: #f9f9f9;
          border-radius: 8px;
          border: 1px dashed #d1d1d1;
        }
        .mock-details p { font-size: 13px; color: #616161; margin-bottom: 16px; }

        @media (max-width: 900px) {
          .defender-sidebar { width: 50px; }
          .nav-label { display: none; }
          .defender-content { padding: 30px; }
        }
      `}</style>
    </div>
  );
};

export default WindowsDefender;
