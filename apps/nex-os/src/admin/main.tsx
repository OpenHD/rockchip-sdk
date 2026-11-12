import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp';
import './admin.css';

// Anti-clickjacking de respaldo: las cabeceras (frame-ancestors / X-Frame-Options) son la
// defensa principal, pero si el hosting no las envía, el panel no se dibuja dentro de un iframe.
if (window.top !== window.self) {
  document.body.textContent = 'Por seguridad, el panel NEX MDM no puede abrirse dentro de otra página.';
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  );
}
