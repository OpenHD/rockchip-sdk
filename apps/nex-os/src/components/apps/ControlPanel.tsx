import React, { useState, useEffect } from 'react';
import {
  Settings24Regular,
  Speaker224Regular,
  Lightbulb24Regular,
  Keyboard24Regular,
  Desktop24Regular,
  Shield24Regular,
  PlugConnected24Regular,
  Clock24Regular,
  Person24Regular,
  Apps24Regular,
  Info24Regular,
  ChevronRight24Regular,
  WeatherCloudy20Regular,
  Storage24Regular,
  History24Regular,
  Edit24Regular,
  ArrowClockwise24Regular,
  CheckmarkCircle24Regular,
  ArrowRight24Regular,
  Search24Regular,
  Folder24Regular,
  Delete24Regular,
  Calculator24Regular,
} from '@fluentui/react-icons';
import { useSettings } from '../../context/SettingsContext';

// --- Windows 11 Settings Theme Tokens ---
const BG_MAIN = "#1c1c1c";
const BG_SIDEBAR = "rgba(43, 43, 43, 0.6)"; 
const BG_CARD = "rgba(255, 255, 255, 0.04)";
const BORDER_CARD = "rgba(255, 255, 255, 0.06)";
const TEXT_SECONDARY = "#a0a0a0";

type Category = 'system' | 'personalization' | 'network' | 'apps' | 'accounts' | 'privacy' | 'update';

interface ControlPanelProps {
}

