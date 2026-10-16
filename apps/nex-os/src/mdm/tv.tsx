import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MdmGate from './MdmGate'

// TV box gestionado: sin escritorio ni sus providers, solo lo que habilita la empresa.
// Escala por alto de pantalla (index.css) y sin service worker (vite.config.ts).
document.documentElement.classList.add('nex-tv')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MdmGate />
  </StrictMode>,
)
