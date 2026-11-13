# 🔧 Solución de Problemas - WebOS

Soluciones a problemas comunes que pueden surgir durante la instalación y desarrollo de WebOS.

---

## 🔴 Problemas de Instalación

### ❌ Error: "npm: command not found"

**Causa:** Node.js no está instalado o no está en el PATH del sistema.

**Solución:**
1. Descarga Node.js desde [nodejs.org](https://nodejs.org/)
2. Instala la versión LTS (18.x o superior)
3. Reinicia tu terminal
4. Verifica: `node --version` y `npm --version`

---

### ❌ Error: "EACCES: permission denied"

**Causa:** Permisos insuficientes para instalar paquetes.

**Soluciones:**

**En macOS/Linux:**
```bash
# Opción 1: Usar sudo (menos recomendado)
sudo npm install

# Opción 2: Cambiar permisos de npm (recomendado)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install
```

**En Windows:**
- Ejecuta CMD o PowerShell como Administrador
- Vuelve a intentar: `npm install`

---

### ❌ Error: "gyp ERR! build error"

**Causa:** Faltan herramientas de compilación nativas.

**Soluciones:**

**En Windows:**
```bash
npm install --global windows-build-tools
npm install  # Vuelve a intentar
```

**En macOS:**
```bash
xcode-select --install
npm install  # Vuelve a intentar
```

**En Linux (Ubuntu/Debian):**
```bash
sudo apt-get install build-essential python3
npm install  # Vuelve a intentar
```

---

### ❌ Error: "npm ERR! code ERESOLVE"

**Causa:** Conflicto de dependencias.

**Soluciones:**
```bash
# Opción 1: Usar npm legacy peer deps
npm install --legacy-peer-deps

# Opción 2: Limpiar caché
npm cache clean --force
npm install

# Opción 3: Usar versión más nueva de npm
npm install -g npm@latest
npm install
```

---

## 🟡 Problemas de Desarrollo

### ❌ Error: "Port 5173 already in use"

**Causa:** Otro proceso ya está usando el puerto 5173.

**Soluciones:**

**Opción 1: Usar otro puerto**
```bash
npm run dev -- --port 3000
```

**Opción 2: Matar el proceso (Linux/macOS)**
```bash
lsof -i :5173
kill -9 <PID>
npm run dev
```

**Opción 3: Matar el proceso (Windows - PowerShell)**
```powershell
netstat -ano | findstr :5173
taskkill /PID <PID> /F
npm run dev
```

---

### ❌ Error: "Module not found" después de cambios

**Causa:** TypeScript o Vite no ha recargado correctamente.

**Soluciones:**
```bash
# Opción 1: Fuerza el servidor a reiniciar
# Presiona Ctrl+C en la terminal y ejecuta:
npm run dev

# Opción 2: Limpia la caché de Vite
rm -rf node_modules/.vite
npm run dev

# Opción 3: Limpia e reinstala todo
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

### ❌ Error: "Cannot find name 'React'"

**Causa:** TypeScript no reconoce React.

**Solución:**
```bash
npm install
# o si está instalado:
npm install --save-dev @types/react @types/react-dom
```

Verifica que `tsconfig.json` incluya:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

---

### ❌ La aplicación no se recarga después de cambios

**Causa:** HMR (Hot Module Replacement) no funciona correctamente.

**Soluciones:**
1. Actualiza el navegador (F5)
2. Abre DevTools (F12) y desactiva la caché:
   - DevTools → Settings → Network → Disable cache (while DevTools is open)
3. Reinicia el servidor: `npm run dev`
4. Limpia la caché del navegador: `Ctrl+Shift+Del`

---

### ❌ Error: "WASM module not found"

**Causa:** Los módulos WebAssembly no se compilaron.

**Soluciones:**
```bash
# Compila los módulos WASM
npm run asbuild

# Luego reconstruye
npm run build

# O reinicia el servidor de desarrollo
npm run dev
```

---

### ❌ Los estilos de Tailwind no se aplican

**Causa:** Tailwind no está configurado correctamente.

**Verifica:**
1. Archivo `tailwind.config.js` existe
2. Archivo `index.css` contiene:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
3. Reinicia el servidor: `npm run dev`

---

## 🔴 Problemas de Compilación

### ❌ Error: "tsc: command not found"

**Causa:** TypeScript no está instalado globalmente.

**Solución:**
```bash
npm install  # Asegúrate de tener dependencias
npm run build  # Usa la versión local
```

---

### ❌ Error: "vite: command not found"

**Causa:** Vite no está instalado.

**Solución:**
```bash
npm install
npm run build
```

---

### ❌ Build muy lento

**Causas:** 
- Demasiados módulos
- No hay caché de Vite
- Recursos insuficientes

**Soluciones:**
```bash
# Limpiar caché
rm -rf dist .vite node_modules/.vite

# Volver a compilar
npm run build

# Si aún es lento, verifica tu hardware:
# - Aumenta la memoria de Node.js
node --max-old-space-size=4096 ./node_modules/vite/bin/vite.js build
```

---

### ❌ Error: "Max retries exceeded"

**Causa:** Problemas de red durante npm install.

**Solución:**
```bash
npm config set fetch-timeout 120000
npm install
```

---

## 🟠 Problemas de Componentes

### ❌ La ventana no se arrastra correctamente

**Causa:** Evento de mouse no está siendo capturado.

**Solución:**
- Verifica que `Window.tsx` tenga eventos `onMouseDown`
- Abre DevTools y verifica si hay errores de JavaScript
- Recarga la página

---

### ❌ El menú contextual no aparece

**Causa:** Evento `onContextMenu` no está configurado.

**Solución:**
```typescript
<div 
  onContextMenu={(e) => {
    e.preventDefault();
    // Mostrar menú
  }}
>
  Contenido
</div>
```

---

### ❌ Los iconos del escritorio no se muestran

**Causa:** Iconos no importados o mal registrados.

**Verifica:**
```typescript
// En src/constants/apps.tsx
import { FileExplorer24Regular } from '@fluentui/react-icons';

// En desktopIcons:
{
  id: 'file-explorer',
  label: 'Explorador',
  icon: <FileExplorer24Regular />,  // ✅ Correcto
}
```

---

### ❌ El sistema de archivos no funciona

**Causa:** FileSystemContext no está inicializado.

**Solución:**
```typescript
// En App.tsx, asegúrate de tener:
<FileSystemProvider>
  <SettingsProvider>
    <WindowManagerProvider>
      <Desktop />
    </WindowManagerProvider>
  </SettingsProvider>
</FileSystemProvider>
```

---

## 🟡 Problemas de Performance

### La aplicación es lenta

**Diagnóstico:**
1. Abre DevTools (F12)
2. Pestaña "Performance"
3. Graba 10 segundos
4. Analiza el timeline

**Optimizaciones:**
```typescript
// Usa React.memo para componentes costosos
export const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{data}</div>;
});