const ControlPanel: React.FC<ControlPanelProps> = () => {
  const [activeTab, setActiveTab] = useState<Category>('system');
  const { 
    brightness, setBrightness, 
    accentColor, setAccentColor,
    isWifiEnabled, setIsWifiEnabled,
    isNightLightEnabled, setIsNightLightEnabled,
    userName, setUserName,
    updateStatus, setUpdateStatus,
    neonTheme, setNeonTheme,
    wallpaper, setWallpaper
  } = useSettings();

  const [newName, setNewName] = useState(userName);
  const [searchQuery, setSearchQuery] = useState('');
  const [updateProgress, setUpdateProgress] = useState(0);

  const menuItems = [
    { id: 'system', label: 'Sistema', icon: <Settings24Regular /> },
    { id: 'network', label: 'Red e Internet', icon: <PlugConnected24Regular /> },
    { id: 'personalization', label: 'Personalización', icon: <Desktop24Regular /> },
    { id: 'apps', label: 'Aplicaciones', icon: <Apps24Regular /> },
    { id: 'accounts', label: 'Cuentas', icon: <Person24Regular /> },
    { id: 'privacy', label: 'Privacidad y seguridad', icon: <Shield24Regular /> },
    { id: 'update', label: 'Windows Update', icon: <History24Regular /> },
  ];

  const wallpapers = [
    'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000',
    'https://images.unsplash.com/photo-1621947081720-86970823b77a?q=80&w=1000',
    'https://images.unsplash.com/photo-1620121692029-d088224efc74?q=80&w=1000',
  ];

  const apps = [
    { id: 'paint', name: 'Paint', icon: <Edit24Regular />, size: '45.2 MB', version: '11.2310.42.0' },
    { id: 'explorer', name: 'Explorador de archivos', icon: <Folder24Regular />, size: '12.8 MB', version: '10.0.22621.1' },
    { id: 'calc', name: 'Calculadora', icon: <Calculator24Regular />, size: '8.4 MB', version: '11.2210.0.0' },
    { id: 'notepad', name: 'Bloc de notas', icon: <Settings24Regular />, size: '2.1 MB', version: '11.2302.26.0' },
    { id: 'settings', name: 'Configuración', icon: <Settings24Regular />, size: '34.5 MB', version: '1.0.0' },
  ];

  const accentColors = ['#60cdff', '#ffb900', '#ff8c00', '#f7630c', '#e74856', '#e81123', '#0078d4', '#0063b1', '#8e8cd8', '#6b69d6', '#00b7c3', '#008477', '#00cc6a', '#10893e'];

  const handleUpdate = () => {
    setUpdateStatus('checking');
    setUpdateProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUpdateProgress(progress);
      if (progress === 40) setUpdateStatus('downloading');
      if (progress >= 100) {
        clearInterval(interval);
        setUpdateStatus('up-to-date');
      }
    }, 400);
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: BG_MAIN, color: 'white', fontFamily: '"Segoe UI Variable", "Inter", sans-serif', overflow: 'hidden', userSelect: 'none' }}>
      
      {/* 1. Sidebar (Fixed Width 280px) */}
      <aside style={{ width: '280px', flexShrink: 0, background: BG_SIDEBAR, backdropFilter: 'blur(40px)', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', paddingTop: '40px' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 24px', marginBottom: '32px' }}>
            <div style={{ width: '36px', height: '36px', background: 'var(--win-accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black' }}>
               {userName.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
               <span style={{ fontSize: '13px', fontWeight: 600 }}>{userName}</span>
               <span style={{ fontSize: '11px', color: TEXT_SECONDARY }}>Cuenta local</span>
            </div>
         </div>

         <nav style={{ flex: 1, padding: '0 8px' }}>
            {menuItems.map(item => (
               <div key={item.id} style={{ position: 'relative', marginBottom: '2px' }}>
                  {activeTab === item.id && <div style={{ position: 'absolute', left: '0', top: '25%', width: '3px', height: '50%', background: 'var(--win-accent)', borderRadius: '10px' }} />}
                  <button 
                    onClick={() => setActiveTab(item.id as Category)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 16px', border: 'none', background: activeTab === item.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: activeTab === item.id ? 'white' : TEXT_SECONDARY, borderRadius: '6px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                     <span style={{ color: activeTab === item.id ? 'var(--win-accent)' : 'inherit', display: 'flex' }}>
                        {React.cloneElement(item.icon as React.ReactElement<any>, { style: { width: 18, height: 18 } })}
                     </span>
                     <span style={{ fontSize: '13.5px', fontWeight: activeTab === item.id ? 500 : 400 }}>{item.label}</span>
                  </button>
               </div>
            ))}
         </nav>
      </aside>

      {/* 2. Main Area (Scrollable flex-grow) */}
      <main style={{ flexGrow: 1, padding: '40px 60px', overflowY: 'auto' }} className="custom-scrollbar">
         
         {activeTab === 'system' && (
           <div style={{ maxWidth: '800px' }}>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                 <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER_CARD}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <Settings24Regular style={{ width: 48, height: 48, color: 'var(--win-accent)' }} />
                    </div>
                    <div>
                       <h1 style={{ fontSize: '32px', margin: '0 0 4px 0', fontWeight: 600 }}>Sim-Desktop</h1>
                       <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: TEXT_SECONDARY }}>NEX-OS Insider Preview</span>
                          <button style={{ border: 'none', background: 'none', color: 'var(--win-accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Cambiar nombre</button>
                       </div>
                    </div>
                 </div>
                 <div style={{ display: 'flex', gap: '8px' }}>
                    <MiniStausIcon icon={<WeatherCloudy20Regular />} label="OneDrive" />
                    <MiniStausIcon icon={<History24Regular />} label="Actualizado" />
                 </div>
              </header>

              <div style={{ background: BG_CARD, borderRadius: '12px', border: `1px solid ${BORDER_CARD}`, padding: '24px', marginBottom: '24px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Almacenamiento local (C:)</span>
                    <span style={{ fontSize: '12px', color: TEXT_SECONDARY }}>124 GB libres de 512 GB</span>
                 </div>
                 <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '75%', height: '100%', background: 'var(--win-accent)' }} />
                 </div>
              </div>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                 <SettingsCard icon={<Info24Regular />} title="Información" desc="Especificaciones del dispositivo, clave de Windows" onClick={() => setActiveTab('system')} />
                 <SettingsCard icon={<Speaker224Regular />} title="Sonido" desc="Niveles de volumen, dispositivos de salida" />
                 <SettingsCard icon={<Storage24Regular />} title="Almacenamiento" desc="Espacio de almacenamiento, reglas de limpieza" />
                 <section style={{ marginTop: '20px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>Pantalla</h3>
                    <div style={{ background: BG_CARD, borderRadius: '12px', border: `1px solid ${BORDER_CARD}`, padding: '24px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                             <Lightbulb24Regular style={{ width: 20, color: 'var(--win-accent)' }} />
                             <div>
                                <p style={{ fontSize: '14px', fontWeight: 500, margin: 0 }}>Brillo</p>
                                <p style={{ fontSize: '11px', color: TEXT_SECONDARY, margin: 0 }}>Ajustar la luminosidad de la pantalla principal</p>
                             </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px' }}>
                             <input 
                                type="range" 
                                min="10" 
                                max="100" 
                                value={brightness} 
                                onChange={(e) => setBrightness(Number(e.target.value))}
                                style={{ flex: 1, accentColor: 'var(--win-accent)' }}
                             />
                             <span style={{ fontSize: '12px', width: '30px' }}>{brightness}%</span>
                          </div>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                             <Clock24Regular style={{ width: 20, color: 'var(--win-accent)' }} />
                             <div>
                                <p style={{ fontSize: '14px', fontWeight: 500, margin: 0 }}>Luz nocturna</p>
                                <p style={{ fontSize: '11px', color: TEXT_SECONDARY, margin: 0 }}>Usar colores más cálidos para dormir mejor</p>
                             </div>
                          </div>
                          <Toggle checked={isNightLightEnabled} onChange={setIsNightLightEnabled} />
                       </div>
                    </div>
                 </section>
              </section>
           </div>
         )}

         {activeTab === 'apps' && (
           <div style={{ maxWidth: '800px' }}>
              <h1 style={{ fontSize: '28px', marginBottom: '32px', fontWeight: 600 }}>Aplicaciones instaladas</h1>
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                 <div style={{ position: 'absolute', left: '12px', top: '10px', color: TEXT_SECONDARY }}><Search24Regular style={{ width: 18 }} /></div>
                 <input 
                    placeholder="Buscar aplicaciones"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px 40px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '14px', outline: 'none' }}
                 />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                 {apps.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase())).map(app => (
                    <div key={app.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', background: BG_CARD, border: `1px solid ${BORDER_CARD}`, borderRadius: '8px' }}>
                       <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                          {React.cloneElement(app.icon as React.ReactElement<any>, { style: { width: 20 } })}
                       </div>
                       <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', fontWeight: 500, margin: 0 }}>{app.name}</p>
                          <p style={{ fontSize: '11px', color: TEXT_SECONDARY, margin: 0 }}>{app.version} • {app.size}</p>
                       </div>
                       <button style={{ padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', borderRadius: '4px', color: 'white', fontSize: '11px', cursor: 'pointer' }}>Desinstalar</button>
                    </div>
                 ))}
              </div>
           </div>
         )}

         {activeTab === 'accounts' && (
           <div style={{ maxWidth: '800px' }}>
              <h1 style={{ fontSize: '28px', marginBottom: '32px', fontWeight: 600 }}>Cuentas</h1>
              <div style={{ background: BG_CARD, borderRadius: '12px', border: `1px solid ${BORDER_CARD}`, padding: '32px', display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
                 <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--win-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', color: 'black' }}>
                   {userName.charAt(0).toUpperCase()}
                 </div>
                 <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '20px', margin: 0 }}>{userName}</h2>
                    <p style={{ fontSize: '14px', color: TEXT_SECONDARY }}>Administrador • Cuenta local</p>
                 </div>
              </div>

              <div style={{ background: BG_CARD, borderRadius: '12px', border: `1px solid ${BORDER_CARD}`, padding: '24px' }}>
                 <h3 style={{ fontSize: '16px', marginBottom: '16px', fontWeight: 600 }}>Editar nombre de usuario</h3>
                 <div style={{ display: 'flex', gap: '12px' }}>
                    <input 
                       value={newName}
                       onChange={(e) => setNewName(e.target.value)}
                       style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '14px' }}
                    />
                    <button 
                       onClick={() => setUserName(newName)}
                       style={{ padding: '8px 24px', background: 'var(--win-accent)', border: 'none', borderRadius: '6px', color: 'black', fontWeight: 600, cursor: 'pointer' }}
                    >
                       Guardar
                    </button>
                 </div>
              </div>
           </div>
         )}

         {activeTab === 'update' && (
           <div style={{ maxWidth: '800px' }}>
              <h1 style={{ fontSize: '28px', marginBottom: '32px', fontWeight: 600 }}>Windows Update</h1>
              <div style={{ background: BG_CARD, borderRadius: '12px', border: `1px solid ${BORDER_CARD}`, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '24px' }}>
                 {updateStatus === 'up-to-date' ? (
                    <div style={{ color: '#00cc6a' }}><CheckmarkCircle24Regular style={{ width: 64, height: 64 }} /></div>
                 ) : (
                    <div style={{ color: 'var(--win-accent)' }} className={updateStatus === 'checking' ? 'animate-spin' : ''}>
                       <ArrowClockwise24Regular style={{ width: 64, height: 64 }} />
                    </div>
                 ) }
                 
                 <div>
                    <h2 style={{ fontSize: '24px', margin: '0 0 8px 0' }}>
                       {updateStatus === 'up-to-date' ? 'Todo está actualizado' : 
                        updateStatus === 'checking' ? 'Buscando actualizaciones...' :
                        updateStatus === 'downloading' ? `Descargando... ${updateProgress}%` :
                        'Última búsqueda: hoy, 15:30'}
                    </h2>
                    <p style={{ fontSize: '14px', color: TEXT_SECONDARY }}>Versión instalada: NEX-OS Build 22621.2506</p>
                 </div>

                 {updateStatus === 'idle' && (
                    <button 
                       onClick={handleUpdate}
                       style={{ padding: '12px 32px', background: 'var(--win-accent)', border: 'none', borderRadius: '6px', color: 'black', fontWeight: 600, cursor: 'pointer' }}
                    >
                       Buscar actualizaciones ahora
                    </button>
                 )}

                 {(updateStatus === 'checking' || updateStatus === 'downloading') && (
                    <div style={{ width: '300px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                       <div style={{ width: `${updateProgress}%`, height: '100%', background: 'var(--win-accent)', transition: 'width 0.4s ease' }} />
                    </div>
                 )}
              </div>
           </div>
         )}

         {activeTab === 'personalization' && (
           <div style={{ maxWidth: '800px' }}>
              <h1 style={{ fontSize: '28px', marginBottom: '32px', fontWeight: 600 }}>Personalización</h1>
              
              {/* Accent Color Section */}
              <div style={{ background: BG_CARD, borderRadius: '12px', border: `1px solid ${BORDER_CARD}`, padding: '24px', marginBottom: '24px' }}>
                 <h2 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Color de énfasis</h2>
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {accentColors.map(color => (
                       <button 
                          key={color} 
                          onClick={() => setAccentColor(color)}
                          style={{ 
                             width: '32px', height: '32px', background: color, border: accentColor === color ? '3px solid white' : 'none', 
                             borderRadius: '4px', cursor: 'pointer'
                          }}
                       />
                    ))}
                 </div>
              </div>

              {/* Neon Experience Section */}
              <div style={{ background: BG_CARD, borderRadius: '12px', border: `1px solid ${BORDER_CARD}`, padding: '24px', marginBottom: '24px' }}>
                 <h2 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Experiencia Neon</h2>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                    {[
                       { id: 'none', label: 'Ninguno', color: '#1a1a1e' },
                       { id: 'cyberpunk', label: 'Cyberpunk', color: '#ff00ff' },
                       { id: 'matrix', label: 'Matrix', color: '#00ff41' },
                       { id: 'synthwave', label: 'Synthwave', color: '#f92aad' }
                    ].map(t => (
                       <button 
                          key={t.id} 
                          onClick={() => setNeonTheme(t.id as any)}
                          style={{ 
                             padding: '16px', borderRadius: '8px', border: neonTheme === t.id ? `2px solid ${t.color}` : '1px solid rgba(255,255,255,0.1)', 
                             background: neonTheme === t.id ? `${t.color}22` : 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer', transition: 'all 0.2s',
                             display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                          }}
                       >
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: t.color, boxShadow: neonTheme === t.id ? `0 0 15px ${t.color}` : 'none' }} />
                          <span style={{ fontSize: '12px', fontWeight: 500 }}>{t.label}</span>
                       </button>
                    ))}
                 </div>
              </div>

              {/* Wallpaper Section */}
              <div style={{ background: BG_CARD, borderRadius: '12px', border: `1px solid ${BORDER_CARD}`, padding: '24px' }}>
                 <h2 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Fondo de escritorio</h2>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                     {wallpapers.map(wp => (
                       <button 
                          key={wp} 
                          onClick={() => setWallpaper(wp)}
                          style={{ 
                             aspectRatio: '16/10', borderRadius: '8px', padding: 0, overflow: 'hidden', cursor: 'pointer',
                             border: wallpaper === wp ? `3px solid var(--win-accent)` : 'none',
                             boxShadow: wallpaper === wp ? '0 0 15px var(--win-accent)' : 'none',
                             transition: 'all 0.2s'
                          }}
                       >
                          <img src={wp} alt="Wall" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: wallpaper === wp ? 1 : 0.7 }} />
                       </button>
                     ))}
                 </div>
              </div>
           </div>
         )}

      </main>
    </div>
  );
};

