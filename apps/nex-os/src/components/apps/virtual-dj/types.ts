export type DjTrackSource = 'youtube' | 'local';

export type DjTrackRef = {
  /** YouTube video id, or stable `local:…` key for files. */
  videoId: string;
  title: string;
  artist: string;
  cover: string;
  durationSec?: number;
  source?: DjTrackSource;
  /** Blob/object URL for local files — skips YouTube resolve. */
  playUrl?: string;
};

export type DjCuePoint = {
  id: number;
  time: number;
  label?: string;
};

export type DjLoopRegion = {
  inTime: number;
  outTime: number;
  enabled: boolean;
};

export type DjEqBands = {
  low: number;
  mid: number;
  high: number;
};

export type DjDeckId = 'A' | 'B';

export type DjDeckUiState = {
  track: DjTrackRef | null;
  loading: boolean;
  error: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  volume: number;
  eq: DjEqBands;
  cues: DjCuePoint[];
  loop: DjLoopRegion | null;
  cuePreview: boolean;
  peaks: Float32Array | null;
};

export const DEFAULT_EQ: DjEqBands = { low: 0, mid: 0, high: 0 };

export const CUE_COLORS = ['#ff4d6d', '#ff9f1c', '#2ec4b6', '#7b2cbf'] as const;
