import React from 'react';
import { useOpenApp, useSettings } from '../sdk/host';

export type HelloProps = {
  greet?: string;
};

const codeStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 12,
};

function btnStyle(accent: string): React.CSSProperties {
  return {
    border: `1px solid ${accent}73`,
    background: `${accent}26`,
    color: '#e8fffa',
    padding: '10px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  };
}

/**
 * Plantilla mínima del SDK 0.2 — tipado, useOpenApp, notificaciones.
 */
export default function HelloNexApp({ greet = 'Hello NEX' }: HelloProps) {
  const openApp = useOpenApp();
  const { addNotification, accentColor } = useSettings();

  return (
    <div
      style={{
        height: '100%',
        boxSizing: 'border-box',
        padding: 28,
        color: '#e8f7ff',
        background:
          'radial-gradient(circle at 20% 20%, rgba(61,214,198,0.22), transparent 45%), linear-gradient(160deg, #071018 0%, #0c1a14 100%)',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: 42, marginBottom: 8 }}>🚀</div>
      <h1 style={{ margin: '0 0 8px', fontSize: 26 }}>{greet}</h1>
      <p style={{ margin: '0 0 8px', opacity: 0.75, maxWidth: 440, lineHeight: 1.5 }}>
        App de ejemplo con <code style={codeStyle}>@nex-os/sdk</code> v0.2 — props tipadas,{' '}
        <code style={codeStyle}>useOpenApp</code> y hooks del host.
      </p>
      <p style={{ margin: '0 0 20px', fontSize: 12, opacity: 0.5 }}>
        Tip: Ctrl+Alt+R → <code style={codeStyle}>hello</code>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={() => {
            if (!openApp('sdk-docs')) {
              addNotification('Hello NEX', 'No se encontró SDK Docs en el registry.');
            }
          }}
          style={btnStyle(accentColor)}
        >
          Abrir SDK Docs
        </button>
        <button
          type="button"
          onClick={() => addNotification('Hello NEX', 'Notificación vía useSettings()')}
          style={{ ...btnStyle(accentColor), opacity: 0.85 }}
        >
          Toast
        </button>
      </div>
      <p style={{ marginTop: 20, fontSize: 12, opacity: 0.45 }}>
        Docs: <code style={codeStyle}>docs/SDK.md</code>
      </p>
    </div>
  );
}
