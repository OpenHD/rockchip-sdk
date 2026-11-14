import React, { useState, useEffect } from 'react';
import { 
  WeatherSunny24Regular, 
  WeatherCloudy24Regular, 
  WeatherRain24Regular, 
  WeatherSnow24Regular,
  WeatherPartlyCloudyDay24Regular 
} from '@fluentui/react-icons';

const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<{ temp: number; code: number; location: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Tucumán, AR (-26.82, -65.22)
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-26.8241&longitude=-65.2226&current_weather=true');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.current_weather) throw new Error('Respuesta inválida');
      setWeather({
        temp: Math.round(data.current_weather.temperature),
        code: data.current_weather.weathercode,
        location: 'Tucumán, AR'
      });
    } catch (err) {
      console.error('Weather fetch failed', err);
      setError('No se pudo obtener el clima');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <WeatherSunny24Regular style={{ color: '#ffcc33', fontSize: 32 }} />;
    if (code <= 3) return <WeatherPartlyCloudyDay24Regular style={{ color: '#ddd', fontSize: 32 }} />;
    if (code <= 69) return <WeatherRain24Regular style={{ color: '#60cdff', fontSize: 32 }} />;
    if (code <= 79) return <WeatherSnow24Regular style={{ color: '#fff', fontSize: 32 }} />;
    return <WeatherCloudy24Regular style={{ color: '#ccc', fontSize: 32 }} />;
  };

  const getWeatherText = (code: number) => {
    if (code === 0) return 'Despejado';
    if (code <= 3) return 'Parcialmente nublado';
    if (code <= 69) return 'Lluvia';
    if (code <= 79) return 'Nieve';
    return 'Nublado';
  };

  if (loading) return <div className="widget-card loading">Cargando clima...</div>;

  if (error || !weather) {
    return (
      <div className="widget-card weather-live" style={{ alignItems: 'flex-start' }}>
        <div className="weather-header">
          <strong>Clima</strong>
          <span>Sin conexión</span>
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
          {error ?? 'Datos no disponibles'}
        </div>
        <button
          onClick={fetchWeather}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: 4,
            fontSize: 11,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="widget-card weather-live">
      <div className="weather-header">
        <strong>{weather?.location}</strong>
        <span>Ahora</span>
      </div>
      <div className="weather-main">
        <div className="weather-temp">{weather.temp}°</div>
        <div className="weather-icon-box">
          {getWeatherIcon(weather.code)}
          <span className="weather-desc">{getWeatherText(weather.code)}</span>
        </div>
      </div>
      <style>{`
        .weather-live {
          background: linear-gradient(135deg, rgba(0, 120, 212, 0.2), rgba(0, 50, 100, 0.1));
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 160px;
        }
        .weather-header { display: flex; justify-content: space-between; font-size: 11px; opacity: 0.8; }
        .weather-main { display: flex; align-items: center; gap: 16px; }
        .weather-temp { font-size: 36px; font-weight: 300; }
        .weather-icon-box { display: flex; flex-direction: column; align-items: center; }
        .weather-desc { font-size: 10px; margin-top: 4px; }
      `}</style>
    </div>
  );
};

export default WeatherWidget;
