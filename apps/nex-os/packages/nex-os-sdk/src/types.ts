import type { ComponentType, ReactNode } from 'react';

/** Props bag passed into every windowed app. Specialize with generics on `defineApp`. */
export type NexAppProps = Record<string, unknown>;

/** Declared capabilities — documented now; sandbox enforcement is roadmap. */
export type NexAppPermission =
  | 'windows'
  | 'settings'
  | 'fs'
  | 'desktop'
  | 'ui'
  | 'music'
  | 'notifications';

export type NexAppCategory = 'tools' | 'media' | 'games' | 'dev' | 'social' | 'other';

/**
 * Manifest de una app de NEX OS.
 * Registrala con `defineApp()` / `registerApp()` y el shell la abre como ventana.
 */
export interface NexAppManifest<TProps extends NexAppProps = NexAppProps> {
  /** Id de ventana por defecto (único por escritorio). */
  id: string;
  /** Clave que resuelve AppRegistry (puede coincidir con id). */
  appId: string;
  /** Título en la barra de la ventana / taskbar. */
  title: string;
  /** Icono React (Fluent, SVG, emoji wrapper, etc.). */
  icon: ReactNode;
  /** Componente raíz — ocupa el 100% del área de contenido. */
  component: ComponentType<TProps>;
  /** Alias adicionales (Run dialog, Buscar, etc.). Case-insensitive al resolver. */
  aliases?: string[];
  /** Descripción corta para el catálogo de community apps. */
  description?: string;
  /** Autor / handle del creador. */
  author?: string;
  /** Versión semver informativa. */
  version?: string;
  /** Props por defecto al abrir. */
  defaultProps?: Partial<TProps>;
  /** Mostrar en taskbar aunque esté cerrada. */
  pinToTaskbar?: boolean;
  /** Categoría para filtros / catálogo. */
  category?: NexAppCategory;
  /**
   * Capacidades que la app usa del host.
   * Hoy es contrato documental; el sandbox las aplicará más adelante.
   */
  permissions?: NexAppPermission[];
}

export interface NexLauncherItem {
  id: string;
  appId: string;
  label: string;
  icon: ReactNode;
  isPinned?: boolean;
  description?: string;
  author?: string;
  community?: boolean;
  category?: NexAppCategory;
}

export type RegistryListener = () => void;

/** Signature compatible with the shell `openWindow`. */
export type NexOpenWindowFn = (
  id: string,
  appId: string,
  title: string,
  icon: ReactNode,
  appProps?: NexAppProps,
) => void;

/** Minimal track shape for music-aware community apps. */
export interface NexTrack {
  id: string;
  title: string;
  artist: string;
  cover: string;
  url: string;
  embedUrl?: string;
  service: 'youtube' | 'youtube-music' | 'spotify' | 'local';
  kind?: 'video' | 'playlist';
  videoId?: string;
}
