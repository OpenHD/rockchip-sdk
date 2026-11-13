import { describe, expect, it, vi } from 'vitest';
import type { MdmApp, MdmNotice } from './agentState';
import { orderDock, tileGradient } from './dock';
import { activeNotices, formatUntil, noticeLabel, noticeSeenUrl, sendNoticeSeen, splitNotices } from './notices';

const NOW = 1_800_000_000;

function notice(id: string, severity: MdmNotice['severity'], extra: Partial<MdmNotice> = {}): MdmNotice {
  return { id, title: `Aviso ${id}`, body: '', category: 'general', severity, expiresAt: NOW + 3600, ...extra };
}

describe('activeNotices', () => {
  const list = [notice('a', 'info'), notice('b', 'emergencia'), notice('c', 'importante'), notice('d', 'emergencia')];

  it('ordena por gravedad sin cambiar el orden dentro de cada una', () => {
    expect(activeNotices(list, [], NOW).map((n) => n.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('saca los que el usuario ya cerró', () => {
    expect(activeNotices(list, ['b', 'a'], NOW).map((n) => n.id)).toEqual(['d', 'c']);
  });

  it('saca los vencidos (el instante exacto del vencimiento ya no cuenta)', () => {
    const mixed = [notice('a', 'info', { expiresAt: NOW }), notice('b', 'info', { expiresAt: NOW - 1 }), notice('c', 'info', { expiresAt: NOW + 1 })];
    expect(activeNotices(mixed, [], NOW).map((n) => n.id)).toEqual(['c']);
  });

  it('no modifica la lista original', () => {
    const copy = [...list];
    activeNotices(list, [], NOW);
    expect(list).toEqual(copy);
  });
});

describe('splitNotices', () => {
  it('sin avisos', () => {
    expect(splitNotices([])).toEqual({ emergency: null, emergencyCount: 0, banner: null, bannerCount: 0 });
  });

  it('separa la emergencia del aviso del inicio', () => {
    const view = splitNotices(activeNotices([notice('a', 'info'), notice('b', 'emergencia'), notice('c', 'importante'), notice('d', 'emergencia')], [], NOW));
    expect(view.emergency?.id).toBe('b');
    expect(view.emergencyCount).toBe(2);
    expect(view.banner?.id).toBe('c');
    expect(view.bannerCount).toBe(2);
  });

  it('una emergencia nunca es el aviso del inicio', () => {
    expect(splitNotices([notice('b', 'emergencia')]).banner).toBeNull();
  });
});

describe('noticeLabel', () => {
  it('une gravedad y categoría', () => {
    expect(noticeLabel({ severity: 'emergencia', category: 'salud' })).toBe('Emergencia · Salud');
    expect(noticeLabel({ severity: 'importante', category: 'corte' })).toBe('Aviso importante · Corte de servicio');
  });

  it('la categoría general no se nombra', () => {
    expect(noticeLabel({ severity: 'info', category: 'general' })).toBe('Aviso');
  });
});

describe('aviso de leído', () => {
  const ID = '3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b5c';
  const ok = (body: unknown, httpOk = true) => ({ ok: httpOk, json: async () => body });

  it('arma la URL con id y token codificados', () => {
    expect(noticeSeenUrl(ID, 'a b&c')).toBe(`/agent/notice/seen?id=${ID}&token=a%20b%26c`);
    expect(noticeSeenUrl(ID, null)).toBe(`/agent/notice/seen?id=${ID}&token=`);
  });

  it('una respuesta {"ok":true} alcanza', async () => {
    const fetcher = vi.fn(async () => ok({ ok: true }));
    expect(await sendNoticeSeen(ID, 't', fetcher, 4, 0)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(noticeSeenUrl(ID, 't'), { cache: 'no-store' });
  });

  it('reintenta ante error de red, HTTP o respuesta sin ok', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValueOnce(ok({ ok: true }, false))
      .mockResolvedValueOnce(ok({ ok: false }))
      .mockResolvedValueOnce(ok({ ok: true }));
    expect(await sendNoticeSeen(ID, 't', fetcher, 4, 0)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('se rinde después de los intentos indicados', async () => {
    const fetcher = vi.fn(async () => ok(null));
    expect(await sendNoticeSeen(ID, 't', fetcher, 3, 0)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe('formatUntil', () => {
  it('mismo día → "hoy a las"', () => {
    const now = new Date(2026, 10, 12, 9, 0);
    const until = new Date(2026, 10, 12, 18, 30).getTime() / 1000;
    expect(formatUntil(until, now)).toMatch(/^hoy a las \d{1,2}:30/);
  });

  it('otro día → fecha y hora', () => {
    const now = new Date(2026, 10, 12, 9, 0);
    const until = new Date(2026, 10, 14, 18, 30).getTime() / 1000;
    expect(formatUntil(until, now)).toMatch(/^el 14 de noviembre a las \d{1,2}:30/);
  });
});

describe('dock', () => {
  const app = (id: string, install: boolean): MdmApp => ({ id, name: id, kind: 'web', launch_url: 'https://x.example/', icon: null, install });

  it('las apps por instalar van después de las instaladas, sin cambiar el orden interno', () => {
    const apps = [app('play:a', true), app('android:b', false), app('play:c', true), app('android:d', false)];
    expect(orderDock(apps).map((a) => a.id)).toEqual(['android:b', 'android:d', 'play:a', 'play:c']);
  });

  it('el color del mosaico es estable y es un degradado válido', () => {
    expect(tileGradient('play:com.disney.disneyplus')).toBe(tileGradient('play:com.disney.disneyplus'));
    expect(tileGradient('')).toMatch(/^linear-gradient\(135deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
    const seeds = ['play:com.netflix.ninja', 'play:com.disney.disneyplus', 'play:com.spotify.tv.android', 'play:com.amazon.amazonvideo.livingroom', 'play:tv.pluto.android', 'play:com.google.android.youtube.tv'];
    expect(new Set(seeds.map(tileGradient)).size).toBeGreaterThan(2);
  });
});
