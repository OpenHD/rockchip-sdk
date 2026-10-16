import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

// --- TYPES ---
export interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
  url: string;
  embedUrl?: string;
  service: 'youtube' | 'youtube-music' | 'spotify';
  kind?: 'video' | 'playlist';
  videoId?: string;
}

// --- CONTEXT ---
interface MusicPlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  queue: Track[];
  favorites: Track[];
  history: Track[];
  currentPlaylist: Track[];
  showLyrics: boolean;
  isGlobalMiniPlayerVisible: boolean;
  
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (vol: number) => void;
  seekTo: (percent: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  toggleFavorite: (track: Track) => void;
  isFavorite: (trackId: string) => boolean;
  clearHistory: () => void;
  setShowLyrics: (show: boolean) => void;
  toggleGlobalMiniPlayer: () => void;
  setCurrentPlaylist: (playlist: Track[]) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (dur: number) => void;
  setProgress: (prog: number) => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

// --- PROVIDER ---
export const MusicPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<Track[]>([]);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<Track[]>([]);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isGlobalMiniPlayerVisible, setIsGlobalMiniPlayerVisible] = useState(false);

  // --- LOCAL STORAGE ---
  useEffect(() => {
    const savedFavorites = localStorage.getItem('nexPlayerFavorites');
    const savedHistory = localStorage.getItem('nexPlayerHistory');
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => {
    localStorage.setItem('nexPlayerFavorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('nexPlayerHistory', JSON.stringify(history));
  }, [history]);

  // --- PLAYBACK ---
  const playTrack = useCallback((track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    setProgress(0);
    
    setHistory(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      return [track, ...filtered].slice(0, 50);
    });
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const nextTrack = useCallback(() => {
    if (queue.length > 0) {
      const next = queue[0];
      setQueue(prev => prev.slice(1));
      if (currentTrack) addToQueue(currentTrack);
      playTrack(next);
    } else if (currentPlaylist.length > 0) {
      const currentIndex = currentPlaylist.findIndex(t => t.id === currentTrack?.id);
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % currentPlaylist.length;
        playTrack(currentPlaylist[nextIndex]);
      }
    }
  }, [queue, currentPlaylist, currentTrack, playTrack]);

  const prevTrack = useCallback(() => {
    if (history.length > 1) {
      const prev = history[1];
      playTrack(prev);
    } else if (currentPlaylist.length > 0) {
      const currentIndex = currentPlaylist.findIndex(t => t.id === currentTrack?.id);
      if (currentIndex !== -1) {
        const prevIndex = (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        playTrack(currentPlaylist[prevIndex]);
      }
    }
  }, [history, currentPlaylist, currentTrack, playTrack]);

  // --- QUEUE ---
  const addToQueue = useCallback((track: Track) => {
    setQueue(prev => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    setQueue(prev => prev.filter(t => t.id !== trackId));
  }, []);

  // --- FAVORITES ---
  const isFavorite = useCallback((trackId: string) => {
    return favorites.some(t => t.id === trackId);
  }, [favorites]);

  const toggleFavorite = useCallback((track: Track) => {
    if (isFavorite(track.id)) {
      setFavorites(prev => prev.filter(t => t.id !== track.id));
    } else {
      setFavorites(prev => [track, ...prev]);
    }
  }, [isFavorite]);

  // --- GLOBAL MINIPLAYER ---
  const toggleGlobalMiniPlayer = useCallback(() => {
    setIsGlobalMiniPlayerVisible(prev => !prev);
  }, []);

  // --- SEEK ---
  const seekTo = useCallback((percent: number) => {
    setProgress(percent);
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  const value = useMemo(
    () => ({
      currentTrack,
      isPlaying,
      volume,
      progress,
      duration,
      queue,
      favorites,
      history,
      currentPlaylist,
      showLyrics,
      isGlobalMiniPlayerVisible,
      playTrack,
      togglePlay,
      nextTrack,
      prevTrack,
      setVolume,
      seekTo,
      addToQueue,
      removeFromQueue,
      toggleFavorite,
      isFavorite,
      clearHistory,
      setShowLyrics,
      toggleGlobalMiniPlayer,
      setCurrentPlaylist,
      setIsPlaying,
      setDuration,
      setProgress,
    }),
    [
      currentTrack, isPlaying, volume, progress, duration, queue, favorites, history,
      currentPlaylist, showLyrics, isGlobalMiniPlayerVisible, playTrack, togglePlay,
      nextTrack, prevTrack, seekTo, addToQueue, removeFromQueue, toggleFavorite,
      isFavorite, clearHistory, toggleGlobalMiniPlayer,
    ],
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
    </MusicPlayerContext.Provider>
  );
};

// --- HOOK ---
export const useMusicPlayer = () => {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
  }
  return context;
};
