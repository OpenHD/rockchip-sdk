import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { ArrowRight24Regular, Globe24Regular, Speaker224Regular, Power24Regular, PersonAdd24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import { useSettings } from '../../context/SettingsContext';
import { useIsPhone } from '../../hooks/useMobileAppShell';

const MobileLockScreen = lazy(() => import('../mobile/MobileLockScreen'));

interface LoginScreenProps {
  onLogin: () => void;
  wallpaper: string;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, wallpaper }) => {
  const isPhone = useIsPhone();
  const { osType, users, currentUserId, setCurrentUserId, addUser } = useSettings();
  const [showLogin, setShowLogin] = useState(false);
  const [time, setTime] = useState(new Date());
  
  // Login State
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  
  // Add User State
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

  const currentUser = users.find(u => u.id === currentUserId) || users[0];

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLogin(false);
        setIsAddingUser(false);
        setError('');
        setPin('');
      } else if (!showLogin) {
        setShowLogin(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogin]);

  useEffect(() => {
    if (showLogin && !isAddingUser && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    } else if (showLogin && isAddingUser && newNameRef.current) {
      setTimeout(() => newNameRef.current?.focus(), 300);
    }
  }, [showLogin, isAddingUser, currentUserId]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.pin && pin !== currentUser.pin) {
      setError('El PIN es incorrecto. Inténtalo de nuevo.');
      setPin('');
      return;
    }
    setError('');
    onLogin();
  };

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserName.trim() === '') {
      setError('El nombre no puede estar vacío');
      return;
    }
    addUser(newUserName.trim(), newUserPin.trim());
    setIsAddingUser(false);
    setNewUserName('');
    setNewUserPin('');
    setError('');
  };

  const handleUserSelect = (id: string) => {
    setCurrentUserId(id);
    setPin('');
    setError('');
    setIsAddingUser(false);
  };

  if (isPhone) {
    return (
      <Suspense fallback={<div style={{ width: '100%', height: '100%', background: '#000' }} />}>
        <MobileLockScreen onLogin={onLogin} wallpaper={wallpaper} />
      </Suspense>
    );
  }

  return (
    <div 
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: osType === 'nexos' ? '"JetBrains Mono", monospace' : '"Segoe UI Variable Display", "Segoe UI", sans-serif',
        backgroundImage: osType === 'nexos' 
          ? 'linear-gradient(to bottom, #000, #0a0a0a), url("https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070")'
          : `url("${wallpaper}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        userSelect: 'none',
      }}
      onClick={() => { if (!showLogin) setShowLogin(true); }}
    >
      {/* Overlay Background Blur */}
      <div 
        style={{ 
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: showLogin ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0)',
          backdropFilter: showLogin ? 'blur(30px) saturate(150%)' : 'blur(0px)',
          WebkitBackdropFilter: showLogin ? 'blur(30px) saturate(150%)' : 'blur(0px)',
          transition: 'all 0.5s cubic-bezier(0.2, 0, 0, 1)',
          pointerEvents: 'none',
        }} 
      />

      {/* Clock / Date (Lock Screen Mode) */}
      <div 
        style={{
          position: 'absolute',
          top: '12%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color: osType === 'nexos' ? '#00ffff' : 'white',
          textShadow: osType === 'nexos' ? '0 0 20px rgba(0,255,255,0.6)' : '0 2px 10px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          transform: showLogin ? 'translateY(-100px)' : 'translateY(0)',
          opacity: showLogin ? 0 : 1,
          pointerEvents: showLogin ? 'none' : 'auto',
          transition: 'transform 0.5s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s ease',
        }}
      >
        <span style={{ fontSize: '7.5rem', fontWeight: osType === 'nexos' ? 700 : 500, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '8px', textTransform: 'uppercase', letterSpacing: osType === 'nexos' ? '4px' : 'normal' }}>
           {new Intl.DateTimeFormat('es-ES', { weekday: 'long', month: 'long', day: 'numeric' }).format(time)}
        </span>
      </div>

      {/* Main Form content */}
      <div 
        style={{
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: showLogin ? 'translateY(0)' : 'translateY(80px)',
          opacity: showLogin ? 1 : 0,
          pointerEvents: showLogin ? 'auto' : 'none',
          transition: 'transform 0.5s cubic-bezier(0.2, 0, 0, 1), opacity 0.5s ease',
          transitionDelay: showLogin ? '0.1s' : '0s'
        }}
      >
        {!isAddingUser ? (
          <>
            {/* User Avatar */}
            <div 
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                marginBottom: '24px',
                border: '2px solid transparent',
                transition: 'border-color 0.2s',
              }}
            >
              <img 
                src={currentUser?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300&auto=format&fit=crop"}
                alt="User Avatar" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* User Name */}
            <h1 style={{ 
              color: osType === 'nexos' ? '#00ffff' : 'white', 
              fontSize: '36px', 
              fontWeight: 600, 
              margin: '0 0 24px 0', 
              textShadow: osType === 'nexos' ? '0 0 15px rgba(0,255,255,0.5)' : '0 2px 4px rgba(0,0,0,0.3)',
              letterSpacing: '-0.01em',
              textTransform: osType === 'nexos' ? 'uppercase' : 'none'
            }}>
              {currentUser?.name}
            </h1>
            
            {/* Login Form */}
            <form 
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }} 
              onSubmit={handleLoginSubmit}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  ref={inputRef}
                  type="password" 
                  placeholder={currentUser?.pin ? "PIN" : "Presiona Enter para entrar"} 
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  style={{
                    width: '320px',
                    height: '44px',
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(20px)',
                    border: 'none',
                    borderBottom: '2px solid transparent',
                    color: 'black',
                    fontSize: '15px',
                    padding: '0 40px 0 16px',
                    borderRadius: '4px',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.1)',
                    outline: 'none',
                    transition: 'background-color 0.2s, border-bottom-color 0.2s',
                  }}
                  onFocus={(e) => {
                    e.target.style.backgroundColor = '#ffffff';
                    e.target.style.borderBottomColor = '#0078D4';
                  }}
                  onBlur={(e) => {
                    e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
                    e.target.style.borderBottomColor = 'transparent';
                  }}
                />
                {/* Submit Arrow Button */}
                <button 
                  type="submit" 
                  style={{
                    position: 'absolute',
                    right: '4px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    borderRadius: '2px',
                    transition: 'color 0.2s, background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)';
                    e.currentTarget.style.color = 'rgba(0,0,0,0.8)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'rgba(0,0,0,0.5)';
                  }}
                >
                  <ArrowRight24Regular />
                </button>
              </div>
              {error && <span style={{ color: '#ff8c8c', marginTop: '12px', fontSize: '14px', fontWeight: 500 }}>{error}</span>}
            </form>
          </>
        ) : (
          /* Add User Form */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '320px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '32px', borderRadius: '12px', backdropFilter: 'blur(20px)' }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: 'white', margin: 0, fontSize: '20px', fontWeight: 400 }}>Añadir nuevo usuario</h2>
              <button onClick={() => setIsAddingUser(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                <Dismiss24Regular />
              </button>
            </div>
            
            <form onSubmit={handleAddUserSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Nombre de usuario</label>
                <input 
                  ref={newNameRef}
                  type="text" 
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginBottom: '4px', display: 'block' }}>PIN (Opcional)</label>
                <input 
                  type="password" 
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                />
              </div>
              {error && <span style={{ color: '#ff8c8c', fontSize: '13px' }}>{error}</span>}
              <button 
                type="submit"
                style={{ marginTop: '8px', height: '40px', borderRadius: '4px', border: 'none', background: 'var(--win-accent, #0078D4)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
              >
                Crear usuario
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Users List (Bottom Left) */}
      <div 
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          color: 'white',
          opacity: showLogin && !isAddingUser ? 1 : 0,
          transform: showLogin ? 'translateX(0)' : 'translateX(-20px)',
          pointerEvents: showLogin && !isAddingUser ? 'auto' : 'none',
          transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0, 0, 1)',
          transitionDelay: showLogin ? '0.2s' : '0s'
        }}
      >
        {users.map(user => (
          <div 
            key={user.id}
            onClick={() => handleUserSelect(user.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              padding: '8px 16px 8px 8px',
              borderRadius: '8px',
              backgroundColor: currentUserId === user.id ? 'rgba(255,255,255,0.15)' : 'transparent',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => { if (currentUserId !== user.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { if (currentUserId !== user.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <img src={user.avatar} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
            <span style={{ fontSize: '14px', fontWeight: currentUserId === user.id ? 600 : 400 }}>{user.name}</span>
          </div>
        ))}
        
        <div 
          onClick={() => { setIsAddingUser(true); setError(''); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            padding: '8px 16px 8px 8px',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            transition: 'background-color 0.2s',
            marginTop: '8px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)' }
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent' }
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <PersonAdd24Regular />
          </div>
          <span style={{ fontSize: '14px', fontWeight: 400 }}>Añadir usuario</span>
        </div>
      </div>

      {/* Bottom Right System Icons */}
      <div 
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          color: 'white',
          opacity: showLogin ? 1 : 0,
          transform: showLogin ? 'translateY(0)' : 'translateY(20px)',
          pointerEvents: showLogin ? 'auto' : 'none',
          transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0, 0, 1)',
          transitionDelay: showLogin ? '0.2s' : '0s'
        }}
      >
        {[
          { icon: <Globe24Regular />, title: 'Red' },
          { icon: <Speaker224Regular />, title: 'Accesibilidad' },
          { icon: <Power24Regular />, title: 'Energía' }
        ].map((item, index) => (
          <div 
            key={index}
            title={item.title}
            style={{
              padding: '6px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              transition: 'background-color 0.1s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {item.icon}
          </div>
        ))}
      </div>

    </div>
  );
};

export default LoginScreen;
