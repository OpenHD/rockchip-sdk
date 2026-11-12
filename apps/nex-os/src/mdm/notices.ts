import { useCallback, useEffect, useMemo, useState } from 'react';
import { NOTICE_SEVERITIES, type MdmNotice, type MdmState, type NoticeCategory, type NoticeSeverity } from './agentState';

/**
 * Lógica de los avisos de la empresa (sin interfaz): cuáles se muestran, en qué orden,
 * y el aviso de "leído" al agente. La parte visual está en NoticeViews.tsx.
 */

const SEEN_URL = '/agent/notice/seen';

export const CATEGORY_LABEL: Record<NoticeCategory, string | null> = {
  corte: 'Corte de servicio',
  clima: 'Clima',
  salud: 'Salud',
  municipal: 'Municipio',
  // "General" no agrega información: se muestra solo la gravedad.
  general: null,
};

export const SEVERITY_LABEL: Record<NoticeSeverity, string> = {
  emergencia: 'Emergencia',
  importante: 'Aviso importante',
  info: 'Aviso',
};

/** Encabezado del aviso: "Emergencia · Salud", "Aviso importante · Corte de servicio", "Aviso". */
export function noticeLabel(notice: Pick<MdmNotice, 'category' | 'severity'>): string {
  const category = CATEGORY_LABEL[notice.category];
  return category ? `${SEVERITY_LABEL[notice.severity]} · ${category}` : SEVERITY_LABEL[notice.severity];
}

/** Avisos vigentes que el usuario no cerró en esta sesión, del más grave al más leve. */
export function activeNotices(notices: readonly MdmNotice[], hidden: readonly string[], nowSec: number): MdmNotice[] {
  const rank = (n: MdmNotice) => NOTICE_SEVERITIES.indexOf(n.severity);
  return notices
    .filter((n) => n.expiresAt > nowSec && !hidden.includes(n.id))
    .map((n, i) => ({ n, i }))
    .sort((a, b) => rank(b.n) - rank(a.n) || a.i - b.i)
    .map((x) => x.n);
}

export interface NoticeView {
  /** Emergencia a mostrar ahora, en pantalla completa y en cualquier modo del equipo. */
  emergency: MdmNotice | null;
  /** Emergencias pendientes, contando la que se muestra. */
  emergencyCount: number;
  /** Aviso del inicio (el más grave que no es emergencia). */
  banner: MdmNotice | null;
  /** Avisos del inicio pendientes, contando el que se muestra. */
  bannerCount: number;
}

export function splitNotices(active: readonly MdmNotice[]): NoticeView {
  const emergencies = active.filter((n) => n.severity === 'emergencia');
  const rest = active.filter((n) => n.severity !== 'emergencia');
  return {
    emergency: emergencies[0] ?? null,
    emergencyCount: emergencies.length,
    banner: rest[0] ?? null,
    bannerCount: rest.length,
  };
}

export function noticeSeenUrl(id: string, token: string | null): string {
  return `${SEEN_URL}?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token ?? '')}`;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

/**
 * Avisa al agente que el aviso se leyó. Reintenta ante un fallo: si nunca llega,
 * el agente lo sigue publicando y vuelve a aparecer cuando la interfaz se recarga.
 */
export async function sendNoticeSeen(
  id: string,
  token: string | null,
  fetcher: Fetcher = (url, init) => fetch(url, init),
  attempts = 4,
  waitMs = 5000,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetcher(noticeSeenUrl(id, token), { cache: 'no-store' });
      if (res.ok) {
        const data: unknown = await res.json();
        if (data && typeof data === 'object' && (data as { ok?: unknown }).ok === true) return true;
      }
    } catch {
      // Sin respuesta del agente: se reintenta.
    }
    if (i < attempts - 1 && waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return false;
}

/** "hoy a las 18:00" o "el 14 de noviembre a las 18:00". */
export function formatUntil(expiresAt: number, now: Date): string {
  const date = new Date(expiresAt * 1000);
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return `hoy a las ${time}`;
  return `el ${date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} a las ${time}`;
}

/** Avisos a mostrar y la acción de marcarlos como leídos. */
export function useNotices(state: MdmState): NoticeView & { now: number; ack: (id: string) => void } {
  // Se ocultan apenas el usuario los cierra, sin esperar a que el agente los quite.
  const [hidden, setHidden] = useState<readonly string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const token = state.wifiToken;
  const ack = useCallback((id: string) => {
    setHidden((prev) => (prev.includes(id) ? prev : [...prev, id]));
    void sendNoticeSeen(id, token);
  }, [token]);

  const view = useMemo(
    () => splitNotices(activeNotices(state.notices, hidden, now / 1000)),
    [state.notices, hidden, now],
  );
  return { ...view, now, ack };
}
