import React from 'react';
import type { WeeklyStats } from '../../utils/weeklyStats';

interface WeeklyStatsCardProps {
  stats: WeeklyStats;
}

const WeeklyStatsCard: React.FC<WeeklyStatsCardProps> = ({ stats }) => (
  <div className="nex-week-card">
    <h3>Tu semana</h3>
    <div className="nex-week-grid">
      <div><strong>{stats.plays}</strong><span>plays</span></div>
      <div><strong>{stats.uniqueTracks.length}</strong><span>temas</span></div>
      <div><strong>{stats.minutesApprox}</strong><span>min</span></div>
      <div><strong>{stats.favoritesAdded}</strong><span>likes</span></div>
    </div>
    {stats.lastTitles.length > 0 && (
      <p className="nex-week-last">Recientes: {stats.lastTitles.slice(0, 3).join(' · ')}</p>
    )}
    <style>{`
      .nex-week-card {
        margin: 12px 16px 0;
        padding: 14px;
        border-radius: 14px;
        background: linear-gradient(135deg, rgba(29,185,84,0.12), rgba(255,255,255,0.04));
        border: 1px solid rgba(255,255,255,0.08);
      }
      .nex-week-card h3 { margin:0 0 10px; font-size:14px; }
      .nex-week-grid {
        display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; text-align:center;
      }
      .nex-week-grid strong { display:block; font-size:18px; }
      .nex-week-grid span { font-size:11px; color:rgba(255,255,255,0.5); }
      .nex-week-last {
        margin:10px 0 0; font-size:12px; color:rgba(255,255,255,0.55);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
    `}</style>
  </div>
);

export default WeeklyStatsCard;
