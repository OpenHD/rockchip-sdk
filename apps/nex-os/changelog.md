# Changelog — Nex OS 🚀

Historial oficial de cambios, optimizaciones y lanzamientos del sistema operativo web de alto rendimiento.

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

### 💻 Nex Code (Beta Release — Agosto 23)
* **[Planificado] Nex Code** Herarramienta nueva de desarrollo, para crear apps internamente.

---

## [Comunidad y Código Abierto]
* **[Repositorio Público]:** Toda la arquitectura base de simulación, bindings de componentes y layouts se encuentra disponible para la comunidad en GitHub (`shadownrx/windows`).