# Changelog — Nex OS 🚀

Historial oficial de cambios, optimizaciones y lanzamientos del sistema operativo web de alto rendimiento.

---

## [4.0] — Nex Code conectado al motor real (Septiembre 2026)

### 💻 Nex Code
* **[Cerrado] Nex Code sale de "planificado":** el IDE Monaco + IA (Groq) + panel Git que vive en `VsCode.tsx` ya estaba completo y enganchado en taskbar/Start/Buscar/Ejecutar/`.nex`/docs — lo que faltaba era una decisión sobre su alcance. Se cierra como "editor de código embebido en el SO", no como generador de apps instalables sin rebuild (ver Próximos Hitos abajo para esa idea más grande). ✅
* **[Corregido] Consola de Nex Code conectada al motor real:** la terminal interna de Nex Code corría una simulación de texto fijo (`npm install` siempre imprimía "142 packages", `npm run dev` siempre el mismo puerto) desconectada del motor real que usan CMD y Terminal. Ahora corre sobre el mismo `runShellCommand` + `NexRuntimeContext` (npm/pnpm/git reales sobre el VFS): reconoce el `package.json` del workspace, corre los scripts que realmente tiene, y comparte carpeta de proyecto con el resto del SO. ✅
* **[Corregido] `npm`/`pnpm` ahora reconocen proyectos existentes en el VFS:** antes `npm run <script>` solo funcionaba si el proyecto se había creado con `npm init` en esa misma sesión; un `package.json` ya escrito en disco (como el que Nex Code siembra al abrir un workspace) era invisible para el runtime. `getOrLoadProject` en `NexRuntimeContext` ahora lee y cachea el `package.json` del VFS cuando no hay nada en memoria. ✅
* **[Corregido] Nombre consistente:** el lanzador `vscode.nex` y el archivo `.nex` preinstalado decían "Visual Studio Code"; ahora dicen "Nex Code" en todos lados (registro `.nex`, Explorador, Administrador de tareas). ✅

---

## [V2] — Instalación y arranque más rápidos (Septiembre 2026)

### 🚀 Rendimiento en el TV box
* **[Optimizado] Chromium kiosk con aceleración por GPU:** `S99nex-os` ahora lanza Chromium con `--use-gl=egl --ignore-gpu-blocklist --enable-gpu-rasterization --enable-oop-rasterization --enable-zero-copy --enable-accelerated-video-decode`, evitando el fallback a renderizado por software (SwiftShader) al que Chromium recurre por defecto en GPUs Mali no reconocidas — la causa más común de lentitud en kiosks Rockchip. ✅
* **[Optimizado] Menos trabajo en segundo plano:** se deshabilitan `background-networking`, `background-timer-throttling`, `backgrounding-occluded-windows`, `renderer-backgrounding`, `component-update`, `sync` y `translate`, innecesarios en una sesión kiosk de una sola pestaña siempre en primer plano. ✅
* **[Optimizado] Caché de disco acotada:** `--disk-cache-size=104857600` fija el caché de Chromium en ~100MB en vez de dejar que se auto-dimensione según el espacio libre del almacenamiento eMMC/flash. ✅
* **[Agregado] `RK_NEX_OS_CHROMIUM_FLAGS` configurable:** las flags de Chromium se pueden sobrescribir por placa desde `/etc/default/nex-os` sin tocar el script. ✅
* **[Optimizado] Arranque del shell:** el sondeo del socket de Wayland bajó de 1s a 0.2s por intento, reduciendo la espera antes de lanzar Chromium una vez que Weston está listo. ✅

### ⚙️ Build & Deploy
* **[Optimizado] `tools/nex-os/build.sh` evita reinstalar dependencias innecesariamente:** el script ahora compara un hash de `package-lock.json` contra la última instalación (`node_modules/.install-stamp`) y omite `npm ci` cuando no cambió nada, en lugar de reinstalar todo el árbol de dependencias en cada compilación del firmware. ✅
* **[Optimizado] Flags de npm más rápidos:** cuando sí hace falta instalar, se usa `npm ci --prefer-offline --no-audit --no-fund` para evitar chequeos de red innecesarios (auditoría de seguridad y mensajes de funding) en cada build. ✅
* **[Agregado] `.npmrc` con `prefer-offline`, `audit=false` y `fund=false`:** acelera también `npm install`/`npm ci` manuales durante el desarrollo local, reutilizando la caché de npm en vez de golpear el registro en cada corrida. ✅
* **[Confirmado] ccache activo en Buildroot:** se verificó que `BR2_CCACHE=y` ya está habilitado en la configuración base compartida por todos los perfiles Rockchip (`buildroot/configs/rockchip/base/common.config`), y que kernel y paquetes ya compilan en paralelo (`-j$(nproc)+1` / `BR2_JLEVEL=0`). Las recompilaciones incrementales del firmware reutilizan el caché de compilador sin tocar nada del rootfs/kernel actual.