// --- Sub-Components ---

const MiniStausIcon = ({ icon, label }: { icon: any, label: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '84px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER_CARD}`, borderRadius: '10px', padding: '12px 4px' }}>
     <div style={{ color: 'var(--win-accent)' }}>{React.cloneElement(icon as React.ReactElement<any>, { style: { width: 18, height: 18 } })}</div>
     <span style={{ fontSize: '10px', color: TEXT_SECONDARY, textAlign: 'center' }}>{label}</span>
  </div>
);

const SettingsCard = ({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick?: () => void }) => (
  <button 
     onClick={onClick}
     style={{ 
        display: 'flex', alignItems: 'center', gap: '20px', width: '100%', padding: '18px 20px', background: BG_CARD, border: `1px solid ${BORDER_CARD}`, 
        borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s'
     }}
     onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
     onMouseLeave={(e) => e.currentTarget.style.background = BG_CARD}
  >
     <div style={{ color: 'var(--win-accent)', display: 'flex' }}>
        {React.cloneElement(icon as React.ReactElement<any>, { style: { width: 22, height: 22 } })}
     </div>
     <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>{title}</span>
        <span style={{ fontSize: '11px', color: TEXT_SECONDARY }}>{desc}</span>
     </div>
     <ChevronRight24Regular style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.2)' }} />
  </button>
);

const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) => (
  <button 
     onClick={() => onChange(!checked)}
     style={{ 
        width: '40px', height: '20px', borderRadius: '10px', background: checked ? 'var(--win-accent)' : 'rgba(255,255,255,0.1)', 
        border: `1px solid ${checked ? 'transparent' : 'rgba(255,255,255,0.3)'}`, cursor: 'pointer', position: 'relative', transition: 'all 0.2s'
     }}
  >
     <div style={{ 
        position: 'absolute', top: '2px', left: checked ? '22px' : '2px', width: '14px', height: '14px', 
        background: checked ? 'black' : 'white', borderRadius: '50%', transition: 'all 0.2s' 
     }} />
  </button>
);

export default ControlPanel;
