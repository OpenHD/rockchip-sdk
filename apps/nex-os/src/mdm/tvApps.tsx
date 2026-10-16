import React, { Suspense, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Apps internas que pueden mostrarse en modo TV. Terminal, navegador libre, NEX Code, ajustes, etc. nunca.
 * Solo las que andan sin internet y sin el escritorio: el filtro DNS bloquea lo que usan
 * reproductor/Spotify/fotos (youtube, i.ytimg, scdn, unsplash), el visor de imágenes no tiene
 * archivos y Juegos abre ventanas del escritorio, que en el TV no existe.
 * Registro propio (no AppRegistry): el build del TV no arrastra las ~30 apps del escritorio.
 */
const Calculator = React.lazy(() => import('../components/apps/Calculator'));
const Clock = React.lazy(() => import('../components/apps/Clock'));
const Calendar = React.lazy(() => import('../components/apps/Calendar'));
const Tetris = React.lazy(() => import('../components/apps/Tetris'));

const TV_APPS: Record<string, LazyExoticComponent<ComponentType>> = {
  calculator: Calculator,
  clock: Clock,
  calendar: Calendar,
  tetris: Tetris,
  'nex-tetris': Tetris,
};

export function isTvApp(id: string): boolean {
  return Object.hasOwn(TV_APPS, id);
}

export function TvApp({ appId }: { appId: string }) {
  const App = Object.hasOwn(TV_APPS, appId) ? TV_APPS[appId] : null;
  if (!App) return null;
  return (
    <Suspense fallback={<div className="w-full h-full bg-black" aria-hidden />}>
      <App />
    </Suspense>
  );
}
