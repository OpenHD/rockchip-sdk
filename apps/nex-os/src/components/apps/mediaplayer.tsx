import React, { useState, useEffect } from 'react';
import { Play24Filled, Pause24Filled, Previous24Filled, Next24Filled, Speaker224Filled, MusicNote224Filled } from '@fluentui/react-icons';

// --- ICONO EXPORTADO PARA NEX OS ---
export const MediaPlayerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="5" fill="#0067c0" />
    <path d="M9.5 7.5V16.5L16.5 12L9.5 7.5Z" fill="white" />
  </svg>
);

interface Track {
  id: number;
  title: string;
  artist: string;
  cover: string;
  url: string;
}

const MediaPlayerApp: React.FC = () => {
  // Estado de reproducción
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [volume, setVolume] = useState(80);
  const [progress, setProgress] = useState(30); // Simulado para el post de LinkedIn

  // Mock de playlist (Aquí podés poner tus tracks de Reload Souls)
  const playlist: Track[] = [
    { id: 1, title: "Sin un peso", artist: "Nafta", cover: "https://i.scdn.co/image/ab67616d0000b273b4352e825e683315668d9047", url: "" },
    { id: 2, title: "Progressive House Mix", artist: "Reload Souls", cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300", url: "" },
    { id: 3, title: "Techno Session", artist: "Reload Souls", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300", url: "" },
  ];

  const currentTrack = playlist[currentTrackIndex];

  const togglePlay = () => setIsPlaying(!isPlaying);
  const nextTrack = () => setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
  const prevTrack = () => setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 1));
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="w11-player-root">
      {/* Sidebar - Lista de reproducción */}
      <div className="w11-sidebar">
        <div className="sidebar-header">Biblioteca</div>
        <div className="track-list">
          {playlist.map((track, index) => (
            <div 
              key={track.id} 
              className={`track-item ${index === currentTrackIndex ? 'active' : ''}`}
              onClick={() => setCurrentTrackIndex(index)}
            >
              <img src={track.cover} alt="" className="track-thumb" />
              <div className="track-info">
                <span className="t-name">{track.title}</span>
                <span className="t-artist">{track.artist}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="w11-main-content">
        <div className="now-playing-container">
          <div className="glass-card">
            <img src={currentTrack.cover} alt="Cover" className="main-cover shadow-lg" />
            <div className="main-info">
              <h1>{currentTrack.title}</h1>
              <p>{currentTrack.artist}</p>
            </div>
          </div>
        </div>

        {/* Controles Flotantes (Estilo W11) */}
        <div className="w11-controls-bar">
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          <div className="controls-row">
            <div className="volume-control">
              <Speaker224Filled className="icon" />
              <input type="range" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            </div>

            <div className="playback-btns">
              <Previous24Filled className="p-icon" onClick={prevTrack} />
              <button className="play-btn" onClick={togglePlay}>
                {isPlaying ? <Pause24Filled /> : <Play24Filled />}
              </button>
              <Next24Filled className="p-icon" onClick={nextTrack} />
            </div>

            <div className="extra-btns">
              <MusicNote224Filled className="icon" title="Letras" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .w11-player-root { display: flex; height: 100%; background: #1a1a1a; color: white; font-family: 'Segoe UI', sans-serif; overflow: hidden; }
        
        /* Sidebar */
        .w11-sidebar { width: 240px; background: rgba(0,0,0,0.3); border-right: 1px solid #333; padding: 20px 10px; display: flex; flex-direction: column; }
        .sidebar-header { font-weight: 600; font-size: 14px; margin-bottom: 15px; padding-left: 10px; color: #aaa; }
        .track-list { flex: 1; overflow-y: auto; }
        .track-item { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 6px; cursor: pointer; transition: 0.2s; margin-bottom: 4px; }
        .track-item:hover { background: rgba(255,255,255,0.1); }
        .track-item.active { background: rgba(0, 103, 192, 0.4); border-left: 3px solid #00c2ff; }
        .track-thumb { width: 36px; height: 36px; border-radius: 4px; object-fit: cover; }
        .track-info { display: flex; flex-direction: column; overflow: hidden; }
        .t-name { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .t-artist { font-size: 11px; color: #888; }

        /* Main Content */
        .w11-main-content { flex: 1; display: flex; flex-direction: column; position: relative; background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%); }
        .now-playing-container { flex: 1; display: flex; align-items: center; justify-content: center; padding-bottom: 100px; }
        .glass-card { text-align: center; }
        .main-cover { width: 280px; height: 280px; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); margin-bottom: 25px; transition: transform 0.3s; }
        .main-cover:hover { transform: scale(1.02); }
        .main-info h1 { font-size: 28px; margin: 0; font-weight: 700; }
        .main-info p { color: #00c2ff; font-size: 18px; margin-top: 5px; }

        /* W11 Controls Bar */
        .w11-controls-bar { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(30, 30, 30, 0.85); backdrop-filter: blur(20px); border-top: 1px solid #333; padding: 10px 20px 20px; }
        .progress-container { margin-bottom: 10px; }
        .progress-bar { height: 4px; background: #444; border-radius: 2px; position: relative; cursor: pointer; }
        .progress-fill { height: 100%; background: #00c2ff; border-radius: 2px; transition: 0.1s; }
        
        .controls-row { display: flex; align-items: center; justify-content: space-between; }
        .playback-btns { display: flex; align-items: center; gap: 20px; }
        .play-btn { width: 42px; height: 42px; border-radius: 50%; border: none; background: white; color: black; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .play-btn:hover { transform: scale(1.1); background: #eee; }
        .p-icon { font-size: 24px; cursor: pointer; color: #ccc; }
        .p-icon:hover { color: white; }
        
        .volume-control { display: flex; align-items: center; gap: 10px; width: 150px; }
        .volume-control input { flex: 1; accent-color: #00c2ff; cursor: pointer; }
        .icon { color: #888; cursor: pointer; }
        .icon:hover { color: white; }
      `}</style>
    </div>
  );
};

export default MediaPlayerApp;