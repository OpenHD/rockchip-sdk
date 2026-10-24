import { useCallback, useEffect, useState } from 'react';

/** Rutas del panel en el hash (#/c/<empresa>/<sección>?f=<filtro>&d=<equipo>): el botón "atrás" funciona. */
export type CompanySection = 'resumen' | 'equipos' | 'apps' | 'marca' | 'avisos' | 'miembros' | 'auditoria';
export type NexSection = 'nueva-empresa' | 'catalogo' | 'pirateria';

export type Route =
  | { scope: 'company'; companyId: string; section: CompanySection; filter?: string; device?: string }
  | { scope: 'nex'; section: NexSection }
  | { scope: 'home' };

const COMPANY_SECTIONS: CompanySection[] = ['resumen', 'equipos', 'apps', 'marca', 'avisos', 'miembros', 'auditoria'];
const NEX_SECTIONS: NexSection[] = ['nueva-empresa', 'catalogo', 'pirateria'];

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] === 'c' && parts[1]) {
    const section = COMPANY_SECTIONS.find((s) => s === parts[2]) ?? 'resumen';
    return { scope: 'company', companyId: parts[1], section, filter: params.get('f') ?? undefined, device: params.get('d') ?? undefined };
  }
  if (parts[0] === 'nex') {
    const section = NEX_SECTIONS.find((s) => s === parts[1]);
    if (section) return { scope: 'nex', section };
  }
  return { scope: 'home' };
}

export function formatRoute(r: Route): string {
  if (r.scope === 'company') {
    const q = new URLSearchParams();
    if (r.filter) q.set('f', r.filter);
    if (r.device) q.set('d', r.device);
    const qs = q.toString();
    return `#/c/${r.companyId}/${r.section}${qs ? `?${qs}` : ''}`;
  }
  if (r.scope === 'nex') return `#/nex/${r.section}`;
  return '#/';
}

export function useRoute(): [Route, (r: Route, replace?: boolean) => void] {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = useCallback((r: Route, replace = false) => {
    const hash = formatRoute(r);
    if (replace) window.history.replaceState(null, '', hash);
    else window.history.pushState(null, '', hash);
    setRoute(r);
  }, []);
  return [route, navigate];
}

/** Código de vinculación que llega por el QR del TV (?claim=XXXX). Se lee una vez y se quita de la URL. */
export function takeClaimParam(): string | undefined {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('claim');
  if (!code) return undefined;
  url.searchParams.delete('claim');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return /^[A-Za-z0-9-]{8,9}$/.test(code) ? code.toUpperCase() : undefined;
}
