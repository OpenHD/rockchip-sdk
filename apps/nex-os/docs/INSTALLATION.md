# 📦 Guía de Instalación - WebOS

Esta guía te ayudará a instalar WebOS en tu máquina local y preparar el entorno de desarrollo.

---

## 🔧 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

### 1. Node.js
- **Versión mínima:** 18.0.0
- **Recomendado:** 20.x LTS o superior
- [Descargar Node.js](https://nodejs.org/)

Verifica tu instalación:
```bash
node --version
npm --version
```

### 2. Git (Opcional pero Recomendado)
- Para clonar el repositorio
- [Descargar Git](https://git-scm.com/)

```bash
git --version
```

### 3. Editor de Código (Recomendado)
- **VS Code** ([Descargar](https://code.visualstudio.com/))
- Extensiones recomendadas:
  - ES7+ React/Redux/React-Native snippets
  - Tailwind CSS IntelliSense
  - TypeScript Vue Plugin
  - ESLint

---

## 📥 Instalación Paso a Paso

### Opción 1: Clonar el Repositorio (Recomendado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/windows.git
cd windows

# 2. Instalar dependencias
npm install

# 3. (Opcional) Si necesitas recompilar WASM
npm run build:as

# 4. Iniciar servidor de desarrollo
npm run dev
```

### Opción 2: Descargar como ZIP

1. Ve a GitHub y descarga el repositorio como ZIP
2. Extrae el archivo en la ubicación deseada
3. Abre la terminal en ese directorio
4. Ejecuta:
```bash
npm install
npm run dev
```

---

## ⚙️ Configuración Inicial

### Instalación de Dependencias

El proyecto usa `npm` por defecto, pero también es compatible con `yarn` y `pnpm`:

**Con npm:**
```bash
npm install
```

**Con yarn:**
```bash
yarn install
```

**Con pnpm:**
```bash
pnpm install
```

### Estructura de Carpetas Creada

Después de `npm install`, se crearán las siguientes carpetas:

```
node_modules/          # Todas las dependencias
dist/                  # Compilación de producción (se genera con 'npm run build')
```

---

## 🚀 Iniciando el Servidor de Desarrollo

```bash
npm run dev
```

**Salida esperada:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  press h + enter to show help
```

Abre tu navegador e ingresa a `http://localhost:5173/`

---

## 🏗️ Compilación para Producción

Cuando estés listo para desplegar, ejecuta:

```bash
# Compilar TypeScript y construir con Vite
npm run build

# Ver una vista previa local del build
npm run preview
```

Los archivos compilados se encuentran en la carpeta `dist/`

---

## 🔨 Compilación de WebAssembly (Opcional)

Si necesitas modificar el código de AssemblyScript en `assembly/`, debes recompilarlo:

```bash
npm run build:as
```

Esto generará los archivos compilados en `public/` según lo configurado en `asconfig.json`.

---

## 🧪 Verificación de Instalación

Para verificar que todo se instaló correctamente:

```bash
# Ejecutar linter
npm run lint

# Ver información de las dependencias
npm list
```

---

## 🐛 Solución de Problemas Comunes

### ❌ Error: "npm: command not found"
**Solución:** Node.js no está instalado. Descarga e instala desde [nodejs.org](https://nodejs.org/)

### ❌ Error: "Port 5173 already in use"
**Solución:** El puerto está ocupado. Usa un puerto diferente:
```bash
npm run dev -- --port 3000
```

### ❌ Error: "WASM module not found"
**Solución:** Recompila los módulos:
```bash
npm run build:as
npm run build
```

### ❌ Módulos faltantes después de npm install
**Solución:** Limpia e reinstala:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 Próximos Pasos

Una vez instalado, consulta:
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Guía de desarrollo
- **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** - Estructura del proyecto
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Arquitectura del sistema

---

## ✅ Instalación Completada

¡Felicidades! WebOS está listo para usar. Para más ayuda, consulta [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