---

## [Season 4] — Desarrollo Actual (Junio 2026)

### ✨ Nex Assistant
* **[Agregado] Asistente de IA con control del sistema:** Nuevo panel "Nex Assistant" (taskbar / `Ctrl+Alt+A`) impulsado por Groq con tool calling real. No solo chatea: puede abrir/cerrar apps, crear notas en Documentos, cambiar el tema neon, y ajustar volumen y brillo en base a lo que le pidas en lenguaje natural. Corre sobre `/api/groq/chat` (`useTools:true`), la misma función serverless que ya usa NEX AI en Nex Code — sin sumar otra función al deployment y sin que la API key llegue al navegador. ✅
* **[Agregado] Nex Assistant en el shell móvil / PWA:** El shell de celular (`MobileShell`) no montaba el panel de escritorio, así que el asistente no existía en mobile. Ahora vive como hoja inferior (bottom sheet) con gesto de swipe-down para cerrar y botón atrás nativo, con acceso desde el centro de control (deslizar desde arriba → "Preguntale a Nex Assistant"). ✅

### ⚡ Motor NEX Runtime
* **[Agregado] Soporte de NPM & PNPM interactivos:** Implementación de un motor de ejecución simulada para inicializar proyectos (`npm init`), instalar paquetes virtuales (`npm install`/`pnpm add`), desinstalar dependencias y ejecutar scripts configurados en package.json de forma totalmente interactiva en las aplicaciones CMD y Terminal. ✅
* **[Agregado] Ejecución nativa de binarios `.nex`:** Creación del sistema de lanzadores `.nex` (análogos a `.exe` en Windows). El Explorador de Archivos (doble clic), el diálogo Ejecutar (`Win + R`) y la consola pueden lanzar programas del sistema directamente desde archivos ejecutables `.nex`. ✅

### 📊 Telemetría y Rendimiento Base
* **[Agregado] Telemetría síncrona en tiempo real:** Implementación exitosa del puente de datos de hardware. El Administrador de Tareas de Nex OS ahora refleja con total fidelidad el uso de CPU, GPU, lectura de disco y consumo de memoria RAM del sistema nativo (Ryzen 5 5500U). ✅
* **[Optimizado] Gestión de Memoria en el Navegador:** Reducción drástica del *footprint* de memoria del lado del cliente. El entorno base reporta apenas un **7% (~0.8 GB)** en comparación con la carga del sistema operativo tradicional.
* **[Optimizado] Renderizado de Gráficas de Recursos:** Rediseño del motor de dibujado de las curvas de rendimiento en tiempo real (60 FPS estables) sin penalizar el hilo principal del navegador.


### 🎨 Interfaz y UX
* **[Agregado] Barra de herramientas de desarrollo:** Accesos directos optimizados en la sección superior para agilizar el flujo de trabajo en la inspección de código y procesos. ✅
* **[Corregido] Youtube y BrowserApp** El sistema puede ejecutar videos de youtube, puedes moverte entre ventanas sin que se pare la música ✅
* **[Agregado] Agregar nuevos usuarios** Ahora puedes agregar un nuevo usuaio. ✅
* **[Mejorado] Modo Oscuro Nativo:** Refinamiento visual en las tonalidades del panel del Administrador de Tareas para una consistencia estética superior frente a entornos de sistemas modernos.

---

## [Próximos Hitos] — Hacia la Beta Pública

### 💻 Nex Code — autoría de apps en vivo
* **[Planificado] Registrar apps en runtime sin rebuild:** hoy un community app (SDK `@nex-os/sdk`) se registra al importarse en `src/community-apps/index.ts`, es decir, en build time. Para que Nex Code pueda "crear apps del SO" de verdad (no solo editar archivos) falta un bundler en el navegador (esbuild-wasm o similar) que compile el workspace y lo registre en el SDK registry en caliente, sin pasar por un commit + rebuild del bundle del host.

---

## [Comunidad y Código Abierto]
* **[Repositorio Público]:** Toda la arquitectura base de simulación, bindings de componentes y layouts se encuentra disponible para la comunidad en GitHub (`shadownrx/windows`).