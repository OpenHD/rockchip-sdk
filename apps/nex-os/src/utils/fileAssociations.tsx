import type { ReactNode } from 'react';
import {
  Document20Regular,
  Image20Regular,
  MusicNote2Regular,
  Code20Regular,
  Globe20Regular,
} from '@fluentui/react-icons';

export type OpenFileTarget = {
  windowId: string;
  appId: string;
  title: string;
  icon: ReactNode;
  appProps?: Record<string, unknown>;
};

type FileLike = {
  id: string;
  name: string;
  ext?: string;
  imageUrl?: string;
  content?: string;
};

/** Map file extension → how to open it in NEX OS. */
export function getOpenTargetsForExt(ext: string | undefined): Array<{
  appId: string;
  label: string;
  icon: ReactNode;
}> {
  const e = (ext || '').toLowerCase();
  switch (e) {
    case 'txt':
    case 'md':
    case 'log':
    case 'json':
    case 'csv':
      return [
        { appId: 'notepad', label: 'Bloc de notas', icon: <Document20Regular /> },
        { appId: 'wordpad', label: 'WordPad', icon: <Document20Regular /> },
        { appId: 'vscode', label: 'NEX Code', icon: <Code20Regular /> },
      ];
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'bmp':
      return [
        { appId: 'image-viewer', label: 'Visor de fotos', icon: <Image20Regular /> },
        { appId: 'photos', label: 'Fotos', icon: <Image20Regular /> },
        { appId: 'paint', label: 'Paint', icon: <Image20Regular /> },
      ];
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'm4a':
    case 'flac':
      return [
        { appId: 'mediaplayer', label: 'Reproductor', icon: <MusicNote2Regular /> },
        { appId: 'spotify', label: 'Spotify', icon: <MusicNote2Regular /> },
        { appId: 'virtual-dj', label: 'NEX DJ', icon: <MusicNote2Regular /> },
      ];
    case 'html':
    case 'htm':
      return [
        { appId: 'chrome', label: 'Google Chrome', icon: <Globe20Regular /> },
        { appId: 'ie', label: 'Internet Explorer', icon: <Globe20Regular /> },
        { appId: 'notepad', label: 'Bloc de notas', icon: <Document20Regular /> },
      ];
    case 'js':
    case 'ts':
    case 'tsx':
    case 'jsx':
    case 'css':
    case 'py':
    case 'c':
    case 'cpp':
    case 'h':
      return [
        { appId: 'vscode', label: 'NEX Code', icon: <Code20Regular /> },
        { appId: 'notepad', label: 'Bloc de notas', icon: <Document20Regular /> },
        { appId: 'devcpp-2026', label: 'Dev-C++ 2026', icon: <Code20Regular /> },
      ];
    default:
      return [
        { appId: 'notepad', label: 'Bloc de notas', icon: <Document20Regular /> },
        { appId: 'vscode', label: 'NEX Code', icon: <Code20Regular /> },
      ];
  }
}

export function buildOpenTarget(item: FileLike, appId: string): OpenFileTarget {
  const e = (item.ext || '').toLowerCase();
  const targets = getOpenTargetsForExt(e);
  const match = targets.find((t) => t.appId === appId) || targets[0];
  const icon = match?.icon ?? <Document20Regular />;

  if (appId === 'image-viewer' || appId === 'photos') {
    return {
      windowId: `${appId}-${item.id}`,
      appId: appId === 'photos' ? 'photos' : 'image-viewer',
      title: `${match?.label || 'Fotos'} - ${item.name}`,
      icon,
      appProps: {
        files: [{ name: item.name, imageUrl: item.imageUrl }],
        initialIndex: 0,
      },
    };
  }

  if (appId === 'mediaplayer' || appId === 'spotify' || appId === 'virtual-dj') {
    return {
      windowId: `${appId}-${item.id}`,
      appId,
      title: item.name,
      icon,
      appProps: {
        fileId: item.id,
        fileName: item.name,
        sourceUrl: item.imageUrl,
      },
    };
  }

  if (appId === 'chrome' || appId === 'ie') {
    return {
      windowId: `${appId}-${item.id}`,
      appId,
      title: item.name,
      icon,
      appProps: { initialUrl: item.content || `nex://files/${item.id}` },
    };
  }

  return {
    windowId: `${appId}-${item.id}`,
    appId,
    title: item.name,
    icon,
    appProps: { fileId: item.id },
  };
}

/** Default open for a file (first association). */
export function resolveDefaultOpen(item: FileLike): OpenFileTarget | null {
  const e = (item.ext || '').toLowerCase();
  if (!e || e === 'nex') return null;
  const targets = getOpenTargetsForExt(e);
  if (!targets.length) return null;
  return buildOpenTarget(item, targets[0].appId);
}
