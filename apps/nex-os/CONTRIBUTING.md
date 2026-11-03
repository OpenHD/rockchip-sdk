# 🤝 Guía de Contribución a WebOS

¡Gracias por tu interés en mejorar WebOS! Este proyecto busca empujar los límites de lo que es posible en la web, y tu ayuda es invaluable.

---

## 📋 Antes de Comenzar

- Lee el [README.md](./README.md) para entender el proyecto
- Consulta [DEVELOPMENT.md](./docs/DEVELOPMENT.md) para configurar tu entorno
- Revisa los [Issues Abiertos](https://github.com/tu-usuario/windows/issues) para no duplicar trabajo

---

## 🚀 Cómo Empezar

### 1. Fork el Repositorio

En GitHub:
1. Click en el botón "Fork" en la esquina superior derecha
2. Esto crea una copia del repositorio en tu cuenta

### 2. Clonar tu Fork

```bash
git clone https://github.com/TU_USUARIO/windows.git
cd windows
```

### 3. Agregar el Repositorio Original como Remote

```bash
git remote add upstream https://github.com/USUARIO_ORIGINAL/windows.git
```

### 4. Crear una Rama para tu Característica

```bash
# Asegúrate de estar en main
git checkout main
git pull upstream main

# Crea tu rama
git checkout -b feature/nombre-de-tu-caracteristica
```

### 5. Instalación de Dependencias

```bash
npm install
npm run asbuild  # Si necesitas compilar WASM
npm run dev      # Inicia servidor de desarrollo
```

---

## 🛠️ Estándares de Código

### TypeScript Estricto

**No uses `any`:**
```typescript
// ❌ EVITA
const data: any = await fetchData();

// ✅ USA
interface User {
  id: number;
  name: string;
}
const data: User = await fetchData();
```

### Componentes Atómicos

Separa lógica de negocio de la UI:

```typescript
// ✅ BIEN: Custom Hook
export const useTaskData = () => {
  const [tasks, setTasks] = useState([]);
  // Lógica aquí
  return { tasks, addTask };
};

// ✅ BIEN: Componente UI
export const TaskList: React.FC = () => {
  const { tasks, addTask } = useTaskData();
  return <div>{/* UI aquí */}</div>;
};
```

### Diseño Fluent/Windows 11

```typescript
// ✅ USA:
// - Tokens de color definidos en tailwind.config.js
// - backdrop-blur para efectos de cristal
// - Bordes sutiles y sombras
// - @fluentui/react-icons para iconografía

<div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-lg shadow-lg p-4">
  Contenido
</div>
```

### Iconografía

Preferimos Fluent UI para consistencia con Windows 11:

```typescript
// ✅ PREFERIDO
import { FileExplorer24Regular } from '@fluentui/react-icons';

// ⚠️ TAMBIÉN OK
import { Zap } from 'lucide-react';
```

### Estilos

```typescript
// ✅ USA Tailwind para layout rápido
<div className="flex items-center justify-between p-4 gap-2">

// ✅ USA Custom CSS para efectos avanzados
import styles from './MyComponent.module.css';
<div className={styles.glassEffect}>

// ❌ EVITA
<div style={{ backgroundColor: 'blue', padding: '16px' }}>
```

---

## 🔌 Cómo Agregar una Nueva Aplicación

### Paso 1: Crear el Componente

```bash
touch src/components/apps/MiApp.tsx
```

```typescript
// src/components/apps/MiApp.tsx
import React from 'react';
import { FileText24Regular } from '@fluentui/react-icons';

interface MiAppProps {
  id: string;
}

export const MiApp: React.FC<MiAppProps> = ({ id }) => {
  return (
    <div className="bg-white p-4 rounded-lg">
      <h1 className="text-lg font-semibold">Mi Aplicación</h1>
      {/* Contenido de tu app */}
    </div>
  );
};
```

### Paso 2: Registrar en el Sistema

```typescript
// src/constants/apps.tsx
import { MiApp } from '../components/apps/MiApp';
import { FileText24Regular } from '@fluentui/react-icons';

export const APPS = [
  // ... apps existentes
  {
    id: 'mi-app',
    name: 'Mi Aplicación',
    description: 'Una aplicación increíble',
    icon: <FileText24Regular />,
    component: MiApp,
  },
];
```

### Paso 3: Agregar al Gestor de Ventanas

```typescript
// src/context/WindowManager.tsx
import { MiApp } from '../components/apps/MiApp';

const initialDesktopIcons = [
  // ... iconos existentes
  {
    id: 'mi-app',
    label: 'Mi App',
    icon: <MiAppIcon />,
    component: MiApp,
  },
];
```

---

## ⚡ WebAssembly (WASM)

Si tu aplicación necesita procesamiento pesado, considera mover la lógica a AssemblyScript.

### Editar AssemblyScript

```typescript
// assembly/index.ts
export function myHeavyCalculation(input: f64): f64 {
  // Cálculo intensivo que se ejecuta a velocidad nativa
  return input * 2.0;
}
```

### Compilar

```bash
npm run asbuild
```

### Usar en tu Componente

```typescript
// Tu componente
import { myHeavyCalculation } from '../wasm';

const result = myHeavyCalculation(100.0);
```

---

## 🧪 Testing y Verificación

### Lint de Código

```bash
npm run lint
npm run lint -- --fix  # Auto-corregir
```

### Compilación TypeScript

```bash
npm run build
```

### Verificación Completa

```bash
npm run lint
npm run build
npm run dev  # Prueba manualmente
```

---

## 🐞 Reportar Errores

### Cómo Reportar

1. Abre un [Issue](https://github.com/tu-usuario/windows/issues)
2. Usa el template de "Bug Report"
3. Incluye:
   - Descripción clara del problema
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Capturas de pantalla si es relevante
   - Información del sistema (OS, navegador, versión de Node)

### Ejemplo

```
Título: Las ventanas no se minimizan correctamente en Safari

Descripción:
Cuando hago click en el botón de minimizar, la ventana no desaparece de la pantalla.

Pasos para reproducir:
1. Abrir WebOS
2. Abrir la aplicación de Notepad
3. Click en botón de minimizar

Esperado: La ventana debe desaparecer y aparecer en la barra de tareas
Actual: La ventana sigue visible en el escritorio

Sistema:
- macOS 13.5
- Safari 16.5
- Node.js 20.0.0
```

---

## 📝 Git Workflow

### Naming de Ramas

```
feature/nombre-caracteristica   # Nueva característica
fix/nombre-del-bug              # Corrección de bug
docs/nombre-documento           # Documentación
refactor/nombre-del-cambio      # Refactorización
```

### Commits

Usa mensajes descriptivos:

```bash
# ✅ BIEN
git commit -m "feat: agregar aplicación de calculadora"
git commit -m "fix: corregir arrastre de ventanas en Safari"
git commit -m "docs: mejorar guía de instalación"
git commit -m "refactor: optimizar WindowManager"

# ❌ EVITA
git commit -m "fix stuff"
git commit -m "updated"
git commit -m "asdf"
```

### Push de Cambios

```bash
git push origin feature/mi-caracteristica
```

### Crear Pull Request

1. En tu repositorio en GitHub, ve a "Pull Requests"
2. Click en "New Pull Request"
3. Selecciona:
   - **Base:** upstream/main
   - **Compare:** tu rama
4. Rellena el template
5. Click en "Create Pull Request"

---

## 💬 Pull Request Template

```markdown
## Descripción
Describe brevemente qué cambios hace este PR.

## Tipo de Cambio
- [ ] Bug fix
- [ ] Nueva característica
- [ ] Mejora de documentación
- [ ] Refactorización
- [ ] Optimización de performance

## Cambios
- [ ] Cambio 1
- [ ] Cambio 2
- [ ] Cambio 3

## Testing
- [ ] Probado en Chrome
- [ ] Probado en Firefox
- [ ] Probado en Safari
- [ ] Probado en Mobile

## Screenshots (si aplica)
Adjunta capturas de pantalla de los cambios visuales.

## Checklist
- [ ] Mi código sigue los estándares del proyecto
- [ ] He actualizado la documentación si es necesario
- [ ] Mi código no genera warnings
- [ ] He testeado manualmente mis cambios
```

---

## 🔄 Proceso de Revisión

1. **Revisión Automática**
   - ESLint verifica el código
   - TypeScript compila correctamente
   - Build funciona

2. **Revisión Humana**
   - Los mantenedores revisan tu código
   - Pueden sugerir cambios
   - Comenta en los cambios sugeridos

3. **Aprobación y Merge**
   - Una vez aprobado, el PR se fusiona a main
   - ¡Felicidades! Tu contribución está en vivo

---

## 🎯 Tipos de Contribuciones

### 🆕 Nuevas Características

- Asegúrate de que sea compatible con el diseño actual
- Sigue los estándares de código
- Incluye documentación

### 🐛 Correcciones de Bugs

- Sé específico con la descripción
- Incluye pasos para reproducir
- Agrega tests si es posible

### 📚 Documentación

- Asegúrate de que sea clara y precisa
- Usa ejemplos cuando sea necesario
- Mantén la estructura existente

### ♻️ Refactorización

- Mantén el mismo comportamiento
- Mejora la legibilidad o rendimiento
- Incluye razón del cambio

---

## 📚 Documentación Útil

- [README.md](./README.md) - Descripción del proyecto
- [SDK.md](./docs/SDK.md) - Crear community apps con `@nex-os/sdk`
- [DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Guía de desarrollo
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Arquitectura del sistema
- [PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md) - Estructura de carpetas
- [API_REFERENCE.md](./docs/API_REFERENCE.md) - Referencia de APIs
- [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) - Solución de problemas

---

## ❓ Preguntas Frecuentes

**¿Puedo empezar a trabajar en cualquier característica?**
Sí, pero revisa los Issues abiertos primero. Si alguien ya está trabajando, comunícalo en el Issue.

**¿Cuánto tiempo tarda el review?**
Típicamente 2-5 días, dependiendo de la complejidad.

**¿Qué pasa si mi PR es rechazado?**
No te preocupes, solicita cambios y vuelve a enviar.

**¿Cómo me contactan después de mi contribución?**
A través del comentario en tu PR.

---

## 🎉 ¡Gracias!

Tu contribución ayuda a hacer WebOS mejor para todos. ¡Esperamos tu Pull Request! 🚀

Si tienes más preguntas, abre una [Discussion](https://github.com/tu-usuario/windows/discussions).
