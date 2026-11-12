import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './community-apps'
import App from './App.tsx'
import { isMdmBuild } from './mdm/agentState'

registerSW({ immediate: true })

// Pantallas de TV: la raíz escala con el ancho de la pantalla (html.nex-tv en index.css).
if (isMdmBuild) document.documentElement.classList.add('nex-tv')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
