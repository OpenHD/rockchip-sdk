import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SpotifyMiniStandalone, { SpotifyMiniStandaloneProvider } from './components/apps/SpotifyMini.standalone.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpotifyMiniStandaloneProvider>
      <SpotifyMiniStandalone />
    </SpotifyMiniStandaloneProvider>
  </StrictMode>,
)