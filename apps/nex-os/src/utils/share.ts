export type ShareResult = 'native' | 'whatsapp' | 'clipboard' | 'cancelled';

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export function appOrigin(): string {
  if (typeof window === 'undefined') return 'https://anex-os.vercel.app';
  return window.location.origin;
}

/** Public share URLs go through /share for OG previews, then redirect into the app. */
export function buildViralShareUrl(params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `${appOrigin()}/share?${q.toString()}`;
}

export function buildRoomInviteUrl(roomCode: string): string {
  return buildViralShareUrl({ room: roomCode.toUpperCase() });
}

export function buildCloudPlaylistShareUrl(cloudId: string): string {
  return buildViralShareUrl({ cloud: cloudId });
}

export function buildNexMusicHomeUrl(): string {
  return `${appOrigin()}/nex-music`;
}

export async function shareOrCopy(payload: SharePayload): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return 'native';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    }
  }

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (isMobile) {
    const wa = `https://wa.me/?text=${encodeURIComponent(`${payload.text}\n${payload.url}`)}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
    return 'whatsapp';
  }

  try {
    await navigator.clipboard.writeText(payload.url);
    return 'clipboard';
  } catch {
    // last resort
    window.prompt('Copiá el enlace:', payload.url);
    return 'clipboard';
  }
}

export function shareResultToast(result: ShareResult): string | null {
  if (result === 'native' || result === 'whatsapp') return 'Listo para compartir 🚀';
  if (result === 'clipboard') return 'Enlace copiado al portapapeles 🚀';
  return null;
}
