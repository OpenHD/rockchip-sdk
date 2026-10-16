import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorCircle24Regular, ArrowClockwise24Regular } from '@fluentui/react-icons';

interface Props {
  children: ReactNode;
  /** Optional name of the app, shown in the error UI */
  appName?: string;
  /** Called when the user clicks "Reintentar" */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

/**
 * Catches runtime errors in any child app window so a single crash
 * doesn't bring down the entire OS shell.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] App crashed:', error, errorInfo);
  }

  handleReset = () => {
    // Bumping resetKey forces a fresh mount of the children subtree,
    // so any internal state that caused the crash is wiped clean.
    this.setState((prev) => ({ hasError: false, error: null, resetKey: prev.resetKey + 1 }));
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            background: 'linear-gradient(135deg, #1f1f1f 0%, #2a1a1a 100%)',
            color: 'white',
            padding: '32px',
            textAlign: 'center',
            fontFamily: 'Segoe UI, sans-serif',
            userSelect: 'text',
          }}
        >
          <div style={{ color: '#ff6b6b', marginBottom: '16px' }}>
            <ErrorCircle24Regular style={{ width: 64, height: 64 }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px 0' }}>
            La aplicación dejó de responder
          </h2>
          {this.props.appName && (
            <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 16px 0', fontSize: '13px' }}>
              {this.props.appName}
            </p>
          )}
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 24px 0', maxWidth: '400px', fontSize: '13px' }}>
            Ocurrió un error inesperado dentro de esta ventana. El resto del sistema sigue funcionando con normalidad.
          </p>
          {this.state.error?.message && (
            <pre
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,107,107,0.3)',
                color: '#ff9b9b',
                padding: '12px 16px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'Consolas, monospace',
                maxWidth: '500px',
                maxHeight: '120px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                margin: '0 0 24px 0',
                textAlign: 'left',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--win-accent, #0078D4)',
              color: 'white',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <ArrowClockwise24Regular style={{ width: 16, height: 16 }} />
            Reintentar
          </button>
        </div>
      );
    }

    return (
      <React.Fragment key={this.state.resetKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

export default ErrorBoundary;
