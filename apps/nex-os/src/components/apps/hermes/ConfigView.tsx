import React, { useState, useEffect, useCallback } from 'react';
import { hermesApi } from './api';

export default function ConfigView() {
  const [yaml, setYaml] = useState('');
  const [originalYaml, setOriginalYaml] = useState('');
  const [configPath, setConfigPath] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await hermesApi.getConfigRaw();
      setYaml(resp.yaml);
      setOriginalYaml(resp.yaml);
      setConfigPath(resp.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await hermesApi.saveConfigRaw(yaml);
      setOriginalYaml(yaml);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = yaml !== originalYaml;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>⚙️</span>
          <div>
            <div style={{ color: '#ffe6cb', fontSize: 18, fontWeight: 700 }}>Configuración</div>
            {configPath && (
              <div style={{ color: '#ffe6cb40', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>
                {configPath}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: 'rgba(255,230,203,0.08)', border: '1px solid rgba(255,230,203,0.15)',
              borderRadius: 8, color: '#ffe6cb', cursor: 'pointer', fontSize: 13,
              padding: '7px 14px', opacity: loading ? 0.5 : 1,
            }}
          >↻ Recargar</button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            style={{
              background: isDirty && !saving ? 'rgba(52,211,153,0.2)' : 'rgba(255,230,203,0.05)',
              border: `1px solid ${isDirty ? 'rgba(52,211,153,0.4)' : 'rgba(255,230,203,0.1)'}`,
              borderRadius: 8, color: isDirty ? '#34d399' : '#ffe6cb40',
              cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 600, padding: '7px 16px',
              transition: 'all 0.2s',
            }}
          >
            {saving ? '⏳ Guardando...' : '💾 Guardar'}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {success && (
        <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 10, padding: '10px 16px', color: '#34d399', fontSize: 13 }}>
          ✓ Configuración guardada correctamente
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, padding: '10px 16px', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}
      {isDirty && !saving && (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '8px 16px', color: '#fbbf24', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠️</span> Hay cambios sin guardar
        </div>
      )}

      {/* Editor */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{
            width: 28, height: 28,
            border: '2px solid rgba(255,230,203,0.15)',
            borderTopColor: '#34d399', borderRadius: '50%',
            animation: 'hSpin 1s linear infinite',
          }} />
        </div>
      ) : (
        <div style={{
          flex: 1, overflow: 'hidden',
          border: '1px solid rgba(255,230,203,0.1)',
          borderRadius: 10, background: 'rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Editor toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 14px',
            borderBottom: '1px solid rgba(255,230,203,0.08)',
            background: 'rgba(255,230,203,0.02)',
          }}>
            <span style={{ color: '#ffe6cb50', fontSize: 12, fontFamily: 'monospace' }}>YAML</span>
            <span style={{ color: isDirty ? '#fbbf24' : '#ffe6cb30', fontSize: 11 }}>
              {yaml.split('\n').length} líneas · {yaml.length} chars
            </span>
          </div>
          {/* Textarea */}
          <textarea
            value={yaml}
            onChange={e => setYaml(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#ffe6cb',
              fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
              fontSize: 12,
              lineHeight: 1.7,
              outline: 'none',
              padding: '14px 16px',
              resize: 'none',
              tabSize: 2,
              width: '100%',
            }}
          />
        </div>
      )}
    </div>
  );
}
