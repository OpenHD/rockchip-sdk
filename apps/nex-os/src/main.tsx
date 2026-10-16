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
import { isMdmBuild } from './mdm/agentState'

// isMdmBuild es constante de build: cada build empaqueta solo su rama. En el TV box
// (1 GB de RAM) no se descarga ni se parsea el escritorio (three.js, git, motion...).
if (isMdmBuild) {
  void import('./mdm/tv')
} else {
  void import('./desktop')
}
