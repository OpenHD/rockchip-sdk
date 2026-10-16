# ⚡ Guía Rápida - WebOS

Una referencia rápida para desarrolladores que quieren empezar inmediatamente.

---

## 🚀 Setup en 5 Minutos

```bash
# 1. Clonar
git clone https://github.com/tu-usuario/windows.git && cd windows

# 2. Instalar
npm install

# 3. Ejecutar
npm run dev

# ¡Listo! Abre http://localhost:5173
```

---

## 📚 Documentación Principal

> **Sitio web (estilo docs):** abrí [`/docs`](/docs) con `vercel dev` o tras el deploy.

| Documento | Qué Es | Cuándo Leerlo |
|-----------|--------|-------------|
| [Sitio /docs](/docs) | Docs interactivas NEX OS + SDK | Primero |
| [README.md](../README.md) | Descripción general | Primero |
| [INSTALLATION.md](./INSTALLATION.md) | Setup detallado | Si tienes problemas |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Cómo desarrollar | Antes de empezar |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Dónde está todo | Cuando necesites encontrar algo |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Cómo funciona | Para entender el diseño |
| [API_REFERENCE.md](./API_REFERENCE.md) | Qué hooks usar | Cuando desarrolles apps |
| [WASM_BRIDGE.md](./WASM_BRIDGE.md) | Cómo usar WASM | Para operaciones intensivas |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Solucionar problemas | Cuando algo no funciona |

---

## 🎯 Tareas Comunes

### Agregar una Nueva Aplicación

```bash
# 1. Crear archivo
touch src/components/apps/MiApp.tsx

# 2. Copiar template
```

```typescript
// src/components/apps/MiApp.tsx
import React from 'react';

interface MiAppProps {
  id: string;
}

export const MiApp: React.FC<MiAppProps> = ({ id }) => {
  return <div className="bg-white p-4">Mi App</div>;
};
```

```bash
# 3. Registrar en WindowManager.tsx
# (Ver DEVELOPMENT.md para detalles)

# 4. Probar
npm run dev
```

---

### Arreglar un Bug

```bash
# 1. Crear rama
git checkout -b fix/mi-bug

# 2. Hacer cambios
# ... edita archivos ...

# 3. Verificar
npm run lint
npm run build

# 4. Hacer commit
git add .
git commit -m "fix: descripción del bug"

# 5. Push
git push origin fix/mi-bug

# 6. Crear Pull Request en GitHub
```

---

### Optimizar Performance

```typescript
// Usar React.memo
export const MyComponent = React.memo(({ data }) => {
  return <div>{data}</div>;
});

// Usar useMemo
const expensive = useMemo(() => {
  return heavyCalculation(data);
}, [data]);

// Usar useCallback
const handler = useCallback(() => {
  doSomething();
}, []);

// Considerar WASM para cálculos intensivos
// Ver WASM_BRIDGE.md
```

---

## 🔥 Comandos Esenciales

```bash
npm run dev            # Iniciar desarrollo
npm run build          # Compilar producción
npm run lint           # Verificar código
npm run asbuild        # Compilar WASM
npm run preview        # Preview del build
```

---

## 🧠 Conceptos Clave

### Contextos (Global State)

```typescript
// Usar estado global
import { useWindowManager } from '../context/WindowManager';

const { openWindow, closeWindow } = useWindowManager();
```

### Componentes (UI)

```typescript
// Componente de ejemplo
export const MyComponent: React.FC<Props> = (props) => {
  return <div>{props.title}</div>;
};
```

### Hooks (Lógica Reutilizable)

```typescript
// Hook personalizado
const useMyLogic = () => {
  const [state, setState] = useState(false);
  return { state, setState };
};
```

---

## 📁 Dónde Encontrar Cosas

| Necesito | Archivo | Ubicación |
|----------|---------|-----------|
| Agregar app | MiApp.tsx | `src/components/apps/` |
| Agregar hook | myHook.ts | `src/hooks/` |
| Agregar contexto | MyContext.tsx | `src/context/` |
| Agregar utilidad | myUtil.ts | `src/utils/` |
| Agregar ícono | - | @fluentui/react-icons |
| WASM | index.ts | `assembly/` |

---

## 🎨 Estilos

### Tailwind (Preferido)

```typescript
<div className="bg-white p-4 rounded-lg shadow-lg hover:shadow-xl">
  Contenido
</div>
```

### CSS Personalizado

```typescript
import styles from './MyComponent.module.css';

<div className={styles.customStyle}>
  Contenido
</div>
```

---

## 🐞 Debug Rápido

```typescript
// Log simple
console.log('Mi valor:', data);

// Medir tiempo
console.time('myTimer');
// ... código ...
console.timeEnd('myTimer');

// DevTools de React
// Instala React Developer Tools
```

---

## ❓ Preguntas Frecuentes

**¿Cómo inicio el servidor?**
```bash
npm run dev
```

**¿Cómo compilo para producción?**
```bash
npm run build
```

**¿Dónde agrego una app?**
`src/components/apps/`

**¿Cómo obtengo acceso a contextos?**
```typescript
const ctx = useWindowManager();  // O similar
```

**¿Qué es WASM?**
Ver [WASM_BRIDGE.md](./WASM_BRIDGE.md)

**¿Algo no funciona?**
Ver [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

**¿Cómo contribuyo?**
Ver [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## 🎓 Recursos

- [React Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)

---

## 🚦 Flujo de Contribución

```
Fork → Clone → Branch → Code → Lint → Build → Commit → Push → PR
```

Detalles en [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## 📞 Soporte

- **Issues:** [GitHub Issues](https://github.com/tu-usuario/windows/issues)
- **Discussions:** [GitHub Discussions](https://github.com/tu-usuario/windows/discussions)
- **Documentación:** Carpeta `docs/`

---

## 🎯 Próximos Pasos

1. **Lee** [DEVELOPMENT.md](./DEVELOPMENT.md)
2. **Entiende** [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Crea** tu primera aplicación
4. **Contribuye** al proyecto

---

¡Bienvenido a WebOS! 🚀
