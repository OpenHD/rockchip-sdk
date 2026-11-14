import React, { useState, useEffect, useCallback } from 'react';
import { hermesApi, type ModelOption } from './api';

export default function ModelsView() {
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [activeProvider, setActiveProvider] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [switching, setSwitching] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [info, opts] = await Promise.all([
        hermesApi.getModelInfo(),
        hermesApi.getModelOptions(),
      ]);
      setActiveModel(info.model);
      setActiveProvider(info.provider);
      setOptions(opts.models ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar modelos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSwitch = async (provider: string, model: string) => {
    if (provider === activeProvider && model === activeModel) return;
    const key = `${provider}/${model}`;
    setSwitching(key);
    setError(null);
    try {
      await hermesApi.setModel(provider, model);
      setActiveProvider(provider);
      setActiveModel(model);
      setSuccess(`✓ Modelo cambiado a ${model}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar modelo');
    } finally {
      setSwitching(null);
    }
  };

  // Group by provider
  const filtered = options.filter(o =>
    search === '' ||
    o.model.toLowerCase().includes(search.toLowerCase()) ||
    o.provider.toLowerCase().includes(search.toLowerCase()) ||
    o.name?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, ModelOption[]>>((acc, o) => {
    if (!acc[o.provider]) acc[o.provider] = [];
    acc[o.provider].push(o);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🤖</span>
          <div>
            <div style={{ color: '#ffe6cb', fontSize: 18, fontWeight: 700 }}>Modelos</div>
            <div style={{ color: '#ffe6cb50', fontSize: 12 }}>
              Activo: <span style={{ color: '#34d399' }}>{activeModel || '—'}</span>
              {activeProvider && <span style={{ color: '#ffe6cb50' }}> via {activeProvider}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="Buscar modelos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={inputStyle}
          />
          <button onClick={load} style={refreshBtnStyle}>↻</button>
        </div>
      </div>

      {/* Feedback */}
      {success && (
        <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 10, padding: '10px 16px', color: '#34d399', fontSize: 13 }}>
          {success}
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, padding: '10px 16px', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40, justifyContent: 'center' }}>
          <div style={spinnerStyle} />
          <span style={{ color: '#ffe6cb60', fontSize: 14 }}>Cargando modelos...</span>
        </div>
      )}

      {/* Model list */}
      {!loading && (
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(grouped).map(([provider, models]) => (
            <div key={provider}>
              <div style={{ color: '#ffe6cb60', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                {provider}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {models.map(m => {
                  const isActive = m.provider === activeProvider && m.model === activeModel;
                  const key = `${m.provider}/${m.model}`;
                  const isLoading = switching === key;
                  return (
                    <div
                      key={m.model}
                      onClick={() => !isLoading && handleSwitch(m.provider, m.model)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 16px',
                        borderRadius: 10,
                        border: isActive
                          ? '1px solid rgba(52,211,153,0.4)'
                          : '1px solid rgba(255,230,203,0.1)',
                        background: isActive
                          ? 'rgba(52,211,153,0.06)'
                          : 'rgba(255,230,203,0.02)',
                        cursor: isLoading ? 'wait' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: isLoading ? 0.7 : 1,
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,230,203,0.05)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,230,203,0.02)'; }}
                    >
                      {/* Active dot or spinner */}
                      <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0 }}>
                        {isLoading ? (
                          <div style={{
                            width: 10, height: 10, border: '2px solid rgba(255,230,203,0.15)',
                            borderTopColor: '#34d399', borderRadius: '50%',
                            animation: 'hSpin 0.8s linear infinite',
                          }} />
                        ) : (
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: isActive ? '#34d399' : 'rgba(255,230,203,0.2)',
                            boxShadow: isActive ? '0 0 8px #34d399' : 'none',
                          }} />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: isActive ? '#ffe6cb' : '#ffe6cbb0', fontSize: 14, fontWeight: isActive ? 600 : 400 }}>
                          {m.name ?? m.model}
                        </div>
                        <div style={{ color: '#ffe6cb50', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>
                          {m.model}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {m.context_length && (
                          <span style={badge}>{formatCtx(m.context_length)} ctx</span>
                        )}
                        {m.supports_tools && <span style={badge}>🔧 tools</span>}
                        {m.supports_vision && <span style={badge}>👁️ vision</span>}
                        {isActive && (
                          <span style={{
                            ...badge,
                            background: 'rgba(52,211,153,0.15)',
                            border: '1px solid rgba(52,211,153,0.3)',
                            color: '#34d399',
                          }}>✓ Activo</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div style={{ textAlign: 'center', color: '#ffe6cb40', padding: 40, fontSize: 14 }}>
              No se encontraron modelos
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatCtx(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,230,203,0.06)',
  border: '1px solid rgba(255,230,203,0.15)',
  borderRadius: 8,
  color: '#ffe6cb',
  fontSize: 13,
  outline: 'none',
  padding: '7px 12px',
};

const refreshBtnStyle: React.CSSProperties = {
  background: 'rgba(255,230,203,0.08)',
  border: '1px solid rgba(255,230,203,0.15)',
  borderRadius: 8,
  color: '#ffe6cb',
  cursor: 'pointer',
  fontSize: 16,
  padding: '6px 12px',
};

const spinnerStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  border: '2px solid rgba(255,230,203,0.15)',
  borderTopColor: '#34d399',
  borderRadius: '50%',
  animation: 'hSpin 1s linear infinite',
};

const badge: React.CSSProperties = {
  background: 'rgba(255,230,203,0.08)',
  border: '1px solid rgba(255,230,203,0.12)',
  borderRadius: 6,
  color: '#ffe6cb80',
  fontSize: 11,
  padding: '2px 8px',
};
