const STATS_KEY = 'nexMusicWeeklyStats_v1';

export interface WeeklyStats {
  weekId: string;
  plays: number;
  uniqueTracks: string[];
  favoritesAdded: number;
  minutesApprox: number;
  lastTitles: string[];
}

function weekId(d = new Date()) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function loadWeeklyStats(): WeeklyStats {
  const id = weekId();
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WeeklyStats;
      if (parsed.weekId === id) return parsed;
    }
  } catch { /* ignore */ }
  return {
    weekId: id,
    plays: 0,
    uniqueTracks: [],
    favoritesAdded: 0,
    minutesApprox: 0,
    lastTitles: [],
  };
}

export function saveWeeklyStats(stats: WeeklyStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* ignore */ }
}

export function recordPlay(trackId: string, title: string, durationSec = 180) {
  const s = loadWeeklyStats();
  s.plays += 1;
  if (!s.uniqueTracks.includes(trackId)) {
    s.uniqueTracks = [...s.uniqueTracks, trackId].slice(-200);
  }
  s.minutesApprox += Math.max(1, Math.round(durationSec / 60));
  s.lastTitles = [title, ...s.lastTitles.filter((t) => t !== title)].slice(0, 8);
  saveWeeklyStats(s);
  return s;
}

export function recordFavorite() {
  const s = loadWeeklyStats();
  s.favoritesAdded += 1;
  saveWeeklyStats(s);
  return s;
}
