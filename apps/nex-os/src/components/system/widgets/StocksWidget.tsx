import React, { useState, useEffect } from 'react';
import { ArrowUp12Regular, ArrowDown12Regular, Money24Regular } from '@fluentui/react-icons';

const StocksWidget: React.FC = () => {
  const [stocks, setStocks] = useState([
    { symbol: 'MSFT', price: 420.55, change: 1.25 },
    { symbol: 'AAPL', price: 185.92, change: -0.45 },
    { symbol: 'BTC', price: 65432, change: 2.31 }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStocks(prev => prev.map(s => {
        const fluctuate = (Math.random() - 0.5) * (s.symbol === 'BTC' ? 50 : 0.5);
        const newPrice = Math.max(1, s.price + fluctuate);
        const newChange = (newPrice - (s.price - s.change));
        return { ...s, price: Number(newPrice.toFixed(2)), change: Number(newChange.toFixed(2)) };
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="widget-card stocks-live">
      <div className="stocks-header">
        <Money24Regular style={{ color: '#00cc66' }} />
        <strong>Mercados</strong>
        <span>Tiempo real</span>
      </div>
      <div className="stocks-list">
        {stocks.map((s, i) => (
          <div key={i} className="stock-row">
            <div className="stock-info">
              <span className="stock-symbol">{s.symbol}</span>
              <span className="stock-price">${s.price.toLocaleString()}</span>
            </div>
            <div className={`stock-change ${s.change >= 0 ? 'up' : 'down'}`}>
              {s.change >= 0 ? <ArrowUp12Regular /> : <ArrowDown12Regular />}
              {Math.abs(s.change)}%
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .stocks-live {
          background: rgba(45, 45, 45, 0.4);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .stocks-header { display: flex; align-items: center; gap: 8px; font-size: 11px; opacity: 0.8; }
        .stocks-list { display: flex; flex-direction: column; gap: 8px; }
        .stock-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .stock-info { display: flex; flex-direction: column; }
        .stock-symbol { font-size: 13px; font-weight: 600; }
        .stock-price { font-size: 11px; opacity: 0.7; }
        .stock-change { font-size: 12px; display: flex; align-items: center; gap: 2px; font-weight: 600; }
        .stock-change.up { color: #00cc66; }
        .stock-change.down { color: #ff3333; }
      `}</style>
    </div>
  );
};

export default StocksWidget;
