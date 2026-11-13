import React, { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import {
  Play24Filled,
  Pause24Filled,
  Previous24Filled,
  Next24Filled,
  Speaker224Filled,
  MusicNote224Filled,
  Search24Regular,
  Heart24Filled,
  Heart24Regular,
  Book24Regular,
  History24Regular,
  List24Regular,
  Star24Regular,
  Home24Filled,
  Library24Filled,
  Add24Filled,
  ArrowRight24Filled,
  People24Regular,
  Person24Regular,
  Share24Regular,
  Edit24Regular,
  LockClosedRegular,
  Globe24Regular,
  Star24Filled,
  Delete24Regular,
  Sparkle24Regular,
  Dismiss24Regular,
  Options24Regular,
  ArrowShuffle24Filled,
  ArrowRepeatAll24Regular,
  ArrowRepeat124Regular,
} from '@fluentui/react-icons';
import { useMusicSync } from '../../hooks/useMusicSync';
import { useMobilePlaybackPersistence, loadPlaybackSession } from '../../hooks/useMobilePlaybackPersistence';
import { useNexAudioEnhance } from '../../hooks/useNexAudioEnhance';
import { useNexDspEngine } from '../../hooks/useNexDspEngine';
import { useNexStreamPlayer } from '../../hooks/useNexStreamPlayer';
import {
  closeSidebarWithHistory,
  exitMobileApp,
  useIsMobile,
  useIsStandalonePwa,
  useMobileScrollLock,
  useSidebarBackClose,
} from '../../hooks/useMobileAppShell';
import { SupabaseAuthProvider, useSupabaseAuthContext } from '../../context/SupabaseAuthContext';
import { useCloudLibrary, type CloudSyncStatus } from '../../hooks/useCloudLibrary';
import { useUserProfiles } from '../../hooks/useUserProfiles';
import LiveRoomPanel from '../music/LiveRoomPanel';
import GlobalPlaylistsView, { PublishToCloudButton } from '../music/GlobalPlaylistsView';
import UsersDirectoryView from '../music/UsersDirectoryView';
import CloudSyncBadge from '../music/CloudSyncBadge';
import AudioEnhancePanel from '../music/AudioEnhancePanel';
import MusicOnboardingBanner from '../music/MusicOnboardingBanner';
import type { Track, ChatMessage, LiveReaction, RoomUser, DjEqSettings, DjModeState, DjVoteEntry, Playlist } from '../../types/music';
import { shuffleTracks, PREVIEW_SECONDS, type CloudPlayMode } from '../../utils/cloudPlaylist';
import { fetchSpotifyPlaylist, spotifyTracksToNexTracks, startSpotifyAuth, getSpotifySession } from '../../utils/spotifyPlaylist';
import { resolveTrackForPlayback, trackNeedsYoutubeResolution, reResolveTrack, prefetchTrackResolution } from '../../utils/resolveTrack';
import { getSupabase } from '../../lib/supabase';
import PartyModeLayer from '../music/PartyModeLayer';
import { useMusicKeyboardShortcuts } from '../../hooks/useMusicKeyboardShortcuts';
import { usePlaybackModes } from '../../hooks/usePlaybackModes';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import {
  createShortPlaylistShareUrl,
  decodePlaylistShareCode,
  extractPlaylistShareCodeFromInput,
  fetchShortPlaylistShare,
  isValidRoomCode,
  isValidShortShareCode,
} from '../../utils/playlistShare';
import {
  buildNexMusicHomeUrl,
  buildRoomInviteUrl,
  shareOrCopy,
  shareResultToast,
} from '../../utils/share';
import { fetchCloudPlaylistById } from '../../utils/fetchCloudPlaylist';
import { recordFavorite, recordPlay, loadWeeklyStats } from '../../utils/weeklyStats';
import { buildRadioFromTrack } from '../../utils/radioFromTrack';
import { MATCH_LABEL } from '../../utils/matchQuality';
import PwaInstallBanner from '../music/PwaInstallBanner';
import RoomInviteSticky from '../music/RoomInviteSticky';
import WeeklyStatsCard from '../music/WeeklyStatsCard';

// --- SPOTIFY SDK GLOBAL TYPES ---
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: {
      Player: new (elementId: string, options: any) => any;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
  }
}

// --- TYPES ---
type ServiceType = 'youtube' | 'youtube-music' | 'spotify';

interface YouTubeResult {
  id: string;
  kind: 'video' | 'playlist';
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
  description: string;
}

interface SpotifyResult {
  id: string;
  title: string;
  artist: string;
  cover: string;
  url: string;
  service: 'spotify';
}

type SearchResult = YouTubeResult | SpotifyResult;

// --- STANDALONE CONTEXT ---
interface SpotifyMiniContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  queue: Track[];
  favorites: Track[];
  history: Track[];
  showLyrics: boolean;
  playTrack: (track: Track) => void | Promise<void>;
  /** Reproduce desde un índice y encola el resto para reproducción continua. */
  playPlaylistFrom: (tracks: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  repeatMode: 'off' | 'all' | 'one';
  shuffleOn: boolean;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setVolume: (vol: number) => void;
  seekTo: (percent: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  toggleFavorite: (track: Track) => void;
  isFavorite: (trackId: string) => boolean;
  setShowLyrics: (show: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (dur: number) => void;
  setProgress: (prog: number) => void;
  // Live room (Socket.io)
  showLivePanel: boolean;
  setShowLivePanel: (show: boolean) => void;
  syncConnected: boolean;
  roomCode: string | null;
  isRoomHost: boolean;
  roomUsers: RoomUser[];
  liveChat: ChatMessage[];
  liveReactions: LiveReaction[];
  syncError: string | null;
  djMode: DjModeState;
  djPool: DjVoteEntry[];
  djEq: DjEqSettings;
  createLiveRoom: (username: string, enableDj?: boolean) => void;
  joinLiveRoom: (code: string, username: string) => void;
  leaveLiveRoom: () => void;
  sendLiveChat: (text: string) => void;
  sendLiveReaction: (emoji: string) => void;
  toggleDjMode: (enabled: boolean) => void;
  setDjAutoPlay: (autoPlay: boolean) => void;
  updateDjEq: (eq: DjEqSettings) => void;
  suggestToDj: (track: Track) => void;
  voteDjTrack: (entryId: string) => void;
  playTopDjTrack: () => void;
  clearDjPool: () => void;
  // New features for playlists
  nickname: string;
  setNickname: (name: string) => void;
  playlists: Playlist[];
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>;
  addPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void;
  togglePlaylistPrivacy: (id: string) => void;
  renamePlaylist: (id: string, newName: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  voteForPlaylist: (playlistId: string) => void;
  unvoteForPlaylist: (playlistId: string) => void;
  activePlaylistId: string | null;
  setActivePlaylistId: (id: string | null) => void;
  cloudSyncStatus: CloudSyncStatus;
  supabaseUserId: string | null;
  supabaseAuthReady: boolean;
  supabaseAuthError: string | null;
  supabaseRetry: () => void;
}

const SpotifyMiniContext = createContext<SpotifyMiniContextType | undefined>(undefined);

// (no default tracks — the playlist starts empty)

export const SpotifyMiniStandaloneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SupabaseAuthProvider>
    <SpotifyMiniStandaloneProviderInner>{children}</SpotifyMiniStandaloneProviderInner>
  </SupabaseAuthProvider>
);

const SpotifyMiniStandaloneProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const restoredSession = loadPlaybackSession();

  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => restoredSession?.currentTrack ?? null);
  const [isPlaying, setIsPlaying] = useState(() => restoredSession?.isPlaying ?? false);
  const [volume, setVolume] = useState(() => restoredSession?.volume ?? 80);
  const [progress, setProgress] = useState(() => restoredSession?.progress ?? 0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<Track[]>(() => restoredSession?.queue ?? []);
  const [showLivePanel, setShowLivePanel] = useState(false);
  const remoteUpdateRef = useRef(false);

  const sync = useMusicSync();
  const { userId, isReady: authReady, error: authError, retry: supabaseRetry } = useSupabaseAuthContext();
  const { repeatMode, shuffleOn, cycleRepeat, toggleShuffle } = usePlaybackModes();
  const repeatModeRef = useRef(repeatMode);
  const shuffleOnRef = useRef(shuffleOn);
  repeatModeRef.current = repeatMode;
  shuffleOnRef.current = shuffleOn;

  const [nickname, setNickname] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('spotifyMiniNickname');
      return saved || '';
    } catch {
      return '';
    }
  });

  const [favorites, setFavorites] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('spotifyMiniFavorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [history, setHistory] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('spotifyMiniHistory');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem('spotifyMiniPlaylists');
      const loadedPlaylists = saved ? JSON.parse(saved) : [];
      
      // Check for old query params first (backward compatibility)
      const params = new URLSearchParams(window.location.search);
      let sharedPlaylistCode = params.get('playlist');
      
      // Check for new hash format
      if (!sharedPlaylistCode && window.location.hash) {
        const hashParts = window.location.hash.split('/');
        if (hashParts.length > 1) {
          sharedPlaylistCode = hashParts[hashParts.length - 1];
        }
      }
      
      if (sharedPlaylistCode) {
        try {
          const p = decodePlaylistShareCode(sharedPlaylistCode);
          if (p) {
            loadedPlaylists.push(p);
            try {
              localStorage.setItem('nexMusicOnboardingSeen', '1');
            } catch { /* ignore */ }
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => (window as any).__nexShowToast?.(`Lista compartida "${p.name}" importada con éxito! 🎵`, 'success'), 500);
          }
        } catch (e) {
          console.error("Invalid shared playlist", e);
        }
      }
      
      return loadedPlaylists;
    } catch {
      return [];
    }
  });

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);

  // Save nickname and playlists to localStorage
  useEffect(() => {
    localStorage.setItem('spotifyMiniNickname', nickname);
  }, [nickname]);

  useEffect(() => {
    localStorage.setItem('spotifyMiniPlaylists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem('spotifyMiniFavorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('spotifyMiniHistory', JSON.stringify(history));
  }, [history]);

  const { cloudSyncStatus } = useCloudLibrary({
    userId,
    isAuthReady: authReady,
    authError,
    nickname,
    favorites,
    history,
    setFavorites,
    setHistory,
  });
  useUserProfiles(nickname, userId);

  useEffect(() => {
    sync.onRemotePlayback((state) => {
      remoteUpdateRef.current = true;
      setCurrentTrack(state.currentTrack);
      setIsPlaying(state.isPlaying);
      setProgress(state.progress);
      setVolume(state.volume);
      if (state.queue) setQueue(state.queue);
      requestAnimationFrame(() => {
        remoteUpdateRef.current = false;
      });
    });
    sync.onRemoteQueue((nextQueue) => {
      remoteUpdateRef.current = true;
      setQueue(nextQueue);
      requestAnimationFrame(() => {
        remoteUpdateRef.current = false;
      });
    });
    sync.onDjPlayWinner((track) => {
      remoteUpdateRef.current = true;
      setCurrentTrack(track);
      setIsPlaying(true);
      setProgress(0);
      setHistory((prev) => {
        const filtered = prev.filter((t) => t.id !== track.id);
        return [track, ...filtered].slice(0, 50);
      });
      requestAnimationFrame(() => {
        remoteUpdateRef.current = false;
      });
    });
  }, [sync.onRemotePlayback, sync.onRemoteQueue, sync.onDjPlayWinner]);

  useEffect(() => {
    if (remoteUpdateRef.current || !sync.isHost || !sync.roomCode) return;
    sync.broadcastPlayback({ currentTrack, isPlaying, progress, volume });
  }, [currentTrack, isPlaying, progress, volume, sync.isHost, sync.roomCode, sync.broadcastPlayback]);

  useEffect(() => {
    if (remoteUpdateRef.current || !sync.isHost || !sync.roomCode) return;
    sync.broadcastQueue(queue);
  }, [queue, sync.isHost, sync.roomCode, sync.broadcastQueue]);

  const playTrack = useCallback(async (track: Track) => {
    let playable = track;
    if (trackNeedsYoutubeResolution(track)) {
      const resolved = await resolveTrackForPlayback(track);
      if (!resolved) {
        (window as any).__nexShowToast?.(
          `No se encontró "${track.title}" en YouTube`,
          'error',
        );
        return;
      }
      playable = resolved;
      // Guardar videoId en playlists para el próximo play instantáneo
      if (resolved.videoId) {
        setPlaylists((prev) =>
          prev.map((p) => ({
            ...p,
            tracks: p.tracks.map((t) =>
              t.id === track.id && !t.videoId
                ? { ...t, videoId: resolved.videoId }
                : t,
            ),
          })),
        );
      }
    }
    setCurrentTrack(playable);
    setIsPlaying(true);
    setProgress(0);
    recordPlay(playable.id, playable.title, 180);
    setHistory(prev => {
      const filtered = prev.filter(t => t.id !== track.id && t.id !== playable.id);
      return [playable, ...filtered].slice(0, 50);
    });
  }, []);

  const playPlaylistFrom = useCallback((tracks: Track[], startIndex = 0) => {
    if (!tracks.length) return;
    let list = [...tracks];
    let idx = Math.max(0, Math.min(startIndex, list.length - 1));
    if (shuffleOnRef.current) {
      const current = list[idx];
      const rest = shuffleTracks(list.filter((_, i) => i !== idx));
      list = [current, ...rest];
      idx = 0;
    }
    setQueue(list.slice(idx + 1));
    void playTrack(list[idx]);
  }, [playTrack]);

  // Precargar el siguiente (y el de después) de la cola
  useEffect(() => {
    const upcoming = queue[0];
    const upcoming2 = queue[1];
    if (upcoming) prefetchTrackResolution(upcoming);
    if (upcoming2) prefetchTrackResolution(upcoming2);
    if (!upcoming || !trackNeedsYoutubeResolution(upcoming)) return;
    let cancelled = false;
    void resolveTrackForPlayback(upcoming).then((resolved) => {
      if (cancelled || !resolved?.videoId) return;
      setQueue((prev) => {
        if (!prev[0] || prev[0].id !== upcoming.id || prev[0].videoId) return prev;
        return [{ ...prev[0], videoId: resolved.videoId }, ...prev.slice(1)];
      });
    });
    return () => {
      cancelled = true;
    };
  }, [queue[0]?.id, queue[1]?.id, currentTrack?.id]);

  const tryDjAutoNext = useCallback(() => {
    if (
      sync.isHost &&
      sync.roomCode &&
      sync.djMode.enabled &&
      sync.djMode.autoPlay &&
      sync.djPool.length > 0
    ) {
      sync.playTopDjTrack();
      return true;
    }
    return false;
  }, [sync]);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const findTrackIndexInPlaylist = useCallback((tracks: Track[], track: Track | null) => {
    if (!track) return -1;
    return tracks.findIndex(
      (t) =>
        t.id === track.id ||
        (!!t.videoId && !!track.videoId && t.videoId === track.videoId) ||
        (t.title === track.title && t.artist === track.artist),
    );
  }, []);

  const nextTrack = useCallback(() => {
    if (repeatModeRef.current === 'one' && currentTrack) {
      void playTrack(currentTrack);
      return;
    }

    if (queue.length > 0) {
      const next = queue[0];
      setQueue(prev => prev.slice(1));
      void playTrack(next);
      return;
    }

    // Continuar en la playlist activa si no hay cola manual
    if (activePlaylistId) {
      const pl = playlists.find((p) => p.id === activePlaylistId);
      if (pl && pl.tracks.length > 0) {
        const idx = findTrackIndexInPlaylist(pl.tracks, currentTrack);
        if (idx >= 0 && idx < pl.tracks.length - 1) {
          playPlaylistFrom(pl.tracks, idx + 1);
          return;
        }
        if (repeatModeRef.current === 'all') {
          playPlaylistFrom(pl.tracks, 0);
          return;
        }
        (window as any).__nexShowToast?.(
          'Lista terminada · activá ↻ Repeat o explorá Globales',
          'info',
        );
        return;
      }
    }

    if (!tryDjAutoNext()) {
      (window as any).__nexShowToast?.(
        'No hay más temas · agregá a la cola o abrí una playlist',
        'info',
      );
    }
  }, [
    queue,
    playTrack,
    tryDjAutoNext,
    activePlaylistId,
    playlists,
    currentTrack,
    findTrackIndexInPlaylist,
    playPlaylistFrom,
  ]);

  const prevTrack = useCallback(() => {
    if (history.length > 1) {
      const prev = history[1];
      playTrack(prev);
    }
  }, [history, playTrack]);

  const addToQueue = useCallback((track: Track) => {
    setQueue(prev => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    setQueue(prev => prev.filter(t => t.id !== trackId));
  }, []);

  const isFavorite = useCallback((trackId: string) => {
    return favorites.some(t => t.id === trackId);
  }, [favorites]);

  const toggleFavorite = useCallback((track: Track) => {
    if (isFavorite(track.id)) {
      setFavorites(prev => prev.filter(t => t.id !== track.id));
    } else {
      setFavorites(prev => [track, ...prev]);
      recordFavorite();
    }
  }, [isFavorite]);

  const seekTo = useCallback((percent: number) => {
    setProgress(percent);
  }, []);

  // Playlist functions
  const addPlaylist = useCallback((name: string) => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      tracks: [],
      createdAt: Date.now(),
      isPrivate: false,
      ownerName: nickname || 'Anonymous',
      votes: [],
    };
    setPlaylists(prev => [...prev, newPlaylist]);
    setActivePlaylistId(newPlaylist.id);
  }, [nickname]);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    if (activePlaylistId === id) {
      setActivePlaylistId(null);
    }
  }, [activePlaylistId]);

  const updatePlaylist = useCallback((id: string, updates: Partial<Playlist>) => {
    setPlaylists(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates } : p));
  }, []);

  const togglePlaylistPrivacy = useCallback((id: string) => {
    setPlaylists(prev => prev.map(p => 
      p.id === id ? { ...p, isPrivate: !p.isPrivate } : p));
  }, []);

  const renamePlaylist = useCallback((id: string, newName: string) => {
    setPlaylists(prev => prev.map(p => 
      p.id === id ? { ...p, name: newName } : p));
  }, []);

  const addTrackToPlaylist = useCallback((playlistId: string, track: Track) => {
    setPlaylists(prev => prev.map(p => 
      p.id === playlistId ? 
        { ...p, tracks: [...p.tracks, track] } : p));
  }, []);

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists(prev => prev.map(p => 
      p.id === playlistId ? 
        { ...p, tracks: p.tracks.filter(t => t.id !== trackId) } : p));
  }, []);

  const voteForPlaylist = useCallback((playlistId: string) => {
    if (!nickname) return;
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId && !p.votes.includes(nickname)) {
        return { ...p, votes: [...p.votes, nickname] };
      }
      return p;
    }));
  }, [nickname]);

  const unvoteForPlaylist = useCallback((playlistId: string) => {
    if (!nickname) return;
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        return { ...p, votes: p.votes.filter(v => v !== nickname) };
      }
      return p;
    }));
  }, [nickname]);

  return (
    <SpotifyMiniContext.Provider
      value={{
        currentTrack,
        isPlaying,
        volume,
        progress,
        duration,
        queue,
        favorites,
        history,
        showLyrics,
        playTrack,
        playPlaylistFrom,
        togglePlay,
        nextTrack,
        prevTrack,
        repeatMode,
        shuffleOn,
        cycleRepeat,
        toggleShuffle,
        setVolume,
        seekTo,
        addToQueue,
        removeFromQueue,
        toggleFavorite,
        isFavorite,
        setShowLyrics,
        setIsPlaying,
        setDuration,
        setProgress,
        showLivePanel,
        setShowLivePanel,
        syncConnected: sync.connected,
        roomCode: sync.roomCode,
        isRoomHost: sync.isHost,
        roomUsers: sync.roomUsers,
        liveChat: sync.chatMessages,
        liveReactions: sync.reactions,
        syncError: sync.connectionError,
        djMode: sync.djMode,
        djPool: sync.djPool,
        djEq: sync.djEq,
        createLiveRoom: sync.createRoom,
        joinLiveRoom: sync.joinRoom,
        leaveLiveRoom: sync.leaveRoom,
        sendLiveChat: sync.sendChatMessage,
        sendLiveReaction: sync.sendReaction,
        toggleDjMode: sync.toggleDjMode,
        setDjAutoPlay: sync.setDjAutoPlay,
        updateDjEq: sync.sendDjEqSettings,
        suggestToDj: sync.suggestToDj,
        voteDjTrack: sync.voteDjTrack,
        playTopDjTrack: sync.playTopDjTrack,
        clearDjPool: sync.clearDjPool,
        nickname,
        setNickname,
        playlists,
        setPlaylists,
        addPlaylist,
        deletePlaylist,
        updatePlaylist,
        togglePlaylistPrivacy,
        renamePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        voteForPlaylist,
        unvoteForPlaylist,
        activePlaylistId,
        setActivePlaylistId,
        cloudSyncStatus,
        supabaseUserId: userId,
        supabaseAuthReady: authReady,
        supabaseAuthError: authError,
        supabaseRetry,
      }}
    >
      {children}
    </SpotifyMiniContext.Provider>
  );
};