// Usa useMemo para cálculos costosos
const memoizedValue = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);

// Usa useCallback para funciones
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

---

## 📞 Informar de un Problema

Si no encuentras la solución:

1. **Verifica el repositorio:** ¿Alguien más reportó esto?
2. **Crea un Issue** con:
   - Descripción del problema
   - Pasos para reproducir
   - Salida de error completa
   - Versión de Node.js: `node --version`
   - Sistema operativo (Windows/macOS/Linux)
   - Capturas de pantalla si es necesario

**Ejemplo:**
```
Título: La ventana no se arrastra en Firefox

Descripción:
Cuando intento arrastrar una ventana, no se mueve.

Pasos:
1. Ejecutar `npm run dev`
2. Ir a http://localhost:5173
3. Intentar arrastrar la ventana de Notepad

Error esperado: La ventana debería moverse
Error real: La ventana no se mueve

Información:
- Node: v20.10.0
- npm: 10.2.3
- OS: Windows 11
- Navegador: Firefox 120
```

---

## ✅ Checklist de Depuración

Antes de informar un problema, verifica:

- [ ] Node.js está actualizado: `node --version` (18+)
- [ ] npm está actualizado: `npm --version`
- [ ] `npm install` se ejecutó sin errores
- [ ] `npm run dev` se ejecuta sin errores
- [ ] Limpiaste la caché del navegador (Ctrl+Shift+Del)
- [ ] Reiniciaste el servidor de desarrollo
- [ ] Reiniciaste tu navegador
- [ ] Reiniciaste tu computadora
- [ ] El problema no existe en la rama main

---

¿Aún tienes problemas? Contacta a través de:
- GitHub Issues: [Crear un Issue](https://github.com/tu-usuario/windows/issues)
- Diskord: [Únete al servidor](https://discord.gg/tu-servidor)

¡Gracias por usar WebOS! 🚀
