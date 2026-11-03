# Hermes Agent Integration en NexOS

Este documento detalla la arquitectura y el funcionamiento de la integración de **Hermes Agent** dentro del ecosistema de **NexOS**.

## 📌 Visión General

Hermes Agent es un asistente avanzado que se ejecuta de manera local. En lugar de forzar al usuario a abandonar su entorno de trabajo y abrir una nueva ventana del navegador para interactuar con él, NexOS integra el panel completo (dashboard web) de Hermes de forma nativa. 

De esta manera, el Agente mantiene su backend robusto independiente (escrito en Python) mientras su Interfaz Web Original se renderiza de forma transparente e inmersiva como una ventana estandarizada dentro del escritorio virtual de NexOS.

---

## 🏗️ Arquitectura de Integración

La integración se estructura basándose en los siguientes pilares técnicos:

1. **Renderizado Contenido (El Componente `HermesAgent.tsx`)**
   Ubicado en `src/components/apps/HermesAgent.tsx`, este componente React actúa como el "contenedor de ventana" dentro del `WindowManager` de NexOS. 
   Su responsabilidad principal es montar un elemento `<iframe src="http://127.0.0.1:9119">` fluido, encargándose de la pantalla de carga e integrándose sin bordes con el motor de ventanas para que la web local de Hermes se sienta como una aplicación de escritorio nativa compilada.

2. **Evación de CORS y Proxies (`vite.config.ts`)**
   Aunque el iframe se conecta directamente al `localhost:9119`, NexOS expone una regla en el servidor de desarrollo (`/hermes` -> `target: http://localhost:9119`) pensada como capa de compatibilidad para futuras llamadas a la API REST de Hermes a nivel de sistema operativo sin sufrir de bloqueos por políticas CORS del navegador.

3. **Manejo de Sesión (Tokens y WebSockets)**
   Dado que inyectamos directamente la vista completa, el frontend original de Hermes se encarga de raspar e inyectar su propio `window.__HERMES_SESSION_TOKEN__` y de abrir su WebSocket interno (`/api/pty`) para el chat del LLM en tiempo real, operando de manera aislada de forma 100% confiable.

---

## 🚀 Cómo Ejecutar Hermes en NexOS

Dado que NexOS sirve como el "frontend operativo", la API lógica del agente debe levantarse externamente como servicio de fondo.

### Inicialización Correcta

Abre una terminal del sistema (preferiblemente fuera de NexOS para no bloquear tu sesión) y ejecuta:

```bash
hermes dashboard --no-open
```

> [!IMPORTANT]
> El flag `--no-open` es **crítico y obligatorio**. Si omites este comando, el programa de Python de Hermes invocará a tu sistema operativo huésped para que abra tu navegador principal, rompiendo la inmersión. 
> 
> Usando `--no-open`, el backend de inteligencia artificial inicia en silencio y se queda esperando a que NexOS "capture" la vista desde adentro.

---

## 🛠️ Solución de Problemas (Troubleshooting)

- **La ventana de Hermes en NexOS se queda cargando en blanco eternamente:**
  Verifica en tu terminal que `hermes dashboard --no-open` realmente esté corriendo y escuchando en el puerto `9119`. Si está en otro puerto, edita `HermesAgent.tsx` para reflejar el cambio.

- **"Automáticamente me lleva a otra web" (Abre una nueva pestaña fuera de NexOS):**
  Has ejecutado `hermes dashboard` normal. Detén el servidor (Ctrl+C) y vuelve a lanzarlo agregando `--no-open`.

- **Problemas de autenticación / Sesión vencida (Error 401):**
  Como es un entorno de iframe local, el dashboard maneja su propia seguridad. Cierra la aplicación de Hermes dentro del escritorio de NexOS y vuelve a hacer clic en su ícono para forzar una recarga en limpio de los tokens en memoria.