const useSpotifyMini = () => {
  const context = useContext(SpotifyMiniContext);
  if (!context) {
    throw new Error("useSpotifyMini must be used within a SpotifyMiniStandaloneProvider");
  }
  return context;
};

// --- UTIL ---
function buildEmbedUrlFromResult(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
}

// --- LYRICS COMPONENT ---
const LyricsDisplay: React.FC = () => {
  const { currentTrack } = useSpotifyMini();
  const [lyrics, setLyrics] = useState<string[]>([]);

  useEffect(() => {
    if (currentTrack) {
      setLyrics([
        "Proximamente, las letras de la canción estarán disponibles aquí.",
      ]);
    }
  }, [currentTrack]);

  return (
    <div className="lyrics-container">
      <div className="lyrics-header">
        <Book24Regular />
        <span>Letras de {currentTrack?.title}</span>
      </div>
      <div className="lyrics-content">
        {lyrics.map((line, i) => (
          <p key={i} className={line.includes('🎵') || line.includes('🎶') ? 'lyrics-section' : 'lyrics-line'}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
};

// --- NICKNAME MODAL COMPONENT ---
const NicknameModal: React.FC<{
  isOpen: boolean;
  onClose: () => void }> = ({ isOpen, onClose }) => {
  const { nickname, setNickname } = useSpotifyMini();
  const [input, setInput] = useState(nickname);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      const isNewUser = !nickname;
      setNickname(input.trim());
      onClose();
      if (isNewUser) {
        setTimeout(() => (window as any).__nexShowToast?.('Bienvenido a Nex Music, te damos la suscripción premium de por vida 🎉', 'premium'), 300);
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={() => {
      if (nickname) onClose();
    }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>¿Cómo te llamás?</h2>
        <p>Tu nombre se usa en salas en vivo, votos y listas públicas</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ingresa tu nombre"
            autoFocus
          />
          <div className="modal-actions">
            <button type="submit" className="modal-btn-primary">
              Continuar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const SpotifyMiniStandalone: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    volume,
    progress,
    duration,
    queue,
    favorites,
    history,
    showLyrics,
    playTrack,
    playPlaylistFrom,
    togglePlay,
    nextTrack,
    prevTrack,
    repeatMode,
    shuffleOn,
    cycleRepeat,
    toggleShuffle,
    setVolume,
    seekTo,
    addToQueue,
    removeFromQueue,
    toggleFavorite,
    isFavorite,
    setShowLyrics,
    setIsPlaying,
    setDuration,
    setProgress,
    showLivePanel,
    setShowLivePanel,
    syncConnected,
    roomCode,
    isRoomHost,
    roomUsers,
    liveChat,
    liveReactions,
    syncError,
    createLiveRoom,
    joinLiveRoom,
    leaveLiveRoom,
    sendLiveChat,
    sendLiveReaction,
    djMode,
    djPool,
    djEq,
    updateDjEq,
    suggestToDj,
    voteDjTrack,
    playTopDjTrack,
    clearDjPool,
    toggleDjMode,
    setDjAutoPlay,
    nickname,
    setNickname,
    playlists,
    setPlaylists,
    addPlaylist,
    deletePlaylist,
    togglePlaylistPrivacy,
    renamePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    voteForPlaylist,
    unvoteForPlaylist,
    activePlaylistId,
    setActivePlaylistId,
    cloudSyncStatus,
    supabaseUserId,
    supabaseAuthReady,
    supabaseAuthError,
    supabaseRetry,
  } = useSpotifyMini();

  const [activeService, setActiveService] = useState<ServiceType>('youtube');
  const [activeTab, setActiveTab] = useState<'search' | 'my-playlists' | 'global-playlists' | 'users' | 'profile' | 'queue' | 'favorites' | 'history'>('search');
  const [profileDeepLink, setProfileDeepLink] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [logoAnimating, setLogoAnimating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const isStandalonePwa = useIsStandalonePwa();

  const closeSidebar = useCallback(() => {
    closeSidebarWithHistory(() => setSidebarOpen(false));
  }, []);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  useMobileScrollLock(isMobile && sidebarOpen);
  useSidebarBackClose(isMobile && sidebarOpen, closeSidebar);

  const [bumpHeartId, setBumpHeartId] = useState<string | null>(null);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showAddPlaylistModal, setShowAddPlaylistModal] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [isPartyMode, setIsPartyMode] = useState(false);
  const [toasts, setToasts] = useState<{id: number; message: string; type: 'success'|'error'|'info'|'premium'}[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [showSpotifyImportModal, setShowSpotifyImportModal] = useState(false);
  const [spotifyImportUrl, setSpotifyImportUrl] = useState('');
  const [spotifyImporting, setSpotifyImporting] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const audioEnhance = useNexAudioEnhance();
  const audioEnhanceRef = useRef(audioEnhance);
  audioEnhanceRef.current = audioEnhance;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const { getEngine } = useNexDspEngine();
  const streamPlayer = useNexStreamPlayer({
    getEngine,
    getSettings: () => audioEnhanceRef.current.settings,
    getUiVolume: () => volumeRef.current,
    onEnded: () => nextTrackRef.current(),
    onPlayingChange: (playing) => setIsPlaying(playing),
    onTime: (current, dur) => {
      if (Number.isFinite(dur) && dur > 0) {
        setDuration(dur);
        setProgress((current / dur) * 100);
      }
    },
  });
  const streamPlayerRef = useRef(streamPlayer);
  streamPlayerRef.current = streamPlayer;
  const isFirstVideoLoadRef = useRef(true);
  const crossfadingRef = useRef(false);
  const initGenRef = useRef(0);
  const pendingRoomRef = useRef<string | null>(null);
  const pendingCloudRef = useRef<string | null>(null);
  const pendingShortRef = useRef<string | null>(null);
  const roomJoinAttemptedRef = useRef(false);
  const cloudImportAttemptedRef = useRef(false);
  const shortImportAttemptedRef = useRef(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [weekStats, setWeekStats] = useState(() => loadWeeklyStats());
  const pwa = usePwaInstall();
  const prevRoomUsersRef = useRef(0);

  const showToast = (message: string, type: 'success'|'error'|'info'|'premium' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const handleMobileClose = useCallback(() => {
    if (sidebarOpen) {
      closeSidebar();
      return;
    }
    if (showLivePanel) {
      setShowLivePanel(false);
      return;
    }
    if (showAddPlaylistModal) {
      setShowAddPlaylistModal(false);
      return;
    }
    if (showImportModal) {
      setShowImportModal(false);
      return;
    }
    if (showSpotifyImportModal) {
      setShowSpotifyImportModal(false);
      return;
    }
    if (showNicknameModal && nickname) {
      setShowNicknameModal(false);
      return;
    }
    exitMobileApp(() => {
      showToast(
        isStandalonePwa
          ? 'Deslizá hacia arriba o usá el botón Inicio para salir de la app'
          : 'Cerrá esta pestaña o volvé atrás en el navegador',
        'info',
      );
    });
  }, [
    sidebarOpen,
    closeSidebar,
    showLivePanel,
    setShowLivePanel,
    showAddPlaylistModal,
    showImportModal,
    showSpotifyImportModal,
    showNicknameModal,
    nickname,
    isStandalonePwa,
  ]);

  const abortRef = useRef<AbortController | null>(null);
  const playerRef = useRef<any>(null);
  const playerARef = useRef<any>(null);
  const playerBRef = useRef<any>(null);
  const activeYtSlotRef = useRef<'a' | 'b'>('a');
  const dualReadyWaitRef = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const nextTrackRef = useRef(nextTrack);

  const muteYtPlayers = useCallback(() => {
    try {
      playerARef.current?.mute?.();
      playerARef.current?.pauseVideo?.();
      playerBRef.current?.mute?.();
      playerBRef.current?.pauseVideo?.();
    } catch {
      /* ignore */
    }
  }, []);

  const pcnMode = query.trim().toUpperCase() === 'PCN';

  // Expose showToast globally for use in useState initializers
  useEffect(() => {
    (window as any).__nexShowToast = showToast;
    return () => { delete (window as any).__nexShowToast; };
  }, []);

  useEffect(() => {
    nextTrackRef.current = nextTrack;
  }, [nextTrack]);

  useEffect(() => {
    sessionStorage.setItem('nexMusicPartyMode', String(isPartyMode));
  }, [isPartyMode]);

  // Keep YT iframes tiny — do NOT observe attributes (setting styles would infinite-loop and freeze phones)
  useEffect(() => {
    let pinning = false;
    const pinIframes = () => {
      if (pinning) return;
      pinning = true;
      try {
        const host = document.querySelector('.spotify-yt-audio');
        if (!host) return;
        host.querySelectorAll('iframe').forEach((el) => {
          const iframe = el as HTMLIFrameElement;
          if (iframe.dataset.nexPinned === '1' && iframe.style.width === '2px') return;
          iframe.dataset.nexPinned = '1';
          iframe.setAttribute('playsinline', '1');
          iframe.setAttribute('webkit-playsinline', '1');
          iframe.removeAttribute('allowfullscreen');
          Object.assign(iframe.style, {
            width: '2px',
            height: '2px',
            maxWidth: '2px',
            maxHeight: '2px',
            position: 'absolute',
            left: '0px',
            top: '0px',
            border: '0',
            pointerEvents: 'none',
          });
        });
      } finally {
        pinning = false;
      }
    };

    pinIframes();
    const host = document.querySelector('.spotify-yt-audio');
    const mo = host
      ? new MutationObserver((mutations) => {
          // Only react when YouTube injects a new iframe, not when we style it
          if (mutations.some((m) => m.type === 'childList' && m.addedNodes.length > 0)) {
            pinIframes();
          }
        })
      : null;
    mo?.observe(host as Node, { childList: true, subtree: true, attributes: false });

    const onFs = () => {
      try {
        if (document.fullscreenElement) void document.exitFullscreen?.();
        const doc = document as Document & {
          webkitFullscreenElement?: Element;
          webkitExitFullscreen?: () => void;
        };
        if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.();
      } catch { /* ignore */ }
      pinIframes();
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs as EventListener);
    return () => {
      mo?.disconnect();
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs as EventListener);
    };
  }, []);

  useEffect(() => {
    setWeekStats(loadWeeklyStats());
  }, [currentTrack?.id, favorites.length]);

  // DJ tour + notification when someone joins
  useEffect(() => {
    try {
      if (roomCode && djMode.enabled && localStorage.getItem('nexDjTourSeen') !== '1') {
        localStorage.setItem('nexDjTourSeen', '1');
        showToast('Modo DJ: la gente vota temas y el top suena solo', 'premium');
      }
    } catch { /* ignore */ }
  }, [roomCode, djMode.enabled]);

  useEffect(() => {
    if (!roomCode || !isRoomHost) {
      prevRoomUsersRef.current = roomUsers.length;
      return;
    }
    if (roomUsers.length > prevRoomUsersRef.current && prevRoomUsersRef.current > 0) {
      const joined = roomUsers[roomUsers.length - 1];
      showToast(`${joined?.name || 'Alguien'} se unió a tu sala`, 'success');
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('NEX Music', { body: `${joined?.name || 'Alguien'} entró a la sala ${roomCode}` });
        } catch { /* ignore */ }
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    }
    prevRoomUsersRef.current = roomUsers.length;
  }, [roomUsers.length, roomCode, isRoomHost]);

  useEffect(() => {
    if (!nickname) {
      setShowNicknameModal(true);
    }
  }, [nickname]);

  // Viral deep links: ?room= / ?cloud= / ?p= / ?user= (+ skip onboarding)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const cloud = params.get('cloud');
    const shortP = params.get('p');
    const user = params.get('user');
    if (room && isValidRoomCode(room)) {
      pendingRoomRef.current = room.toUpperCase();
      try { localStorage.setItem('nexMusicOnboardingSeen', '1'); } catch { /* ignore */ }
    }
    if (user?.trim()) {
      setProfileDeepLink(user.trim());
      setActiveTab('users');
      try { localStorage.setItem('nexMusicOnboardingSeen', '1'); } catch { /* ignore */ }
    }
    if (cloud) {
      pendingCloudRef.current = cloud;
      try { localStorage.setItem('nexMusicOnboardingSeen', '1'); } catch { /* ignore */ }
    }
    if (shortP && isValidShortShareCode(shortP)) {
      pendingShortRef.current = shortP;
      try { localStorage.setItem('nexMusicOnboardingSeen', '1'); } catch { /* ignore */ }
    }
    try {
      const seen = localStorage.getItem('nexMusicOnboardingSeen') === '1';
      if (!seen && !room && !cloud && !shortP) setShowOnboarding(true);
    } catch {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    void getSpotifySession().then((s) => setSpotifyConnected(s.connected && !s.expired));
    const params = new URLSearchParams(window.location.search);
    const spotifyStatus = params.get('spotify');
    if (spotifyStatus === 'connected') {
      setSpotifyConnected(true);
      showToast('Spotify conectado ✓ Ya podés importar tus playlists', 'success');
      setShowSpotifyImportModal(true);
      const next = new URLSearchParams(window.location.search);
      next.delete('spotify');
      const qs = next.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    } else if (spotifyStatus === 'error' || spotifyStatus === 'token_error') {
      showToast('No se pudo conectar Spotify. Revisá el redirect URI en el Dashboard.', 'error');
      const next = new URLSearchParams(window.location.search);
      next.delete('spotify');
      const qs = next.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    }
  }, []);

  useEffect(() => {
    const code = pendingRoomRef.current;
    if (!code || roomJoinAttemptedRef.current) return;
    if (!nickname) {
      setShowNicknameModal(true);
      return;
    }
    if (!syncConnected) return;
    roomJoinAttemptedRef.current = true;
    setShowLivePanel(true);
    joinLiveRoom(code, nickname);
    showToast(`Uniéndote a la sala ${code}…`, 'info');
    const params = new URLSearchParams(window.location.search);
    params.delete('room');
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    pendingRoomRef.current = null;
  }, [nickname, syncConnected, joinLiveRoom, setShowLivePanel]);

  useEffect(() => {
    const cloudId = pendingCloudRef.current;
    if (!cloudId || cloudImportAttemptedRef.current) return;
    cloudImportAttemptedRef.current = true;
    let cancelled = false;
    void fetchCloudPlaylistById(cloudId).then((detail) => {
      if (cancelled) return;
      const params = new URLSearchParams(window.location.search);
      params.delete('cloud');
      const qs = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
      pendingCloudRef.current = null;
      if (!detail || detail.tracks.length === 0) {
        showToast('No se encontró esa lista en la nube', 'error');
        return;
      }
      const imported: Playlist = {
        id: detail.id,
        name: detail.name,
        tracks: detail.tracks,
        cover: detail.cover,
        createdAt: detail.createdAt,
        isPrivate: false,
        ownerName: detail.ownerName,
        votes: [],
      };
      setPlaylists((prev) => {
        if (prev.some((p) => p.id === imported.id)) return prev;
        return [imported, ...prev];
      });
      setActivePlaylistId(imported.id);
      setActiveTab('my-playlists');
      showToast(`Lista "${detail.name}" lista para escuchar ☁️`, 'success');
    });
    return () => {
      cancelled = true;
    };
  }, [setPlaylists, setActivePlaylistId]);

  useEffect(() => {
    const code = pendingShortRef.current;
    if (!code || shortImportAttemptedRef.current) return;
    shortImportAttemptedRef.current = true;
    let cancelled = false;
    void fetchShortPlaylistShare(code).then((imported) => {
      if (cancelled) return;
      const params = new URLSearchParams(window.location.search);
      params.delete('p');
      const qs = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
      pendingShortRef.current = null;
      if (!imported || imported.tracks.length === 0) {
        showToast('No se encontró esa lista compartida', 'error');
        return;
      }
      setPlaylists((prev) => {
        if (prev.some((p) => p.id === imported.id || p.name === imported.name)) return prev;
        return [imported, ...prev];
      });
      setActivePlaylistId(imported.id);
      setActiveTab('my-playlists');
      showToast(`Lista "${imported.name}" lista para escuchar 🔗`, 'success');
    });
    return () => {
      cancelled = true;
    };
  }, [setPlaylists, setActivePlaylistId]);

  useEffect(() => {
    const onPrev = () => prevTrack();
    const onNext = () => nextTrack();
    window.addEventListener('nex-music-prev', onPrev);
    window.addEventListener('nex-music-next', onNext);
    return () => {
      window.removeEventListener('nex-music-prev', onPrev);
      window.removeEventListener('nex-music-next', onNext);
    };
  }, [prevTrack, nextTrack]);

  // --- CARGA DEL SCRIPT DE YOUTUBE IFRAME API ---
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      // ya está cargado, no hacer nada
      return;
    }

    // Evitar insertar el script más de una vez
    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

  // Callback global que YouTube llama cuando termina de cargar
    // Only boot YT if DSP is off / already failed — avoids abort race that drops DSP→YouTube
    window.onYouTubeIframeAPIReady = () => {
      if (currentTrack?.videoId && streamPlayerRef.current.mode !== 'dsp') {
        // If preferDsp, let the currentTrack effect own init; only help when already on YT path
        if (audioEnhanceRef.current.settings.preferDsp === false) {
          initPlayer();
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentTrack?.videoId) {
      initPlayer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack]);

  // Update volume / FX: DSP gain when live, else YouTube loudness + optional 8D LFO
  useEffect(() => {
    if (streamPlayer.isDspActive) {
      audioEnhance.stopYtSpatial();
      streamPlayer.syncSettings();
      return;
    }
    if (streamPlayer.mode === 'youtube' && audioEnhance.settings.spatial8d) {
      audioEnhance.startYtSpatial(playerRef.current, volume);
      return;
    }
    audioEnhance.stopYtSpatial();
    audioEnhance.applyVolume(playerRef.current, volume);
  }, [
    volume,
    audioEnhance.settings,
    audioEnhance.applyVolume,
    audioEnhance.startYtSpatial,
    audioEnhance.stopYtSpatial,
    streamPlayer.isDspActive,
    streamPlayer.mode,
    streamPlayer.syncSettings,
  ]);

  const getActiveYt = () =>
    activeYtSlotRef.current === 'a' ? playerARef.current : playerBRef.current;
  const getIdleYt = () =>
    activeYtSlotRef.current === 'a' ? playerBRef.current : playerARef.current;

  const syncPlayerRef = () => {
    playerRef.current = getActiveYt();
  };

  const loadInto = (player: any, videoId: string) => {
    if (!player?.loadVideoById) return;
    const { settings, applyHdQuality } = audioEnhanceRef.current;
    const useHd = settings.hd && !isMobile;
    if (useHd) {
      player.loadVideoById({ videoId, suggestedQuality: 'hd1080' });
      applyHdQuality(player);
    } else {
      player.loadVideoById({ videoId, suggestedQuality: 'small' });
    }
  };

  const createYtPlayer = (elementId: string, videoId: string | undefined, slot: 'a' | 'b') => {
    if (!window.YT) return;
    const lockIframeTiny = (target: any) => {
      try {
        const iframe = target?.getIframe?.() as HTMLIFrameElement | undefined;
        if (!iframe) return;
        iframe.setAttribute('playsinline', '1');
        iframe.setAttribute('webkit-playsinline', '1');
        iframe.removeAttribute('allowfullscreen');
        iframe.setAttribute(
          'allow',
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        );
        Object.assign(iframe.style, {
          width: '1px',
          height: '1px',
          maxWidth: '1px',
          maxHeight: '1px',
          position: 'absolute',
          left: '0',
          top: '0',
          opacity: '0',
          pointerEvents: 'none',
          border: '0',
        });
      } catch { /* ignore */ }
    };
    const exitForcedFullscreen = () => {
      try {
        if (document.fullscreenElement) void document.exitFullscreen?.();
        const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
        if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.();
      } catch { /* ignore */ }
    };

    const player = new window.YT.Player(elementId, {
      videoId: videoId || undefined,
      width: 1,
      height: 1,
      playerVars: {
        origin: window.location.origin,
        enablejsapi: 1,
        autoplay: slot === 'a' && videoId ? 1 : 0,
        // Critical on iOS/Android: keep video inline so it doesn't cover the UI in black fullscreen
        playsinline: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        fs: 0,
        disablekb: 1,
        iv_load_policy: 3,
        // Force HTML5 inline on mobile Safari
        ...(isMobile ? { playsinline: 1, fs: 0 } : {}),
      },
      events: {
        onReady: (event: any) => {
          const { settings, applyHdQuality, startTrackEnvelope } = audioEnhanceRef.current;
          lockIframeTiny(event.target);

          if (slot === 'a') {
            playerARef.current = event.target;
            activeYtSlotRef.current = 'a';
            syncPlayerRef();
            if (event.target.getDuration) setDuration(event.target.getDuration());
            // HD on mobile often expands the video surface → black fullscreen
            if (settings.hd && !isMobile) applyHdQuality(event.target);
            // Skip punch/auto-gain envelopes on mobile — they spam volume timers and jank the UI
            if (isMobile) {
              audioEnhanceRef.current.applyVolume(event.target, volumeRef.current);
            } else {
              startTrackEnvelope(event.target, volumeRef.current);
            }
            if (audioEnhanceRef.current.settings.spatial8d) {
              audioEnhanceRef.current.startYtSpatial(event.target, volumeRef.current);
            }
            isFirstVideoLoadRef.current = false;
            setIsPlaying(true);
            event.target.playVideo();
          } else {
            playerBRef.current = event.target;
            event.target.setVolume?.(0);
            try { event.target.pauseVideo?.(); } catch { /* ignore */ }
          }
        },
        onStateChange: (event: any) => {
          const isActive =
            (slot === 'a' && activeYtSlotRef.current === 'a') ||
            (slot === 'b' && activeYtSlotRef.current === 'b');
          if (!isActive) return;

          if (window.YT && event.data === window.YT.PlayerState.PLAYING) {
            lockIframeTiny(event.target);
            exitForcedFullscreen();
            if (audioEnhanceRef.current.settings.hd && !isMobile) {
              audioEnhanceRef.current.applyHdQuality(event.target);
            }
            setIsPlaying(true);
            startProgressTracking();
            if (event.target.getDuration) setDuration(event.target.getDuration());
          } else if (window.YT && event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
            stopProgressTracking();
          } else if (window.YT && event.data === window.YT.PlayerState.ENDED) {
            nextTrackRef.current();
          }
        },
      },
    });
    if (slot === 'a') playerARef.current = player;
    else playerBRef.current = player;
  };

  const initPlayer = () => {
    if (!currentTrack?.videoId) return;
    if (crossfadingRef.current) return;
    const videoId = currentTrack.videoId;
    const gen = ++initGenRef.current;

    // Prefer real DSP pipeline (our output). Fall back to YouTube iframe.
    void (async () => {
      // Pause any leftover YT while we try DSP (avoids dual audio / false “no FX”)
      muteYtPlayers();

      const result = await streamPlayerRef.current.playVideoId(videoId);
      if (gen !== initGenRef.current) return; // superseded by a newer track/init

      if (result === 'ok') {
        muteYtPlayers();
        stopProgressTracking();
        isFirstVideoLoadRef.current = false;
        return;
      }

      // Aborted by a newer play attempt — do NOT start YouTube
      if (result === 'abort') return;

      showToast('YouTube bloquea el stream · potencia/8D por volumen', 'info');

      // YouTube fallback (real DSP failure)
      if (!window.YT) {
        setTimeout(() => {
          if (gen === initGenRef.current) initPlayer();
        }, 100);
        return;
      }

      if (!playerARef.current) {
        createYtPlayer('youtube-player-a', videoId, 'a');
        if (!isMobile) createYtPlayer('youtube-player-b', undefined, 'b');
        return;
      }

      if (!playerARef.current?.loadVideoById) {
        setTimeout(() => {
          if (gen === initGenRef.current) initPlayer();
        }, 100);
        return;
      }

      syncPlayerRef();
      try {
        playerARef.current?.unMute?.();
        playerBRef.current?.unMute?.();
      } catch {
        /* ignore */
      }
      const { settings, crossfadeToNext, startTrackEnvelope } = audioEnhanceRef.current;
      const shouldCrossfade = !isFirstVideoLoadRef.current && settings.crossfadeSec > 0 && !isMobile;
      const active = getActiveYt();
      const idle = getIdleYt();

      if (shouldCrossfade && settings.dualCrossfade && !idle?.loadVideoById) {
        if (dualReadyWaitRef.current < 25) {
          dualReadyWaitRef.current += 1;
          setTimeout(() => {
            if (gen === initGenRef.current) initPlayer();
          }, 120);
          return;
        }
      }
      dualReadyWaitRef.current = 0;

      if (shouldCrossfade) {
        crossfadingRef.current = true;
        const useDual = Boolean(settings.dualCrossfade && idle?.loadVideoById);

        void crossfadeToNext(
          active,
          volumeRef.current,
          () => {
            loadInto(useDual ? idle : active, videoId);
            setIsPlaying(true);
          },
          useDual
            ? {
                nextPlayer: idle,
                onSwapped: () => {
                  activeYtSlotRef.current = activeYtSlotRef.current === 'a' ? 'b' : 'a';
                  syncPlayerRef();
                },
              }
            : undefined,
        ).finally(() => {
          crossfadingRef.current = false;
          isFirstVideoLoadRef.current = false;
        });
        return;
      }

      isFirstVideoLoadRef.current = false;
      loadInto(active, videoId);
      if (isMobile) {
        audioEnhanceRef.current.applyVolume(active, volumeRef.current);
      } else {
        startTrackEnvelope(active, volumeRef.current);
      }
      setIsPlaying(true);
      try { active?.playVideo?.(); } catch { /* ignore */ }
    })();
  };

  const startProgressTracking = () => {
    stopProgressTracking();
    const tickMs = isMobile ? 1000 : 500;
    progressIntervalRef.current = window.setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime && playerRef.current.getDuration) {
        const currentTime = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        if (Number.isFinite(dur) && dur > 0) {
          setDuration(dur);
          setProgress((currentTime / dur) * 100);
        }
      }
    }, tickMs);
  };

  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  useMobilePlaybackPersistence({
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    queue,
    playerRef,
    startProgressTracking,
    stopProgressTracking,
    setIsPlaying,
    onResumePlayback: () => {
      if (!streamPlayerRef.current.isDspActive) return false;
      void streamPlayerRef.current.play();
      return true;
    },
  });

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    seekTo(percent);
    if (streamPlayerRef.current.isDspActive && duration > 0) {
      streamPlayerRef.current.seekTo((percent / 100) * duration);
      return;
    }
    if (playerRef.current && duration > 0) {
      const seekTime = (percent / 100) * duration;
      playerRef.current.seekTo(seekTime, true);
    }
  };

  const seekBySeconds = useCallback((delta: number) => {
    if (streamPlayerRef.current.isDspActive) {
      const current = streamPlayerRef.current.getCurrentTime();
      const next = Math.max(0, current + delta);
      streamPlayerRef.current.seekTo(next);
      if (duration > 0) setProgress((next / duration) * 100);
      return;
    }
    if (!playerRef.current?.getCurrentTime || !playerRef.current?.seekTo) return;
    const current = playerRef.current.getCurrentTime();
    const next = Math.max(0, current + delta);
    playerRef.current.seekTo(next, true);
    if (duration > 0) setProgress((next / duration) * 100);
  }, [duration, setProgress]);

  const handleTogglePlay = () => {
    if (streamPlayerRef.current.isDspActive) {
      if (isPlaying) {
        streamPlayerRef.current.pause();
        setIsPlaying(false);
      } else {
        void streamPlayerRef.current.play();
        setIsPlaying(true);
      }
      return;
    }
    // --- YOUTUBE ---
    if (currentTrack?.videoId && playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        stopProgressTracking();
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
        startProgressTracking();
      }
    } else {
      togglePlay();
    }
  };

  useMusicKeyboardShortcuts({
    togglePlay: handleTogglePlay,
    nextTrack,
    prevTrack,
    seekBySeconds,
  });

  const handleLogoClick = () => {
    setLogoAnimating(true);
    setTimeout(() => setLogoAnimating(false), 600);
  };

  const handleHeartClick = (track: Track) => {
    toggleFavorite(track);
    setBumpHeartId(track.id);
    setTimeout(() => setBumpHeartId(null), 320);
  };

  // --- SEARCH ---
  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    // Check if it's a direct YouTube URL
    const ytIdMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytIdMatch && ytIdMatch[1]) {
      const ytId = ytIdMatch[1];
      setSearchResults([{
        id: ytId,
        kind: 'video',
        title: 'Video por Enlace (Compartido)',
        channelTitle: 'YouTube',
        publishedAt: new Date().toISOString(),
        thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
        description: 'Enlace directo compartido',
      }]);
      setActiveTab('search');
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      let data;
      if (activeService === 'spotify') {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Spotify search failed');
        data = await res.json();
        setSearchResults(data.results.map((item: any): SpotifyResult => ({
          id: item.id,
          title: item.title,
          artist: item.artist,
          cover: item.thumbnail,
          url: item.uri,
          service: 'spotify',
        })));
      } else {
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('YouTube search failed');
        data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (activeService === 'spotify') {
        const fallbackResults: SpotifyResult[] = [
          { id: 's1', title: 'Sin un peso', artist: 'Nafta', cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300', url: '', service: 'spotify' },
          { id: 's2', title: 'Blinding Lights', artist: 'The Weeknd', cover: 'https://images.unsplash.com/photo-1511379938547-c1f6941d86ba?w=300', url: '', service: 'spotify' },
        ];
        setSearchResults(fallbackResults);
      } else {
        const fallbackResults: YouTubeResult[] = [
          { id: 'dQw4w9WgXcQ', kind: 'video', title: 'Rick Astley - Never Gonna Give You Up', channelTitle: 'Rick Astley', publishedAt: '2009-10-25T06:57:33Z', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', description: 'Official video' },
          { id: '9bZkp7q19f0', kind: 'video', title: 'PSY - GANGNAM STYLE', channelTitle: 'officialpsy', publishedAt: '2012-07-15T07:46:32Z', thumbnail: 'https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg', description: 'PSY' },
        ];
        setSearchResults(fallbackResults);
      }
    } finally {
      setLoading(false);
    }
  }, [activeService]);

  const resolveSearchToTrack = async (result: SearchResult | SpotifyResult | YouTubeResult): Promise<Track | null> => {
    if ('service' in result && result.service === 'spotify') {
      return resolveTrackForPlayback({
        id: `spotify:${result.id}`,
        title: result.title,
        artist: result.artist,
        cover: result.cover,
        url: '',
        service: 'spotify',
      });
    }
    const yt = result as YouTubeResult;
    return {
      id: yt.id,
      title: yt.title,
      artist: yt.channelTitle,
      cover: yt.thumbnail,
      url: '',
      service: activeService,
      kind: yt.kind,
      videoId: yt.id,
    };
  };

  const playFromSearch = async (result: SearchResult | SpotifyResult | YouTubeResult) => {
    const track = await resolveSearchToTrack(result);
    if (track) playTrack(track);
  };

  const addTrackToQueue = async (result: SearchResult | SpotifyResult | YouTubeResult) => {
    const track = await resolveSearchToTrack(result);
    if (track) {
      if (!currentTrack) {
        playTrack(track);
      } else {
        addToQueue(track);
      }
    }
  };

  const suggestFromSearch = async (result: SearchResult | SpotifyResult | YouTubeResult) => {
    const track = await resolveSearchToTrack(result);
    if (track) suggestToDj(track);
  };

  const showDjSuggest = !!roomCode && djMode.enabled;

  const playCloudPlaylist = useCallback((
    tracks: Track[],
    mode: CloudPlayMode,
    meta?: { playlistId?: string; playlistName?: string },
  ) => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    let list = [...tracks];
    if (mode === 'shuffle') list = shuffleTracks(list);
    if (list.length === 0) return;

    playTrack(list[0]);

    if (mode === 'preview') {
      previewTimerRef.current = window.setTimeout(() => {
        if (playerRef.current?.pauseVideo) {
          playerRef.current.pauseVideo();
          setIsPlaying(false);
          stopProgressTracking();
        }
        showToast('Preview de 30s finalizado', 'info');
      }, PREVIEW_SECONDS * 1000);
      return;
    }

    list.slice(1).forEach((t) => addToQueue(t));

    if (meta?.playlistId) {
      const supabase = getSupabase();
      supabase?.rpc('increment_playlist_plays', { playlist_uuid: meta.playlistId });
    }
  }, [playTrack, addToQueue, setIsPlaying, showToast]);

  // Helper to format time
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePartyMode = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !isPartyMode;
    setIsPartyMode(next);
    showToast(
      next ? 'Party Mode · Experiencia 3D activada ✨' : 'Party Mode desactivado',
      next ? 'premium' : 'info',
    );
  };

  const handleSpotifyImport = async () => {
    const source = spotifyImportUrl.trim();
    if (!source || spotifyImporting) return;

    setSpotifyImporting(true);
    try {
      const data = await fetchSpotifyPlaylist(source);
      const imported: Playlist = {
        id: Date.now().toString(),
        name: data.name,
        cover: data.cover,
        tracks: spotifyTracksToNexTracks(data.tracks),
        createdAt: Date.now(),
        isPrivate: false,
        ownerName: nickname || 'Spotify',
        votes: [],
      };

      setPlaylists((prev) => [...prev, imported]);
      setSpotifyImportUrl('');
      setShowSpotifyImportModal(false);
      setActiveTab('my-playlists');
      setActivePlaylistId(imported.id);

      showToast(
        data.truncated
          ? `"${data.name}" importada (${data.importedCount}/${data.trackCount} canciones)`
          : `"${data.name}" importada · ${data.importedCount} canciones 🎵`,
        'success',
      );
    } catch (err) {
      const needsAuth = Boolean((err as { needsSpotifyAuth?: boolean })?.needsSpotifyAuth);
      if (needsAuth) {
        setSpotifyConnected(false);
        showToast('Primero conectá tu cuenta de Spotify', 'info');
      } else {
        showToast(
          err instanceof Error ? err.message : 'No se pudo importar la playlist de Spotify',
          'error',
        );
      }
    } finally {
      setSpotifyImporting(false);
    }
  };

  return (
    <div className={`spotify-root ${isMobile ? 'is-mobile' : 'is-desktop'} ${isStandalonePwa ? 'is-standalone' : ''} ${pcnMode ? 'pcn-theme' : ''} ${isPartyMode ? 'party-mode party-active' : ''}`}>
      {/* Audio-only YT host: kept tiny + behind opaque UI shell (fixes mobile black cover) */}
      <div className="spotify-yt-audio" aria-hidden="true">
        <div id="youtube-player-a" />
        {!isMobile && <div id="youtube-player-b" />}
      </div>

      <PartyModeLayer enabled={isPartyMode} isPlaying={isPlaying} />

      <div className="spotify-ui-shell">
      {/* --- NICKNAME MODAL --- */}
      <NicknameModal
        isOpen={showNicknameModal} onClose={() => setShowNicknameModal(false)} />

      {/* --- ADD PLAYLIST MODAL --- */}
      {showAddPlaylistModal && (
        <div className="modal-overlay" onClick={() => setShowAddPlaylistModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Nueva Lista de Reproducción</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newPlaylistName.trim()) {
                addPlaylist(newPlaylistName.trim());
                setNewPlaylistName('');
                setShowAddPlaylistModal(false);
              }
            }}>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Nombre de la lista"
                autoFocus
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn-secondary"
                  onClick={() => setShowAddPlaylistModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="modal-btn-primary">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- IMPORT MODAL --- */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Importar Lista</h2>
            <p>Pega el enlace o código que te compartieron</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const data = importCode.trim();
              if (!data) return;
              try {
                const code = extractPlaylistShareCodeFromInput(data);
                if (!code) throw new Error('invalid');
                void (async () => {
                  try {
                    let p: Playlist | null = null;
                    if (isValidShortShareCode(code)) {
                      p = await fetchShortPlaylistShare(code);
                    }
                    if (!p) p = decodePlaylistShareCode(code);
                    if (!p) throw new Error('invalid');
                    setPlaylists([...playlists, p]);
                    setImportCode('');
                    setShowImportModal(false);
                    showToast(`Lista "${p.name}" importada con éxito! 🎉`, 'success');
                  } catch {
                    showToast('Enlace o código inválido. Verifica e intenta de nuevo.', 'error');
                  }
                })();
              } catch {
                showToast('Enlace o código inválido. Verifica e intenta de nuevo.', 'error');
              }
            }}>
              <input
                type="text"
                value={importCode}
                onChange={(e) => setImportCode(e.target.value)}
                placeholder="Pega el enlace aquí..."
                autoFocus
              />
              <div className="modal-actions">
                <button type="button" className="modal-btn-secondary" onClick={() => setShowImportModal(false)}>Cancelar</button>
                <button type="submit" className="modal-btn-primary">Importar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SPOTIFY IMPORT MODAL --- */}
      {showSpotifyImportModal && (
        <div className="modal-overlay" onClick={() => !spotifyImporting && setShowSpotifyImportModal(false)}>
          <div className="modal-content spotify-import-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Importar de Spotify</h2>
            <p>
              Spotify ahora exige login. Importá playlists <strong>tuyas</strong> o donde colaborás.
            </p>
            {!spotifyConnected ? (
              <div className="spotify-connect-box">
                <p className="modal-hint">
                  Conectá tu cuenta una vez. Después pegás el link de tu playlist (ej. Ultra Buenos Aires).
                </p>
                <button
                  type="button"
                  className="modal-btn-primary spotify-connect-btn"
                  onClick={() => startSpotifyAuth(window.location.pathname || '/nex-music')}
                >
                  Conectar Spotify
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSpotifyImport();
                }}
              >
                <p className="spotify-connected-badge">✓ Spotify conectado</p>
                <input
                  type="url"
                  value={spotifyImportUrl}
                  onChange={(e) => setSpotifyImportUrl(e.target.value)}
                  placeholder="https://open.spotify.com/playlist/..."
                  autoFocus
                  disabled={spotifyImporting}
                />
                <p className="modal-hint">
                  Las canciones se reproducen vía YouTube al dar play.
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="modal-btn-secondary"
                    onClick={() => setShowSpotifyImportModal(false)}
                    disabled={spotifyImporting}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="modal-btn-primary spotify-import-submit" disabled={spotifyImporting || !spotifyImportUrl.trim()}>
                    {spotifyImporting ? 'Importando…' : 'Importar playlist'}
                  </button>
                </div>
              </form>
            )}
            {spotifyConnected && (
              <button
                type="button"
                className="modal-btn-secondary"
                style={{ marginTop: 12, width: '100%' }}
                onClick={() => setShowSpotifyImportModal(false)}
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- TOAST NOTIFICATIONS --- */}
      <div className="nex-toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`nex-toast nex-toast-${toast.type}`}>
            <span className="nex-toast-icon">
              {toast.type === 'success' && '✅'}
              {toast.type === 'error' && '❌'}
              {toast.type === 'info' && 'ℹ️'}
              {toast.type === 'premium' && '⭐'}
            </span>
            <span className="nex-toast-msg">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* --- MOBILE TOP BAR / DESKTOP HAMBURGER --- */}
      {isMobile ? (
        <header className="mobile-top-bar">
          <button
            type="button"
            className={`mobile-top-btn mobile-menu-btn ${sidebarOpen ? 'open' : ''}`}
            onClick={() => (sidebarOpen ? closeSidebar() : openSidebar())}
            aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <span /><span /><span />
          </button>
          <div className="mobile-top-center">
            <span className="mobile-top-title">NEX Music</span>
            {nickname && <span className="mobile-top-user">@{nickname}</span>}
          </div>
          <button
            type="button"
            className="mobile-top-btn mobile-close-btn"
            onClick={handleMobileClose}
            aria-label="Cerrar"
          >
            <Dismiss24Regular />
          </button>
        </header>
      ) : (
        <button
          type="button"
          className={`hamburger-btn ${sidebarOpen ? 'open' : ''}`}
          onClick={() => (sidebarOpen ? closeSidebar() : openSidebar())}
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          <span /><span /><span />
        </button>
      )}

      {/* --- SIDEBAR OVERLAY --- */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      {/* --- LEFT SIDEBAR --- */}
      <div className={`spotify-sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${isMobile ? 'spotify-sidebar-mobile' : ''}`}>
        {isMobile && (
          <button type="button" className="sidebar-close-btn" onClick={closeSidebar} aria-label="Cerrar menú">
            <Dismiss24Regular />
          </button>
        )}
        {/* --- NEX MUSIC BRANDING --- */}
        <div className="nex-branding">
          <div
            className={`nex-logo ${logoAnimating ? 'nex-logo-animate' : ''} ${isPlaying ? 'nex-logo-pulse' : ''}`}
            onClick={handleLogoClick}
          >
            <div className="nex-logo-ring nex-logo-ring-1"></div>
            <div className="nex-logo-ring nex-logo-ring-2"></div>
            <div className="nex-logo-ring nex-logo-ring-3"></div>
            <span className="nex-logo-text">{pcnMode ? 'PCN' : 'NXM'}</span>
          </div>
          <h1 className="nex-title">NEX MUSIC</h1>
          <span className="power-by">Creado por Salvador Juarez</span>
          {nickname && <span className="user-nickname">@{nickname}</span>}
          <CloudSyncBadge status={cloudSyncStatus} />
          {!spotifyConnected ? (
            <button
              type="button"
              className="sidebar-spotify-connect"
              onClick={() => startSpotifyAuth(window.location.pathname || '/nex-music')}
            >
              Conectar Spotify
            </button>
          ) : (
            <button
              type="button"
              className="sidebar-spotify-connect connected"
              onClick={() => {
                setShowSpotifyImportModal(true);
                closeSidebar();
              }}
            >
              Importar Spotify
            </button>
          )}
        </div>
        {/* --- TOP MENU --- */}
        <div className="spotify-sidebar-top">
          <div className={`spotify-nav-item ${activeTab === 'search' ? 'active' : ''}`} onClick={() => { setActiveTab('search'); closeSidebar(); }}>
            <Search24Regular />
            <span>Buscar</span>
          </div>
          <div className={`spotify-nav-item ${activeTab === 'my-playlists' ? 'active' : ''}`} onClick={() => { setActiveTab('my-playlists'); closeSidebar(); }}>
            <Home24Filled />
            <span>Mis Listas</span>
          </div>
          <div className={`spotify-nav-item ${activeTab === 'global-playlists' ? 'active' : ''}`} onClick={() => { setActiveTab('global-playlists'); closeSidebar(); }}>
            <Globe24Regular />
            <span>Listas Globales</span>
          </div>
          <div className={`spotify-nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setProfileDeepLink(null); closeSidebar(); }}>
            <People24Regular />
            <span>Usuarios</span>
          </div>
          <div className={`spotify-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => { setActiveTab('profile'); closeSidebar(); }}>
            <Person24Regular />
            <span>Mi perfil</span>
          </div>
        </div>

        {/* --- LIBRARY --- */}
        <div className="spotify-library">
          <div className="spotify-library-header">
          <div className="spotify-library-title">
            <Library24Filled />
            <span>Tu biblioteca</span>
            <CloudSyncBadge status={cloudSyncStatus} compact />
          </div>
          <div className="spotify-library-actions">
            <button className="spotify-btn-icon" title="Crear lista" onClick={() => setShowAddPlaylistModal(true)}>
              <Add24Filled />
            </button>
          </div>
          </div>

          {/* --- NAV TABS --- */}
          <div className="spotify-nav-tabs">
            <button
              className={`spotify-nav-tab ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => { setActiveTab('favorites'); closeSidebar(); }}
            >
              <Heart24Filled />
            </button>
            <button
              className={`spotify-nav-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => { setActiveTab('history'); closeSidebar(); }}
            >
              <History24Regular />
            </button>
            <button
              className={`spotify-nav-tab ${activeTab === 'queue' ? 'active' : ''}`}
              onClick={() => { setActiveTab('queue'); closeSidebar(); }}
            >
              <List24Regular />
            </button>
          </div>

          {/* --- LIBRARY CONTENT --- */}
          <div className="spotify-library-content">
            {/* --- PLAYLIST ITEMS --- */}
            {playlists.map(playlist => (
              <div
                key={playlist.id}
                className="spotify-playlist-item"
                onClick={() => { setActivePlaylistId(playlist.id); setActiveTab('my-playlists'); closeSidebar(); }}
              >
                <div className="spotify-playlist-cover">
                  <MusicNote224Filled />
                </div>
                <div className="spotify-playlist-info">
                  <div className="spotify-playlist-name">{playlist.name}</div>
                  <div className="spotify-playlist-desc">{playlist.tracks.length} canciones · {playlist.isPrivate ? 'Privada' : 'Pública'}</div>
                </div>
              </div>
            ))}

            <div className="spotify-playlist-item" onClick={() => { setActiveTab('favorites'); closeSidebar(); }}>
              <div className="spotify-playlist-cover spotify-cover-liked">
                <Heart24Filled />
              </div>
              <div className="spotify-playlist-info">
                <div className="spotify-playlist-name">Me gusta</div>
                <div className="spotify-playlist-desc">{favorites.length} canciones</div>
              </div>
            </div>

            {/* --- HISTORY ITEM --- */}
            <div className="spotify-playlist-item" onClick={() => { setActiveTab('history'); closeSidebar(); }}>
              <div className="spotify-playlist-cover spotify-cover-history">
                <History24Regular />
              </div>
              <div className="spotify-playlist-info">
                <div className="spotify-playlist-name">Historial</div>
                <div className="spotify-playlist-desc">Reproducido recientemente</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="spotify-main">
        {/* --- HEADER --- */}
        <div className="spotify-header">
          <div className="spotify-search-bar">
            <Search24Regular className="spotify-search-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch(query)}
              placeholder="¿Qué quieres escuchar?"
              className="spotify-search-input"
            />
            <button
              className="spotify-search-button"
              onClick={() => runSearch(query)}
              disabled={!query.trim() || loading}
            >
              <ArrowRight24Filled />
            </button>
          </div>
          <div className="spotify-services">
            <button
              type="button"
              className={`spotify-service-btn live-btn ${roomCode ? 'active live-active' : ''}`}
              onClick={() => setShowLivePanel(true)}
              title="Salas en vivo (Socket.io)"
            >
              <People24Regular style={{ width: 16, height: 16, marginRight: 6 }} />
              {roomCode ? `En vivo · ${roomCode}${djMode.enabled ? ' · DJ' : ''}` : 'En vivo'}
            </button>
            {(['youtube', 'youtube-music', 'spotify'] as ServiceType[]).map((service) => (
              <button
                key={service}
                className={`spotify-service-btn ${activeService === service ? 'active' : ''}`}
                onClick={() => setActiveService(service)}
              >
                {service === 'youtube' ? 'YouTube' : service === 'youtube-music' ? 'YT Music' : 'Spotify'}
              </button>
            ))}
          </div>
        </div>

        {/* --- CONTENT --- */}
        <div className="spotify-content">
          {/* --- SEARCH TAB --- */}
          {activeTab === 'search' && (
            <div className="spotify-search-results">
              <WeeklyStatsCard stats={weekStats} />
              <h2>Resultados de búsqueda</h2>

              {!query.trim() && !searchResults.length && (
                <div className="spotify-empty">
                  <Search24Regular />
                  <p>{isMobile ? 'Buscá canciones, artistas o playlists arriba ↑' : 'Escribe algo en la barra de búsqueda para empezar'}</p>
                </div>
              )}

              {loading && (
                <div className="spotify-loading">
                  <div className="spotify-spinner" />
                  <p>Buscando...</p>
                </div>
              )}

              {!loading && searchResults.length > 0 && (
                <div className="spotify-grid">
                  {searchResults.map((result) => {
                    if ('service' in result && result.service === 'spotify') {
                      const spotifyResult = result as SpotifyResult;
                      return (
                        <div key={spotifyResult.id} className="spotify-card">
                          <div className="spotify-card-image">
                            <img src={spotifyResult.cover} alt={spotifyResult.title} />
                            <button
                              className="spotify-play-btn"
                              onClick={() => playFromSearch(spotifyResult)}
                            >
                              <Play24Filled />
                            </button>
                          </div>
                          <div className="spotify-card-info">
                            <div className="spotify-card-title">{spotifyResult.title}</div>
                            <div className="spotify-card-artist">{spotifyResult.artist}</div>
                          </div>
                          <button
                            className="spotify-add-btn"
                            onClick={() => addTrackToQueue(spotifyResult)}
                            title="Añadir a la cola"
                          >
                            <Add24Filled />
                          </button>
                          {showDjSuggest && (
                            <button
                              className="spotify-dj-btn"
                              onClick={() => suggestFromSearch(spotifyResult)}
                              title="Sugerir al DJ"
                            >
                              🎧
                            </button>
                          )}
                          {/* Add to playlist dropdown */}
                          {playlists.length > 0 && (
                            <div className="spotify-add-to-playlist-dropdown">
                              <button
                                className="spotify-add-to-playlist-btn">
                                <List24Regular />
                              </button>
                              <div className="spotify-playlist-dropdown">
                                {playlists.map(p => (
                                  <div
                                    key={p.id} className="spotify-dropdown-item"
                                    onClick={async () => {
                                      const track = await resolveSearchToTrack(result);
                                      if (track) {
                                        addTrackToPlaylist(p.id, track);
                                      }
                                    }}
                                  >
                                    {p.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    const youtubeResult = result as YouTubeResult;
                    return (
                      <div key={youtubeResult.id} className="spotify-card">
                        <div className="spotify-card-image">
                          <img src={youtubeResult.thumbnail} alt={youtubeResult.title} />
                          <button
                            className="spotify-play-btn"
                            onClick={() => playFromSearch(youtubeResult)}
                          >
                            <Play24Filled />
                          </button>
                        </div>
                        <div className="spotify-card-info">
                          <div className="spotify-card-title">{youtubeResult.title}</div>
                          <div className="spotify-card-artist">{youtubeResult.channelTitle}</div>
                        </div>
                        <button
                          className="spotify-add-btn"
                          onClick={() => addTrackToQueue(youtubeResult)}
                          title="Añadir a la cola"
                        >
                          <Add24Filled />
                        </button>
                        {showDjSuggest && (
                          <button
                            className="spotify-dj-btn"
                            onClick={() => suggestFromSearch(youtubeResult)}
                            title="Sugerir al DJ"
                          >
                            🎧
                          </button>
                        )}
                        {/* Add to playlist dropdown */}
                        {playlists.length > 0 && (
                          <div className="spotify-add-to-playlist-dropdown">
                            <button
                              className="spotify-add-to-playlist-btn">
                                <List24Regular />
                              </button>
                              <div className="spotify-playlist-dropdown">
                                {playlists.map(p => (
                                  <div
                                    key={p.id} className="spotify-dropdown-item"
                                    onClick={async () => {
                                      const track = await resolveSearchToTrack(result);
                                      if (track) {
                                        addTrackToPlaylist(p.id, track);
                                      }
                                    }}
                                  >
                                    {p.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!loading && query.trim() && searchResults.length === 0 && !loading && (
                <div className="spotify-empty">
                  <Search24Regular />
                  <p>No se encontraron resultados para "{query}"</p>
                </div>
              )}
            </div>
          )}

          {/* --- MY PLAYLISTS TAB --- */}
          {activeTab === 'my-playlists' && (
            <div className="spotify-list-view">
              <div className="spotify-list-header spotify-list-header-with-actions">
                <div className="spotify-list-header-text">
                  <h2>Mis Listas de Reproducción</h2>
                </div>
                <div className="header-actions">
                  {!spotifyConnected ? (
                    <button
                      type="button"
                      className="spotify-btn-primary spotify-connect-header-btn"
                      onClick={() => startSpotifyAuth(window.location.pathname || '/nex-music')}
                    >
                      Conectar Spotify
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="spotify-btn-secondary spotify-import-spotify-btn"
                      onClick={() => setShowSpotifyImportModal(true)}
                    >
                      Importar Spotify
                    </button>
                  )}
                  <button
                    type="button"
                    className="spotify-btn-secondary"
                    onClick={() => setShowImportModal(true)}
                  >
                    Importar
                  </button>
                  <button
                    type="button"
                    className="spotify-btn-primary"
                    onClick={() => setShowAddPlaylistModal(true)}
                  >
                    <Add24Filled /> Nueva Lista
                  </button>
                </div>
              </div>

              {activePlaylistId ? (
                <>
                  {(() => {
                    const activePlaylist = playlists.find(p => p.id === activePlaylistId);
                    if (!activePlaylist) return null;
                    return (
                      <>
                        <div className="spotify-playlist-header">
                          <div className="spotify-playlist-hero-cover" onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                  const base64 = e.target?.result as string;
                                  setPlaylists(playlists.map(p => p.id === activePlaylistId ? { ...p, cover: base64 } : p));
                                };
                                reader.readAsDataURL(file);
                              }
                            };
                            input.click();
                          }} style={{cursor: 'pointer', overflow: 'hidden'}} title="Cambiar portada">
                            {activePlaylist.cover ? (
                              <img src={activePlaylist.cover} alt={activePlaylist.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                            ) : (
                              <div className="spotify-hero-placeholder">
                                <MusicNote224Filled />
                              </div>
                            )}
                          </div>
                          <div className="spotify-playlist-hero-info">
                            <div className="spotify-playlist-hero-type">Lista de Reproducción</div>
                            {editingPlaylistId === activePlaylistId ? (
                              <form onSubmit={(e) => {
                                e.preventDefault();
                                if (editPlaylistName.trim()) {
                                  renamePlaylist(activePlaylistId, editPlaylistName.trim());
                                  setEditingPlaylistId(null);
                                }
                              }} className="playlist-edit-form">
                                <input
                                  type="text"
                                  value={editPlaylistName}
                                  onChange={(e) => setEditPlaylistName(e.target.value)}
                                  autoFocus
                                />
                                <button type="submit" className="save-edit-btn">
                                  Guardar
                                </button>
                              </form>
                            ) : (
                              <h1 className="spotify-playlist-hero-title">{activePlaylist.name}</h1>
                            )}
                            <p className="spotify-playlist-hero-desc">
                              Por {activePlaylist.ownerName} · {activePlaylist.tracks.length} canciones
                            </p>
                            <div className="spotify-playlist-hero-actions">
                              <button
                                className="spotify-play-hero-btn"
                                onClick={() => {
                                  if (activePlaylist.tracks.length > 0) {
                                    playPlaylistFrom(activePlaylist.tracks, 0);
                                  }
                                }}
                              >
                                {isPlaying ? <Pause24Filled /> : <Play24Filled />}
                              </button>
                              <button
                                className="spotify-icon-btn"
                                onClick={() => {
                                  togglePlaylistPrivacy(activePlaylistId);
                                }}
                                title={activePlaylist.isPrivate ? 'Hacer pública' : 'Hacer privada'}
                              >
                                {activePlaylist.isPrivate ? <LockClosedRegular /> : <Globe24Regular />}
                              </button>
                              <PublishToCloudButton
                                playlist={activePlaylist}
                                nickname={nickname}
                                showToast={showToast}
                                supabaseUserId={supabaseUserId}
                                supabaseAuthReady={supabaseAuthReady}
                                supabaseAuthError={supabaseAuthError}
                                supabaseRetry={supabaseRetry}
                              />
                              {editingPlaylistId !== activePlaylistId && (
                                <button
                                  className="spotify-icon-btn"
                                  onClick={() => {
                                    setEditingPlaylistId(activePlaylistId);
                                    setEditPlaylistName(activePlaylist.name);
                                  }}
                                  title="Renombrar"
                                >
                                  <Edit24Regular />
                                </button>
                              )}
                              <button
                                className="spotify-icon-btn"
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      showToast('Generando link corto…', 'info');
                                      const { url } = await createShortPlaylistShareUrl(activePlaylist);
                                      const result = await shareOrCopy({
                                        title: `${activePlaylist.name} · NEX Music`,
                                        text: `Escuchá mi lista "${activePlaylist.name}" en NEX Music`,
                                        url,
                                      });
                                      const msg = shareResultToast(result);
                                      if (msg) showToast(msg, 'success');
                                    } catch (err) {
                                      showToast(
                                        err instanceof Error ? err.message : 'No se pudo crear el link corto',
                                        'error',
                                      );
                                    }
                                  })();
                                }}
                                title="Compartir lista (link corto)"
                              >
                                <Share24Regular />
                              </button>
                              <button
                                className="spotify-icon-btn danger"
                                onClick={() => deletePlaylist(activePlaylistId)}
                                title="Eliminar lista"
                              >
                                <Delete24Regular />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="spotify-track-list">
                          {activePlaylist.tracks.length === 0 ? (
                            <div className="spotify-empty">
                              <MusicNote224Filled />
                              <p>Esta lista está vacía. Busca canciones y añádelas!</p>
                            </div>
                          ) : (
                            activePlaylist.tracks.map((track, index) => (
                            <div
                              key={track.id}
                              className="spotify-track-row"
                              onClick={() => playPlaylistFrom(activePlaylist.tracks, index)}
                            >
                              <div className="spotify-track-cover">
                                <img src={track.cover} alt={track.title} />
                              </div>
                              <div className="spotify-track-main">
                                <div className="spotify-track-title">{track.title}</div>
                                <div className="spotify-track-artist">
                                  {track.artist}
                                  {track.service === 'spotify' && !track.videoId && (
                                    <span className="spotify-track-spotify-tag">Spotify → YT</span>
                                  )}
                                </div>
                              </div>
                              <button
                                className="spotify-track-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeTrackFromPlaylist(activePlaylistId, track.id);
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))
                        )}
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="spotify-empty">
                  <Library24Filled />
                  <p>Selecciona una lista de reproducción o crea una nueva!</p>
                </div>
              )}
            </div>
          )}

          {/* --- GLOBAL PLAYLISTS TAB --- */}
          {activeTab === 'global-playlists' && (
            <GlobalPlaylistsView
              nickname={nickname}
              localFallback={playlists}
              playCloudPlaylist={playCloudPlaylist}
              voteForPlaylist={voteForPlaylist}
              unvoteForPlaylist={unvoteForPlaylist}
              showToast={showToast}
              supabaseUserId={supabaseUserId}
              supabaseAuthReady={supabaseAuthReady}
              supabaseAuthError={supabaseAuthError}
              supabaseRetry={supabaseRetry}
              onOpenSpotifyImport={() =>
                spotifyConnected
                  ? setShowSpotifyImportModal(true)
                  : startSpotifyAuth(window.location.pathname || '/nex-music')
              }
              spotifyImportLabel={spotifyConnected ? 'Importar de Spotify' : 'Conectar Spotify'}
            />
          )}

          {activeTab === 'users' && (
            <UsersDirectoryView
              nickname={nickname}
              supabaseUserId={supabaseUserId}
              supabaseAuthReady={supabaseAuthReady}
              showToast={showToast}
              initialProfileNick={profileDeepLink}
              onProfileClosed={() => setProfileDeepLink(null)}
              playCloudPlaylist={playCloudPlaylist}
            />
          )}

          {activeTab === 'profile' && (
            nickname ? (
              <UsersDirectoryView
                nickname={nickname}
                supabaseUserId={supabaseUserId}
                supabaseAuthReady={supabaseAuthReady}
                showToast={showToast}
                forceOwnProfile
                onLeaveOwnProfile={() => setActiveTab('users')}
                playCloudPlaylist={playCloudPlaylist}
              />
            ) : (
              <div className="spotify-list-view">
                <div className="spotify-empty">
                  <p>Configurá tu nickname para tener perfil</p>
                  <button type="button" className="modal-btn-primary" onClick={() => setShowNicknameModal(true)}>
                    Elegir nickname
                  </button>
                </div>
              </div>
            )
          )}

          {/* --- QUEUE TAB --- */}
          {activeTab === 'queue' && (
            <div className="spotify-list-view">
              <div className="spotify-list-header">
                <h2>Cola de reproducción</h2>
              </div>
              {queue.length === 0 ? (
                <div className="spotify-empty">
                  <List24Regular />
                  <p>No hay canciones en la cola</p>
                </div>
              ) : (
                <div className="spotify-track-list">
                  {queue.map((track, index) => (
                  <div key={track.id} className="spotify-track-row" onClick={() => playTrack(track)}>
                    <div className="spotify-track-cover">
                      <img src={track.cover} alt={track.title} />
                    </div>
                    <div className="spotify-track-main">
                      <div className="spotify-track-title">{track.title}</div>
                      <div className="spotify-track-artist">{track.artist}</div>
                    </div>
                    <button
                      className="spotify-track-btn"
                      onClick={(e) => { e.stopPropagation(); removeFromQueue(track.id); }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                </div>
              )}
            </div>
          )}

          {/* --- FAVORITES TAB --- */}
          {activeTab === 'favorites' && (
            <div className="spotify-list-view">
              <div className="spotify-list-header">
                <h2>Me gusta</h2>
                <p>{favorites.length} canciones</p>
              </div>
              {favorites.length === 0 ? (
                <div className="spotify-empty">
                  <Heart24Filled />
                  <p>No tienes favoritos aún</p>
                </div>
              ) : (
                <div className="spotify-track-list">
                  {favorites.map((track, index) => (
                  <div
                    key={track.id}
                    className={`spotify-track-row ${currentTrack?.id === track.id ? 'active' : ''}`}
                    onClick={() => playTrack(track)}
                  >
                    <div className="spotify-track-cover">
                      <img src={track.cover} alt={track.title} />
                    </div>
                    <div className="spotify-track-main">
                      <div className="spotify-track-title">{track.title}</div>
                      <div className="spotify-track-artist">{track.artist}</div>
                    </div>
                    <button
                      className={`spotify-heart-small ${bumpHeartId === track.id ? 'heart-bump' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleHeartClick(track); }}
                    >
                      <Heart24Filled />
                    </button>
                  </div>
                ))}
                </div>
              )}
            </div>
          )}

          {/* --- HISTORY TAB --- */}
          {activeTab === 'history' && (
            <div className="spotify-list-view">
              <div className="spotify-list-header">
                <h2>Historial</h2>
                <p>Reproducido recientemente</p>
              </div>
              {history.length === 0 ? (
                <div className="spotify-empty">
                  <History24Regular />
                  <p>No hay historial aún</p>
                </div>
              ) : (
                <div className="spotify-track-list">
                  {history.map((track, index) => (
                  <div
                    key={track.id}
                    className={`spotify-track-row ${currentTrack?.id === track.id ? 'active' : ''}`}
                    onClick={() => playTrack(track)}
                  >
                    <div className="spotify-track-cover">
                      <img src={track.cover} alt={track.title} />
                    </div>
                    <div className="spotify-track-main">
                      <div className="spotify-track-title">{track.title}</div>
                      <div className="spotify-track-artist">{track.artist}</div>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- PLAYER BAR --- */}
      {currentTrack && (
        <div className="spotify-player">
          {/* --- LEFT INFO --- */}
          <div className="spotify-player-left">
            <img src={currentTrack.cover} alt="" className="spotify-player-cover" />
            <div className="spotify-player-info">
              <div className="spotify-player-title">{currentTrack.title}</div>
              <div className="spotify-player-artist">
                {currentTrack.artist}
                {currentTrack.matchQuality && (
                  <span className={`match-pill match-${currentTrack.matchQuality}`}>
                    {MATCH_LABEL[currentTrack.matchQuality]}
                  </span>
                )}
              </div>
              {queue[0] && (
                <div className="spotify-next-up">Siguiente: {queue[0].title}</div>
              )}
            </div>
            <button
              className={`spotify-player-heart ${bumpHeartId === currentTrack.id ? 'heart-bump' : ''}`}
              onClick={() => handleHeartClick(currentTrack)}
              title="Me gusta"
            >
              {isFavorite(currentTrack.id) ? <Heart24Filled /> : <Heart24Regular />}
            </button>
            <button
              className="spotify-player-heart"
              title="Radio a partir de este tema"
              onClick={() => {
                void (async () => {
                  showToast('Armando radio…', 'info');
                  const radio = await buildRadioFromTrack(currentTrack, 10);
                  if (!radio.length) {
                    showToast('No se pudo armar la radio', 'error');
                    return;
                  }
                  radio.forEach((t) => addToQueue(t));
                  showToast(`+${radio.length} temas a la cola (radio)`, 'success');
                })();
              }}
            >
              <Sparkle24Regular />
            </button>
            {currentTrack.service === 'spotify' && (
              <button
                className="spotify-player-heart"
                title="Mal match · buscar de nuevo"
                onClick={() => {
                  void (async () => {
                    showToast('Buscando mejor match…', 'info');
                    const again = await reResolveTrack(currentTrack);
                    if (!again) {
                      showToast('No se encontró otro match', 'error');
                      return;
                    }
                    void playTrack(again);
                    showToast(`Nuevo match: ${MATCH_LABEL[again.matchQuality || 'approx']}`, 'success');
                  })();
                }}
              >
                ≈
              </button>
            )}
            <button
              className="spotify-player-heart"
              onClick={() => {
                void (async () => {
                  const result = await shareOrCopy({
                    title: `${currentTrack.title} · NEX Music`,
                    text: `Ahora suena: ${currentTrack.title} — ${currentTrack.artist}`,
                    url: buildNexMusicHomeUrl(),
                  });
                  const msg = shareResultToast(result);
                  if (msg) showToast(msg, 'success');
                })();
              }}
              title="Compartir ahora suena"
              id="share-btn"
            >
              <Share24Regular />
            </button>
            {playlists.length > 0 && (
              <div className="spotify-player-playlist-dropdown">
                <button
                  className="spotify-player-heart"
                  title="Añadir a lista"
                >
                  <List24Regular />
                </button>
                <div className="spotify-player-dropdown-menu">
                  {playlists.map(p => (
                    <div
                      key={p.id}
                      className="spotify-dropdown-item"
                      onClick={() => addTrackToPlaylist(p.id, currentTrack)}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* --- CENTER CONTROLS --- */}
          <div className="spotify-player-center">
            <div className="spotify-player-controls">
              <button
                className={`spotify-player-btn ${shuffleOn ? 'active' : ''}`}
                onClick={toggleShuffle}
                title="Shuffle"
              >
                <ArrowShuffle24Filled />
              </button>
              <button className="spotify-player-btn" onClick={prevTrack}>
                <Previous24Filled />
              </button>
              <button
                className="spotify-player-play"
                onClick={handleTogglePlay}
              >
                {isPlaying ? <Pause24Filled /> : <Play24Filled />}
              </button>
              <button className="spotify-player-btn" onClick={nextTrack}>
                <Next24Filled />
              </button>
              <button
                className={`spotify-player-btn ${repeatMode !== 'off' ? 'active' : ''}`}
                onClick={cycleRepeat}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === 'one' ? <ArrowRepeat124Regular /> : <ArrowRepeatAll24Regular />}
              </button>
            </div>
            <div className="spotify-player-progress">
              <span className="spotify-time">{formatTime((progress / 100) * duration)}</span>
              <div
                className="spotify-progress-bar"
                onClick={handleSeek}
                style={{ '--progress': `${progress}%` } as React.CSSProperties}
              >
                <div
                  className="spotify-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="spotify-time">{formatTime(duration)}</span>
            </div>
          </div>

          {/* --- RIGHT VOLUME --- */}
          <div className="spotify-player-right">
            <div className="audio-enhance-anchor">
              <button
                type="button"
                className={`spotify-player-btn ${showAudioPanel ? 'active' : ''}`}
                onClick={() => setShowAudioPanel((v) => !v)}
                title="Sonido Potencia"
                aria-pressed={showAudioPanel}
              >
                <Options24Regular />
              </button>
              <AudioEnhancePanel
                open={showAudioPanel}
                onClose={() => setShowAudioPanel(false)}
                settings={audioEnhance.settings}
                onChange={audioEnhance.setSettings}
                playbackMode={streamPlayer.mode}
                onEnablePower={() => {
                  audioEnhance.enablePowerPreset();
                  showToast('Modo Potencia ON · DSP + Club + 8D', 'premium');
                }}
              />
            </div>
            <button
              type="button"
              className={`spotify-player-btn party-toggle ${isPartyMode ? 'active' : ''}`}
              onClick={togglePartyMode}
              title={isPartyMode ? 'Desactivar Party Mode' : 'Activar Party Mode · 3D'}
              aria-pressed={isPartyMode}
            >
              <Sparkle24Regular />
            </button>
            <button
              className={`spotify-player-btn ${showLyrics ? 'active' : ''}`}
              onClick={() => setShowLyrics(!showLyrics)}
            >
              <Book24Regular />
            </button>
            <div className="spotify-volume">
              <Speaker224Filled />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="spotify-volume-slider"
              />
            </div>
          </div>
        </div>
      )}

      <PwaInstallBanner
        open={pwa.visible}
        onInstall={() => { void pwa.install(); }}
        onDismiss={pwa.dismiss}
      />

      {roomCode && (
        <RoomInviteSticky
          roomCode={roomCode}
          inviteUrl={buildRoomInviteUrl(roomCode)}
          onOpenPanel={() => setShowLivePanel(true)}
          onInvite={() => {
            void (async () => {
              const result = await shareOrCopy({
                title: `Sala ${roomCode} · NEX Music`,
                text: `Unite a mi sala en NEX Music (${roomCode})`,
                url: buildRoomInviteUrl(roomCode),
              });
              const msg = shareResultToast(result);
              if (msg) showToast(msg, 'success');
            })();
          }}
        />
      )}

      <MusicOnboardingBanner
        open={showOnboarding && !showNicknameModal}
        onDismiss={() => {
          setShowOnboarding(false);
          try { localStorage.setItem('nexMusicOnboardingSeen', '1'); } catch { /* ignore */ }
        }}
        onConnectSpotify={() => {
          setShowOnboarding(false);
          try { localStorage.setItem('nexMusicOnboardingSeen', '1'); } catch { /* ignore */ }
          if (spotifyConnected) setShowSpotifyImportModal(true);
          else startSpotifyAuth(window.location.pathname || '/nex-music');
        }}
        onExploreGlobal={() => {
          setShowOnboarding(false);
          try { localStorage.setItem('nexMusicOnboardingSeen', '1'); } catch { /* ignore */ }
          setActiveTab('global-playlists');
          closeSidebar();
        }}
        onCreateRoom={() => {
          setShowOnboarding(false);
          try { localStorage.setItem('nexMusicOnboardingSeen', '1'); } catch { /* ignore */ }
          setShowLivePanel(true);
        }}
      />

      <LiveRoomPanel
        open={showLivePanel}
        onClose={() => setShowLivePanel(false)}
        connected={syncConnected}
        connectionError={syncError}
        roomCode={roomCode}
        isHost={isRoomHost}
        roomUsers={roomUsers}
        chatMessages={liveChat}
        reactions={liveReactions}
        onCreateRoom={createLiveRoom}
        onJoinRoom={joinLiveRoom}
        onLeaveRoom={leaveLiveRoom}
        onSendChat={sendLiveChat}
        onSendReaction={sendLiveReaction}
        djMode={djMode}
        djPool={djPool}
        djEq={djEq}
        onToggleDj={toggleDjMode}
        onToggleDjAutoPlay={setDjAutoPlay}
        onUpdateDjEq={updateDjEq}
        onVoteDj={voteDjTrack}
        onPlayTopDj={playTopDjTrack}
        onClearDj={clearDjPool}
      />
      </div>{/* .spotify-ui-shell */}

      {/* --- GLOBAL STYLES --- */}
      <style>{`
        * {
          box-sizing: border-box;
        }

        .spotify-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          width: 100%;
          background: #0a0a0a;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          color: #fff;
          overflow: hidden;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          isolation: isolate;
        }

        .is-mobile.spotify-root {
          height: 100dvh;
          max-height: 100dvh;
        }

        /* YouTube stays behind the opaque UI — never covers the app on mobile */
        .spotify-yt-audio {
          position: fixed !important;
          left: 0 !important;
          top: 0 !important;
          width: 2px !important;
          height: 2px !important;
          max-width: 2px !important;
          max-height: 2px !important;
          overflow: hidden !important;
          z-index: 0 !important;
          pointer-events: none !important;
          opacity: 1;
        }
        .spotify-yt-audio iframe,
        .spotify-yt-audio > div {
          width: 2px !important;
          height: 2px !important;
          max-width: 2px !important;
          max-height: 2px !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          border: 0 !important;
          pointer-events: none !important;
        }

        .spotify-ui-shell {
          position: relative;
          z-index: 20;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          width: 100%;
          height: 100%;
          background: #121212;
          overflow: hidden;
          isolation: isolate;
        }

        .is-mobile .spotify-ui-shell {
          background: #0a0a0a;
        }

        /* legacy class kept for safety if old markup remains */
        .spotify-iframe-permanent {
          display: none !important;
        }

        /* --- MODALS --- */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .modal-content {
          background: #1a1a1a;
          padding: 32px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          width: 90%;
          max-width: 400px;
        }

        .modal-content h2 {
          margin: 0 0 8px 0;
        }

        .modal-content p {
          color: rgba(255,255,255,0.6);
          margin-bottom: 24px;
        }

        .modal-hint {
          color: rgba(255,255,255,0.5);
          font-size: 13px;
          line-height: 1.45;
          margin: -8px 0 16px;
        }

        .spotify-connect-box {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .spotify-connect-btn {
          width: 100%;
          background: #1db954 !important;
          color: #000 !important;
        }

        .spotify-connected-badge {
          color: #1ed760;
          font-size: 13px;
          font-weight: 600;
          margin: 0 0 12px;
        }

        .spotify-import-spotify-btn {
          border-color: rgba(30, 215, 96, 0.45);
          color: #1ed760;
        }

        .spotify-import-spotify-btn:hover {
          background: rgba(30, 215, 96, 0.12);
          border-color: rgba(30, 215, 96, 0.65);
        }

        .spotify-track-spotify-tag {
          display: inline-block;
          margin-left: 6px;
          font-size: 10px;
          font-weight: 700;
          color: #1ed760;
          vertical-align: middle;
        }

        .modal-content input {
          width: 100%;
          background: #2a2a2a;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 12px;
          border-radius: 8px;
          color: #fff;
          margin-bottom: 20px;
          font-size: 16px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .modal-btn-primary {
          background: #fff;
          color: #000;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .modal-btn-secondary {
          background: transparent;
          color: #fff;
          border: 1px solid rgba(255,255,255,0.2);
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .playlist-edit-form {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .playlist-edit-form input {
          flex: 1;
          background: #2a2a2a;
          border: 1px solid rgba(255,255,255,0.2);
          padding: 8px 12px;
          border-radius: 8px;
          color: #fff;
          font-size: 24px;
          font-weight: 800;
        }

        .save-edit-btn {
          background: #1db954;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        /* --- HAMBURGER MENU --- */
        .hamburger-btn {
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 1000;
          background: #141414;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          width: 52px;
          height: 52px;
          padding: 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 6px;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }

        .hamburger-btn:hover {
          background: #1e1e1e;
          border-color: rgba(255,255,255,0.25);
        }

        .hamburger-btn span {
          width: 20px;
          height: 2px;
          background: #fff;
          border-radius: 2px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: center;
        }

        .hamburger-btn.open span:nth-child(1) {
          transform: rotate(45deg) translateY(7px);
        }

        .hamburger-btn.open span:nth-child(2) {
          opacity: 0;
        }

        .hamburger-btn.open span:nth-child(3) {
          transform: rotate(-45deg) translateY(-7px);
        }

        /* --- MOBILE TOP BAR --- */
        .mobile-top-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1001;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: max(6px, env(safe-area-inset-top)) 8px 6px;
          min-height: 48px;
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .mobile-top-center {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }

        .mobile-top-title {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .mobile-top-user {
          font-size: 11px;
          color: #1db954;
          font-weight: 600;
        }

        .mobile-top-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          padding: 0;
          -webkit-tap-highlight-color: transparent;
        }

        .mobile-menu-btn {
          flex-direction: column;
          gap: 4px;
        }

        .mobile-menu-btn span {
          width: 16px;
          height: 2px;
          background: #fff;
          border-radius: 2px;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .mobile-menu-btn.open span:nth-child(1) {
          transform: translateY(6px) rotate(45deg);
        }

        .mobile-menu-btn.open span:nth-child(2) {
          opacity: 0;
        }

        .mobile-menu-btn.open span:nth-child(3) {
          transform: translateY(-6px) rotate(-45deg);
        }

        .sidebar-close-btn {
          position: absolute;
          top: max(10px, env(safe-area-inset-top));
          right: 10px;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.08);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
        }

        .is-mobile .hamburger-btn {
          display: none;
        }

        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          z-index: 49;
          backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* --- SIDEBAR --- */
        .spotify-sidebar {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: #000;
          height: 100vh;
          width: 300px;
          position: fixed;
          left: -100%;
          top: 0;
          border-right: 1px solid rgba(255,255,255,0.08);
          z-index: 50;
          transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 4px 0 24px rgba(0,0,0,0.6);
        }

        .spotify-sidebar.sidebar-open {
          left: 0;
        }

        .spotify-sidebar-mobile {
          width: min(88vw, 300px);
          height: 100dvh;
          padding-top: max(12px, env(safe-area-inset-top));
          padding-bottom: env(safe-area-inset-bottom);
        }

        .spotify-sidebar-mobile .spotify-sidebar-top {
          margin-top: 44px;
        }

        .spotify-sidebar-mobile .nex-branding {
          padding: 12px 8px;
          gap: 8px;
        }

        .spotify-sidebar-mobile .nex-logo {
          width: 56px;
          height: 56px;
        }

        .spotify-sidebar-mobile .nex-title {
          font-size: 18px;
        }

        .spotify-sidebar-mobile .power-by {
          display: none;
        }

        .spotify-sidebar-mobile .spotify-nav-item {
          padding: 10px 12px;
          font-size: 14px;
          gap: 12px;
        }

        .spotify-sidebar-mobile .spotify-library-header {
          padding: 14px 16px;
        }

        .is-mobile .spotify-main {
          padding-top: calc(48px + env(safe-area-inset-top));
        }

        .is-mobile .spotify-header {
          flex-direction: column;
          align-items: stretch;
          padding: 8px 12px !important;
          gap: 8px;
          flex-shrink: 0;
        }

        .is-mobile .spotify-search-bar {
          width: 100%;
          max-width: none;
          min-width: 0;
          padding: 6px 10px;
          gap: 8px;
          border-radius: 999px;
        }

        .is-mobile .spotify-search-icon {
          width: 18px;
          height: 18px;
        }

        .is-mobile .spotify-search-input {
          font-size: 14px;
        }

        .is-mobile .spotify-search-button {
          padding: 6px 10px;
          min-width: 34px;
          min-height: 34px;
        }

        .is-mobile .spotify-services {
          display: flex !important;
          flex-wrap: nowrap !important;
          grid-template-columns: none !important;
          overflow-x: auto;
          width: 100%;
          gap: 6px !important;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding-bottom: 2px;
        }

        .is-mobile .spotify-services::-webkit-scrollbar {
          display: none;
        }

        .is-mobile .spotify-service-btn {
          flex-shrink: 0;
          white-space: nowrap;
          font-size: 11px !important;
          padding: 6px 10px !important;
          border-radius: 999px;
        }

        .is-mobile .spotify-content {
          padding: 8px 12px calc(88px + env(safe-area-inset-bottom)) !important;
        }

        .is-mobile .spotify-search-results h2 {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .is-mobile .spotify-empty {
          padding: 28px 12px;
          gap: 10px;
          min-height: 0;
        }

        .is-mobile .spotify-empty svg {
          font-size: 32px;
        }

        .is-mobile .spotify-empty p {
          font-size: 13px;
          line-height: 1.4;
        }

        .is-mobile .spotify-list-header h2 {
          font-size: 20px;
        }

        .is-mobile .spotify-playlist-hero-cover {
          width: 112px !important;
          height: 112px !important;
        }

        .is-mobile .spotify-playlist-hero-title {
          font-size: 22px !important;
        }

        .is-mobile .spotify-playlist-hero-actions {
          flex-wrap: wrap;
          gap: 8px;
        }

        .is-mobile .publish-cloud-btn {
          font-size: 12px;
          padding: 8px 12px;
        }

        .is-mobile .spotify-player {
          padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
          gap: 6px;
          min-height: 64px;
        }

        .is-mobile .spotify-player-cover {
          width: 44px !important;
          height: 44px !important;
        }

        .is-mobile .spotify-player-title {
          font-size: 13px;
        }

        .is-mobile .spotify-player-artist {
          font-size: 11px;
        }

        .is-mobile .spotify-player-center {
          order: 0;
          width: auto;
          flex: 0;
        }

        .is-mobile .spotify-player-controls {
          gap: 8px;
        }

        .is-mobile .spotify-player-play {
          width: 36px;
          height: 36px;
        }

        .is-mobile .spotify-player-progress {
          display: none;
        }

        .is-mobile .spotify-player-left {
          flex: 1;
          width: auto;
          min-width: 0;
        }

        .is-mobile .spotify-player-right {
          gap: 4px;
        }

        .is-mobile .spotify-player-left .spotify-player-heart {
          display: none;
        }

        .is-mobile .nex-toast-container {
          bottom: calc(88px + env(safe-area-inset-bottom));
        }

        .is-standalone.is-mobile {
          height: 100dvh;
          max-height: 100dvh;
          overflow: hidden;
        }

        .spotify-sidebar-top {
          background: #0d0d0d;
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          border: 1px solid rgba(255,255,255,0.06);
          margin-top: 76px;
        }

        .spotify-nav-item {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 15px;
          font-weight: 700;
          color: rgba(255,255,255,0.65);
          cursor: pointer;
          transition: all 0.15s ease;
          padding: 12px 14px;
          border-radius: 8px;
        }

        .spotify-nav-item:hover {
          color: #fff;
          background: rgba(255,255,255,0.06);
        }

        .spotify-nav-item.active {
          color: #000;
          background: #fff;
        }

        .spotify-library {
          background: #0d0d0d;
          border-radius: 12px;
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.06);
        }

        .spotify-library-header {
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .spotify-library-title {
          display: flex;
          align-items: center;
          gap: 12px;
          color: rgba(255,255,255,0.65);
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: color 0.15s;
        }

        .spotify-library-title:hover {
          color: #fff;
        }

        .spotify-btn-icon {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          padding: 10px;
          border-radius: 10px;
          transition: all 0.15s;
        }

        .spotify-btn-icon:hover {
          color: #000;
          background: #fff;
        }

        .spotify-nav-tabs {
          display: flex;
          gap: 8px;
          padding: 0 20px 14px;
        }

        .spotify-nav-tab {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          color: rgba(255,255,255,0.75);
          padding: 10px 12px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.15s ease;
        }

        .spotify-nav-tab:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }

        .spotify-nav-tab.active {
          background: #fff;
          color: #000;
          border-color: #fff;
        }

        .spotify-library-content {
          flex: 1;
          overflow-y: auto;
          padding: 8px 12px;
        }

        .spotify-playlist-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s ease;
          border: 1px solid transparent;
        }

        .spotify-playlist-item:hover {
          background: rgba(255,255,255,0.06);
        }

        .spotify-playlist-cover {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          position: relative;
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.8);
        }

        .spotify-cover-liked {
          background: #1a1a1a;
          color: #fff;
        }

        .spotify-cover-history {
          background: #1a1a1a;
          color: rgba(255,255,255,0.7);
        }

        .spotify-playlist-info {
          flex: 1;
          min-width: 0;
        }

        .spotify-playlist-name {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 3px;
        }

        .spotify-playlist-desc {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }

        .nex-branding {
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .nex-logo {
          width: 80px;
          height: 80px;
          position: relative;
          cursor: pointer;
        }

        .nex-logo-ring {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid #1db954;
        }

        .nex-logo-ring-1 {
          animation: nex-pulse 2s ease-out infinite;
        }

        .nex-logo-ring-2 {
          animation: nex-pulse 2s ease-out infinite;
          animation-delay: 0.5s;
        }

        .nex-logo-ring-3 {
          animation: nex-pulse 2s ease-out infinite;
          animation-delay: 1s;
        }

        .nex-logo-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-weight: 900;
          font-size: 18px;
          color: #fff;
        }

        @keyframes nex-pulse {
          0% {
          transform: scale(0.5);
          opacity: 1;
        }
          100% {
          transform: scale(1.5);
          opacity: 0;
        }
        }

        .nex-logo-animate .nex-logo-ring {
          animation-play-state: paused;
        }

        .nex-logo-pulse {
          animation: spin 3s linear infinite;
        }

        .nex-title {
          font-size: 24px;
          font-weight: 900;
          margin: 0;
        }

        .power-by {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }

        .user-nickname {
          font-size: 14px;
          color: #1db954;
          font-weight: 600;
        }

        .sidebar-spotify-connect {
          width: 100%;
          margin-top: 4px;
          padding: 10px 12px;
          border: none;
          border-radius: 999px;
          background: #1db954;
          color: #000;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease;
        }

        .sidebar-spotify-connect:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .sidebar-spotify-connect.connected {
          background: rgba(30, 215, 96, 0.15);
          color: #1ed760;
          border: 1px solid rgba(30, 215, 96, 0.4);
        }

        .spotify-connect-header-btn {
          background: #1db954 !important;
          color: #000 !important;
          border: none !important;
        }

        .audio-enhance-anchor {
          position: relative;
        }

        /* --- MAIN CONTENT --- */
        .spotify-main {
          margin-left: 0;
          margin-right: 0;
          margin-top: 0;
          margin-bottom: 0;
          height: 100%;
          min-height: 0;
          background: #000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 0;
          z-index: 1;
        }

        .spotify-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 28px 20px 96px;
          background: #000;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          gap: 24px;
          flex-wrap: wrap;
        }

        .spotify-search-bar {
          display: flex;
          align-items: center;
          gap: 14px;
          background: #121212;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 50px;
          padding: 12px 20px;
          flex: 1;
          max-width: 480px;
          min-width: 220px;
          transition: border-color 0.15s ease;
        }

        .spotify-search-bar:focus-within {
          border-color: rgba(255,255,255,0.4);
        }

        .spotify-search-icon {
          color: rgba(255,255,255,0.5);
          flex-shrink: 0;
        }

        .spotify-search-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: #fff;
          font-size: 15px;
          font-weight: 500;
          min-width: 0;
        }

        .spotify-search-input::placeholder {
          color: rgba(255,255,255,0.45);
        }

        .spotify-search-button {
          background: #fff;
          border: none;
          border-radius: 50px;
          color: #000;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spotify-search-button:hover:not(:disabled) {
          transform: scale(1.06);
        }

        .spotify-search-button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .spotify-services {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .spotify-service-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          color: rgba(255,255,255,0.65);
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.15s ease;
        }

        .spotify-service-btn:hover {
          border-color: rgba(255,255,255,0.4);
          color: #fff;
        }

        .spotify-service-btn.active {
          background: #fff;
          color: #000;
          border-color: #fff;
        }

        .spotify-service-btn.live-btn {
          display: inline-flex;
          align-items: center;
        }

        .spotify-service-btn.live-active {
          background: rgba(29, 185, 84, 0.2);
          color: #1db954;
          border-color: #1db954;
        }

        .spotify-content {
          flex: 1;
          overflow-y: auto;
          padding: 32px;
          padding-bottom: 120px;
        }

        .spotify-search-results h2 {
          font-size: 24px;
          font-weight: 800;
          margin-bottom: 24px;
          color: #fff;
        }

        .spotify-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
        }

        .spotify-card {
          background: #0d0d0d;
          border-radius: 12px;
          padding: 16px;
          cursor: pointer;
          transition: background 0.15s ease;
          position: relative;
          border: 1px solid rgba(255,255,255,0.06);
        }

        .spotify-card:hover {
          background: #161616;
          border-color: rgba(255,255,255,0.12);
        }

        .spotify-card-image {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 14px;
        }

        .spotify-card-image img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .spotify-hero-placeholder {
          width: 100%;
          aspect-ratio: 1;
          background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 80px;
          color: rgba(255,255,255,0.3);
        }

        .spotify-card:hover .spotify-card-image img {
          transform: scale(1.05);
        }

        .spotify-play-btn {
          position: absolute;
          right: 10px;
          bottom: 10px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #fff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transform: translateY(6px);
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
          color: #000;
        }

        .spotify-card:hover .spotify-play-btn {
          opacity: 1;
          transform: translateY(0);
        }

        .spotify-play-btn:hover {
          transform: scale(1.08);
        }

        .spotify-card-info {
          min-height: 64px;
        }

        .spotify-card-title {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #fff;
        }

        .spotify-card-artist {
          font-size: 13px;
          color: rgba(255,255,255,0.55);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .spotify-add-btn {
          position: absolute;
          top: 22px;
          right: 22px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(0,0,0,0.7);
          border: 1px solid rgba(255,255,255,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s ease;
          color: #fff;
          backdrop-filter: blur(8px);
        }

        .spotify-card:hover .spotify-add-btn {
          opacity: 1;
        }

        .spotify-add-btn:hover {
          background: #fff;
          color: #000;
          border-color: #fff;
        }

        .spotify-dj-btn {
          position: absolute;
          top: 22px;
          right: 66px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(251, 191, 36, 0.15);
          border: 1px solid rgba(251, 191, 36, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s ease;
          font-size: 16px;
        }

        .spotify-card:hover .spotify-dj-btn {
          opacity: 1;
        }

        .spotify-dj-btn:hover {
          background: #fbbf24;
          border-color: #fbbf24;
          transform: scale(1.08);
        }

        /* Add to playlist dropdown */
        .spotify-add-to-playlist-dropdown {
          position: absolute;
          top: 22px;
          right: 110px;
        }

        .spotify-add-to-playlist-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(0,0,0,0.7);
          border: 1px solid rgba(255,255,255,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s ease;
          color: #fff;
          backdrop-filter: blur(8px);
        }

        .spotify-card:hover .spotify-add-to-playlist-btn {
          opacity: 1;
        }

        .spotify-add-to-playlist-btn:hover {
          background: #fff;
          color: #000;
          border-color: #fff;
        }

        .spotify-playlist-dropdown {
          position: absolute;
          top: 48px;
          right: 0;
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 8px 0;
          min-width: 160px;
          display: none;
          z-index: 100;
        }

        .spotify-add-to-playlist-dropdown:hover .spotify-playlist-dropdown {
          display: block;
        }

        .spotify-dropdown-item {
          padding: 8px 16px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .spotify-dropdown-item:hover {
          background: rgba(255,255,255,0.06);
        }

        .spotify-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 24px;
          gap: 16px;
          color: rgba(255,255,255,0.5);
        }

        .spotify-empty svg {
          font-size: 56px;
          opacity: 0.4;
        }

        .spotify-empty p {
          font-size: 16px;
          text-align: center;
        }

        .spotify-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 24px;
          gap: 20px;
        }

        .spotify-spinner {
          width: 44px;
          height: 44px;
          border: 3px solid rgba(255,255,255,0.12);
          border-left: 3px solid #fff;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .spotify-list-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .spotify-list-header {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .spotify-list-header-with-actions {
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
          margin-bottom: 4px;
        }

        @media (min-width: 640px) {
          .spotify-list-header-with-actions {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
          }
        }

        .spotify-list-header-text {
          min-width: 0;
          flex: 1;
        }

        .header-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .spotify-list-header h2 {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          margin: 0;
        }

        .spotify-list-header p {
          color: rgba(255,255,255,0.55);
          font-size: 14px;
          margin: 0;
        }

        .spotify-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #1db954;
          border: none;
          color: #fff;
          padding: 10px 20px;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .spotify-btn-primary:hover {
          background: #1ed760;
          transform: scale(1.02);
        }

        .spotify-btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.22);
          color: #fff;
          padding: 10px 18px;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .spotify-btn-secondary:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.35);
        }

        .spotify-track-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .spotify-track-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s ease;
          position: relative;
        }

        .spotify-track-row:hover {
          background: rgba(255,255,255,0.07);
        }

        .spotify-track-row.active {
          background: rgba(255,255,255,0.12);
        }

        .spotify-track-row.active .spotify-track-title {
          color: #fff;
        }

        .spotify-track-cover {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          flex-shrink: 0;
          overflow: hidden;
          position: relative;
        }

        .spotify-track-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .spotify-track-play-icon {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          opacity: 0;
          transition: opacity 0.2s;
          background: rgba(0,0,0,0.65);
          border-radius: 50%;
          padding: 10px;
          color: #fff;
        }

        .spotify-track-row:hover .spotify-track-play-icon {
          opacity: 1;
        }

        .spotify-play-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          gap: 3px;
          align-items: flex-end;
          height: 20px;
          background: rgba(0,0,0,0.5);
          padding: 6px;
          border-radius: 6px;
        }

        .spotify-play-indicator span {
          width: 3px;
          background: #fff;
          border-radius: 2px;
          animation: wave 1s ease-in-out infinite;
        }

        .spotify-play-indicator span:nth-child(1) {
          animation-delay: 0s;
        }

        .spotify-play-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .spotify-play-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes wave {
          0%, 100% { height: 6px; }
          50% { height: 18px; }
        }

        .spotify-track-main {
          flex: 1;
          min-width: 0;
        }

        .spotify-track-title {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: rgba(255,255,255,0.85);
        }

        .spotify-track-artist {
          font-size: 13px;
          color: rgba(255,255,255,0.55);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .spotify-track-btn {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          font-size: 24px;
          line-height: 1;
          padding: 8px;
          border-radius: 8px;
          transition: all 0.15s ease;
        }

        .spotify-track-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.1);
        }

        .spotify-heart-small {
          background: transparent;
          border: none;
          color: #1db954;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: all 0.15s ease;
        }

        .spotify-heart-small:hover {
          background: rgba(255,255,255,0.1);
        }

        .heart-bump {
          animation: bump 0.3s ease-out;
        }

        @keyframes bump {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }

        /* --- PLAYLIST HEADER --- */
        .spotify-playlist-header {
          display: flex;
          gap: 24px;
          margin-bottom: 32px;
        }

        .spotify-playlist-hero-cover {
          width: 200px;
          height: 200px;
          flex-shrink: 0;
        }

        .spotify-hero-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }

        .spotify-playlist-hero-info {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          gap: 12px;
        }

        .spotify-playlist-hero-type {
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 700;
        }

        .spotify-playlist-hero-title {
          font-size: 64px;
          font-weight: 900;
          margin: 0;
          line-height: 1;
        }

        .spotify-playlist-hero-desc {
          color: rgba(255,255,255,0.6);
          font-size: 14px;
          margin: 0;
        }

        .spotify-playlist-hero-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .spotify-play-hero-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #1db954;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s ease;
          color: #fff;
        }

        .spotify-play-hero-btn:hover {
          transform: scale(1.06);
        }

        .spotify-heart-btn, .spotify-lyrics-btn {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          padding: 12px;
          border-radius: 50%;
          transition: all 0.15s ease;
        }

        .spotify-heart-btn:hover, .spotify-lyrics-btn:hover {
          background: rgba(255,255,255,0.1);
        }

        .spotify-heart-btn.active {
          color: #1db954;
        }

        .spotify-lyrics-btn.active {
          color: #fff;
        }

        .spotify-icon-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          cursor: pointer;
          padding: 10px;
          border-radius: 50%;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
        }

        .spotify-icon-btn:hover {
          background: rgba(255,255,255,0.1);
        }

        .spotify-icon-btn.danger:hover {
          background: rgba(255,0,0,0.2);
          border-color: rgba(255,0,0,0.3);
        }

        /* --- LYRICS --- */
        .lyrics-container {
          margin-bottom: 32px;
        }

        .lyrics-header {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
          font-size: 18px;
          font-weight: 700;
        }

        .lyrics-content {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 24px;
        }

        .lyrics-section {
          font-size: 32px;
          font-weight: 700;
          margin: 24px 0;
        }

        .lyrics-line {
          font-size: 24px;
          margin: 12px 0;
          color: rgba(255,255,255,0.6);
        }

        /* --- PARTY MODE (Anyma-style immersive) --- */
        .party-3d-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        .party-3d-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 30%, rgba(2,2,8,0.85) 100%);
          pointer-events: none;
        }

        .party-active {
          background: transparent !important;
        }

        .party-active .spotify-main,
        .party-active .spotify-sidebar,
        .party-active .spotify-sidebar-top,
        .party-active .spotify-library {
          background: rgba(8, 8, 16, 0.55);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }

        .party-active .spotify-main,
        .party-active .spotify-sidebar,
        .party-active .spotify-sidebar-top,
        .party-active .spotify-library,
        .party-active .spotify-player,
        .party-active .spotify-header,
        .party-active .hamburger-btn,
        .party-active .nex-toast-container {
          position: relative;
          z-index: 2;
        }

        .party-active .spotify-player {
          background: rgba(8, 8, 16, 0.72);
          border-top-color: rgba(56, 189, 248, 0.2);
          box-shadow: 0 -8px 40px rgba(56, 189, 248, 0.08);
        }

        .party-active .spotify-header {
          background: rgba(8, 8, 16, 0.45);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .party-active .spotify-track-cover img,
        .party-active .spotify-album-art,
        .party-active .spotify-player-cover {
          box-shadow: 0 0 40px rgba(56, 189, 248, 0.35), 0 0 80px rgba(168, 85, 247, 0.2);
          animation: partyArtPulse 3s ease-in-out infinite;
        }

        @keyframes partyArtPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(56,189,248,0.3); }
          50% { transform: scale(1.02); box-shadow: 0 0 50px rgba(168,85,247,0.45); }
        }

        .party-active .spotify-play-btn,
        .party-active .spotify-player-play {
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.5);
        }

        .party-active h1,
        .party-active h2,
        .party-active .spotify-track-title,
        .party-active .nex-title {
          background: linear-gradient(90deg, #38bdf8, #a855f7, #2dd4bf, #38bdf8);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: rainbowText 4s linear infinite;
        }

        @keyframes rainbowText {
          to { background-position: 200% center; }
        }

        .party-toggle.active {
          color: #38bdf8 !important;
          filter: drop-shadow(0 0 6px rgba(56,189,248,0.8));
        }

        .party-active::after {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg, transparent 60%, rgba(56,189,248,0.04) 100%);
          z-index: 1;
        }

        .lyrics-line {
          font-size: 24px;
          margin: 12px 0;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          padding: 4px 0;
        }

        .lyrics-line:hover {
          color: #fff;
        }

        /* --- PLAYER --- */
        .spotify-player {
          flex-shrink: 0;
          background: rgba(18, 18, 18, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          padding: 16px 24px;
          gap: 16px;
          box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
        }

        .spotify-player-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 180px;
          width: 30%;
        }

        .spotify-player-cover {
          width: 64px;
          height: 64px;
          border-radius: 8px;
          object-fit: cover;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          transition: transform 0.2s ease;
        }
        
        .spotify-player-cover:hover {
          transform: scale(1.05);
        }

        .spotify-player-info {
          min-width: 0;
        }

        .spotify-player-title {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #fff;
        }

        .spotify-player-artist {
          font-size: 13px;
          color: rgba(255,255,255,0.6);
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          white-space: normal;
        }

        .spotify-next-up {
          margin-top: 2px;
          font-size: 11px;
          color: rgba(30, 215, 96, 0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 240px;
        }

        .match-pill {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
        }
        .match-official { color: #1ed760; }
        .match-topic { color: #60cdff; }
        .match-good { color: #f0c14b; }
        .match-approx { color: #f87171; }

        .spotify-player {
          padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        }

        .spotify-player-heart {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spotify-player-heart:hover {
          color: #fff;
          background: rgba(255,255,255,0.1);
          transform: scale(1.1);
        }

        .spotify-player-playlist-dropdown {
          position: relative;
        }

        .spotify-player-dropdown-menu {
          position: absolute;
          bottom: calc(100% + 4px);
          left: 50%;
          transform: translateX(-50%);
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 8px 0;
          min-width: 160px;
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s ease;
          z-index: 1000;
          box-shadow: 0 -4px 16px rgba(0,0,0,0.5);
        }

        .spotify-player-dropdown-menu::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          height: 16px;
        }

        .spotify-player-playlist-dropdown:hover .spotify-player-dropdown-menu {
          opacity: 1;
          visibility: visible;
          bottom: calc(100% + 12px);
        }

        .spotify-player-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
        }

        .spotify-player-controls {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .spotify-player-btn {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spotify-player-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.1);
          transform: scale(1.1);
        }

        .spotify-player-btn.active {
          color: #1db954;
        }

        .spotify-player-play {
          background: #fff;
          border: none;
          color: #000;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .spotify-player-play:hover {
          transform: scale(1.08);
          background: #1db954;
        }

        .spotify-player-progress {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          max-width: 500px;
        }

        .spotify-time {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          min-width: 44px;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }

        .spotify-progress-bar {
          flex: 1;
          height: 4px;
          background: rgba(255,255,255,0.2);
          border-radius: 2px;
          position: relative;
          cursor: pointer;
          transition: height 0.1s ease;
        }
        
        .spotify-progress-bar:hover {
          height: 6px;
        }

        .spotify-progress-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: #fff;
          border-radius: 2px;
          width: var(--progress, 0%);
          transition: background 0.1s ease;
        }
        
        .spotify-progress-bar:hover .spotify-progress-fill {
          background: #1db954;
        }
        
        .spotify-progress-bar::after {
          content: '';
          position: absolute;
          top: 50%;
          left: var(--progress, 0%);
          width: 12px;
          height: 12px;
          background: #fff;
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0);
          transition: transform 0.1s ease, background 0.1s ease;
          pointer-events: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .spotify-progress-bar:hover::after {
          transform: translate(-50%, -50%) scale(1);
        }

        .spotify-player-right {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: flex-end;
          min-width: 180px;
          width: 30%;
        }

        .spotify-volume {
          display: flex;
          align-items: center;
          gap: 12px;
          color: rgba(255,255,255,0.6);
          transition: color 0.2s ease;
        }
        
        .spotify-volume:hover {
          color: #fff;
        }

        .spotify-volume-slider {
          width: 100%;
          max-width: 100px;
          cursor: pointer;
          accent-color: #fff;
          height: 4px;
          transition: all 0.2s ease;
        }
        
        .spotify-volume-slider:hover {
          accent-color: #1db954;
        }

        /* Playlist meta */
        .playlist-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 8px;
        }

        .playlist-votes {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .vote-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          padding: 8px 12px;
          border-radius: 8px;
          transition: all 0.15s ease;
        }

        .vote-btn:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }

        .vote-btn.voted {
          color: #fbbf24;
        }

        .vote-btn svg {
          width: 18px;
          height: 18px;
        }

        .playlist-meta span {
          color: rgba(255,255,255,0.6);
          font-size: 14px;
        }

        /* --- TOAST NOTIFICATIONS --- */
        .nex-toast-container {
          position: fixed;
          bottom: 100px;
          right: 24px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }

        .nex-toast {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-radius: 14px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.12);
          min-width: 260px;
          max-width: 380px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          animation: toastIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.4;
        }

        @keyframes toastIn {
          from { opacity: 0; transform: translateX(80px) scale(0.9); }
          to   { opacity: 1; transform: translateX(0)   scale(1); }
        }

        .nex-toast-success {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.35);
          color: #d1fae5;
        }

        .nex-toast-error {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.35);
          color: #fee2e2;
        }

        .nex-toast-info {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.35);
          color: #dbeafe;
        }

        .nex-toast-premium {
          background: linear-gradient(135deg, rgba(251,191,36,0.2), rgba(217,70,239,0.2));
          border-color: rgba(251,191,36,0.4);
          color: #fef3c7;
        }

        .nex-toast-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .nex-toast-msg {
          flex: 1;
        }

        /* --- MOBILE UX (legacy media — prefer .is-mobile rules above) --- */
        @media (max-width: 768px) {
          .spotify-main {
            margin-left: 0 !important;
            width: 100% !important;
          }

          .spotify-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .spotify-card-title {
            font-size: 13px;
          }

          .spotify-card-artist {
            font-size: 11px;
          }

          .spotify-playlist-hero {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .hamburger-btn {
            top: 14px;
            left: 14px;
            width: 44px;
            height: 44px;
          }

          .nex-toast-container {
            right: 12px;
            left: 12px;
            bottom: 120px;
          }

          .nex-toast {
            min-width: 0;
            max-width: 100%;
          }

          .modal-content {
            width: calc(100% - 32px);
            padding: 24px;
          }
        }

        @media (max-width: 480px) {
          .is-mobile .spotify-volume {
            display: none;
          }

          .is-mobile .spotify-player-right .spotify-player-btn:not(.party-toggle) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default SpotifyMiniStandalone;