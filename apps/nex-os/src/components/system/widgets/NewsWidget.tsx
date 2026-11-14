import React, { useState, useEffect } from 'react';
import { News24Regular, ChevronRight16Regular } from '@fluentui/react-icons';

const NewsWidget: React.FC = () => {
  const [news, setNews] = useState<{ title: string; source: string; time: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        // BBC News RSS a JSON vía rss2json
        const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/world/rss.xml');
        const data = await res.json();
        type RssItem = { title: string; pubDate: string };
        const items = (data.items as RssItem[]).slice(0, 3).map((item) => ({
          title: item.title,
          source: data.feed.title,
          time: new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setNews(items);
      } catch (err) {
        setNews([{ title: 'Explora NEX OS 2.0: La simulación definitiva', source: 'NEX OS', time: 'Ahora' }]);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  if (loading) return <div className="widget-card loading">Cargando noticias...</div>;

  return (
    <div className="widget-card news-live">
      <div className="news-header">
        <News24Regular className="news-icon" />
        <strong>Top Stories</strong>
        <span>BBC News</span>
      </div>
      <div className="news-list">
        {news.map((item, i) => (
          <div key={i} className="news-item">
            <span className="news-title">{item.title}</span>
            <div className="news-meta">
              <span className="news-source">{item.source}</span>
              <span className="news-time">{item.time}</span>
            </div>
            <hr className="news-divider" />
          </div>
        ))}
      </div>
      <div className="news-footer">
        Ver más <ChevronRight16Regular />
      </div>
      <style>{`
        .news-live {
          grid-column: span 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 220px;
        }
        .news-header { display: flex; align-items: center; gap: 8px; font-size: 11px; opacity: 0.8; }
        .news-list { display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
        .news-item { display: flex; flex-direction: column; gap: 4px; }
        .news-title { font-size: 13px; font-weight: 500; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .news-meta { display: flex; gap: 8px; font-size: 10px; opacity: 0.6; }
        .news-divider { border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 6px 0; }
        .news-footer { display: flex; align-items: center; justify-content: flex-end; font-size: 11px; color: var(--win-accent); cursor: pointer; }
      `}</style>
    </div>
  );
};

export default NewsWidget;
