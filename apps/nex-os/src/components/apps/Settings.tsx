import React, { useState } from 'react';
import { 
  Desktop24Regular, 
  Apps24Regular, 
  ShieldCheckmark24Regular,
  Wrench24Regular,
  Image24Regular
} from '@fluentui/react-icons';

interface SettingsProps {
  onWallpaperChange: (url: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ onWallpaperChange }) => {
  const [activeTab, setActiveTab] = useState('personalization');

  const wallpapers = [
    { name: 'Bloom Dark', url: 'https://images.unsplash.com/photo-1620121692029-d088224efc74?q=80&w=2832' },
    { name: 'Glow Flow', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2864' },
    { name: 'Tucumán Night', url: 'https://images.unsplash.com/photo-1541411191165-f184eaf9509a?q=80&w=2787' }, // Un guiño local
    { name: 'Cyber Souls', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070' },
  ];

  return (
    <div className="w11-settings">
      {/* Sidebar de navegación lateral */}
      <aside className="settings-sidebar">
        <div className="user-profile">
          <div className="avatar">S</div>
          <div className="user-info">
            <span className="user-name">Martín</span>
            <span className="user-role">Administrador</span>
          </div>
        </div>
        
        <nav className="settings-nav">
          <button className={`nav-item ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>
            <Desktop24Regular /> Sistema
          </button>
          <button className={`nav-item ${activeTab === 'personalization' ? 'active' : ''}`} onClick={() => setActiveTab('personalization')}>
            <Image24Regular /> Personalización
          </button>
          <button className={`nav-item ${activeTab === 'apps' ? 'active' : ''}`} onClick={() => setActiveTab('apps')}>
            <Apps24Regular /> Aplicaciones
          </button>
          <button className={`nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
            <ShieldCheckmark24Regular /> Seguridad & Privacidad
          </button>
        </nav>
      </aside>

      {/* Contenido principal */}
      <main className="settings-main">
        {activeTab === 'personalization' && (
          <section className="section-content">
            <h1 className="section-title">Personalización</h1>
            
            <div className="preview-card">
              <div className="preview-monitor">
                <div className="preview-bg" style={{ backgroundImage: `url(${wallpapers[0].url})` }}>
                  <div className="preview-window"></div>
                </div>
              </div>
              <div className="preview-text">
                <h3>Fondo de escritorio</h3>
                <p>Elegí una imagen que combine con tu estilo</p>
              </div>
            </div>

            <div className="wallpaper-grid-w11">
              {wallpapers.map((wp, i) => (
                <div key={i} className="wp-item" onClick={() => onWallpaperChange(wp.url)}>
                  <img src={wp.url} alt={wp.name} />
                  <span>{wp.name}</span>
                </div>
              ))}
            </div>
            
            <div className="setting-tile">
              <div className="tile-icon"><Wrench24Regular /></div>
              <div className="tile-text">
                <h4>Color de énfasis</h4>
                <p>Automático (basado en el fondo)</p>
              </div>
              <div className="tile-action">
                 <div className="color-dot"></div>
              </div>
            </div>
          </section>
        )}
      </main>

      <style>{`
        .w11-settings { display: flex; height: 100%; background: #1c1c1c; color: white; font-family: 'Segoe UI Variable', sans-serif; }
        
        /* Sidebar */
        .settings-sidebar { width: 280px; background: rgba(255, 255, 255, 0.03); padding: 40px 15px; border-right: 1px solid rgba(255,255,255,0.05); }
        .user-profile { display: flex; align-items: center; gap: 12px; margin-bottom: 30px; padding: 0 10px; }
        .avatar { width: 48px; height: 48px; background: #0067c0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; }
        .user-info { display: flex; flex-direction: column; }
        .user-name { font-weight: 600; font-size: 14px; }
        .user-role { font-size: 12px; opacity: 0.6; }

        .settings-nav { display: flex; flex-direction: column; gap: 4px; }
        .nav-item { 
          display: flex; align-items: center; gap: 12px; padding: 10px 12px; 
          background: transparent; border: none; color: white; border-radius: 6px; 
          cursor: pointer; text-align: left; font-size: 14px; transition: 0.2s;
        }
        .nav-item:hover { background: rgba(255,255,255,0.05); }
        .nav-item.active { background: rgba(255,255,255,0.08); border-left: 3px solid #00c2ff; font-weight: 500; }

        /* Main */
        .settings-main { flex: 1; padding: 40px 60px; overflow-y: auto; background: linear-gradient(135deg, rgba(32,32,32,1) 0%, rgba(20,20,20,1) 100%); }
        .section-title { font-size: 28px; font-weight: 600; margin-bottom: 30px; }

        /* Preview Card */
        .preview-card { 
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); 
          border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 30px; margin-bottom: 30px;
        }
        .preview-monitor { width: 220px; height: 130px; background: #333; border-radius: 6px; padding: 6px; border: 4px solid #444; }
        .preview-bg { width: 100%; height: 100%; background-size: cover; border-radius: 2px; position: relative; display: flex; align-items: center; justify-content: center; }
        .preview-window { width: 60%; height: 60%; background: rgba(0,0,0,0.4); backdrop-filter: blur(5px); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; }

        /* Wallpaper Grid */
        .wallpaper-grid-w11 { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 30px; }
        .wp-item { cursor: pointer; border-radius: 8px; overflow: hidden; position: relative; border: 2px solid transparent; transition: 0.2s; }
        .wp-item:hover { border-color: #00c2ff; transform: translateY(-2px); }
        .wp-item img { width: 100%; height: 85px; object-fit: cover; }
        .wp-item span { display: block; padding: 6px; font-size: 11px; text-align: center; background: rgba(0,0,0,0.4); }

        /* Setting Tile */
        .setting-tile { 
          display: flex; align-items: center; background: rgba(255,255,255,0.03); 
          padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); gap: 15px;
        }
        .tile-icon { font-size: 20px; color: #00c2ff; }
        .tile-text { flex: 1; }
        .tile-text h4 { margin: 0; font-size: 14px; font-weight: 500; }
        .tile-text p { margin: 2px 0 0; font-size: 12px; opacity: 0.6; }
        .color-dot { width: 20px; height: 20px; border-radius: 50%; background: #00c2ff; border: 2px solid white; }
      `}</style>
    </div>
  );
};

export default Settings;