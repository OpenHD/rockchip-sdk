import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DocsApp from './DocsApp';
import './docs.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DocsApp />
  </StrictMode>,
);
