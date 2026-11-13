import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default (ctx) => {
  // Check if we're in hermes-agent-temp/web
  const isHermesWeb = ctx.file?.includes('hermes-agent-temp/web')
  if (isHermesWeb) {
    // Resolve @tailwindcss/postcss from hermes-agent-temp/web/node_modules
    const hermesWebDir = path.resolve(__dirname, 'hermes-agent-temp/web')
    const require = createRequire(path.resolve(hermesWebDir, 'index.js'))
    const tailwindcssPostcss = require('@tailwindcss/postcss')
    return {
      plugins: [tailwindcssPostcss()],
    }
  }
  // Otherwise, use original Tailwind v3 config for NexOS
  return {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  }
}
