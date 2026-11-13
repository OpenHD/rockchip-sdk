import React, { useState, useEffect } from 'react';

export const HermesAgent: React.FC = () => {
  const [loading, setLoading] = useState(true);

  // We use the direct local port for the iframe since the Hermes UI 
  // is built to serve its own assets correctly from the root.
  const HERMES_URL = 'http://127.0.0.1:9119';

  return (
    <div style={styles.root}>
      {loading && (
        <div style={styles.loadingScreen}>
          <div style={styles.spinner} />
          <div style={styles.loadingText}>Cargando interfaz original de Hermes...</div>
        </div>
      )}
      
      <iframe
        src={HERMES_URL}
        title="Hermes Agent Dashboard"
        style={{
          ...styles.iframe,
          opacity: loading ? 0 : 1,
        }}
        onLoad={() => setLoading(false)}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
    height: '100%',
    backgroundColor: '#1e1e1e', // Fallback background
    position: 'relative' as const,
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    transition: 'opacity 0.3s ease-in-out',
  },
  loadingScreen: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e1e',
    zIndex: 10,
  },
  loadingText: {
    color: '#34d399',
    marginTop: 16,
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    fontWeight: 500,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid rgba(52,211,153,0.2)',
    borderTopColor: '#34d399',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

export default HermesAgent;
