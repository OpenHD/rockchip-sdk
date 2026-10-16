import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
// Fuentes empaquetadas: en el TV box el filtro de dominios bloquea Google Fonts.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/outfit/latin-300.css'
import '@fontsource/outfit/latin-400.css'
import '@fontsource/outfit/latin-500.css'
import '@fontsource/outfit/latin-600.css'
import '@fontsource/outfit/latin-700.css'
import './index.css'
import './community-apps'
import App from './App.tsx'
import { isMdmBuild } from './mdm/agentState'

if (isMdmBuild) {
  // TV box: escala por alto de pantalla (index.css) y sin service worker (vite.config.ts).
  document.documentElement.classList.add('nex-tv')
} else {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
