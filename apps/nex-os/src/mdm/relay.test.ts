import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidPsk, relayErrorText, sendRelay } from './relay';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(body === undefined ? '' : JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('sendRelay', () => {
  it('manda JSON por POST al CGI (Content-Type obligatorio)', async () => {
    const fetchMock = stubFetch(202, { ok: true });
    await expect(sendRelay({ action: 'wifi_scan' })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/cgi-bin/nex');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ action: 'wifi_scan' });
  });

  it('devuelve el código de error del CGI', async () => {
    stubFetch(400, { ok: false, error: 'invalid' });
    await expect(sendRelay({ action: 'unlock_code', code: '12345678' })).resolves.toEqual({ ok: false, error: 'invalid' });
  });

  it('429 sin cuerpo → rate_limited', async () => {
    stubFetch(429, undefined);
    await expect(sendRelay({ action: 'wifi_scan' })).resolves.toEqual({ ok: false, error: 'rate_limited' });
  });

  it('error de red → network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(sendRelay({ action: 'wifi_scan' })).resolves.toEqual({ ok: false, error: 'network' });
  });

  it('no manda pedidos de más de 1 KB', async () => {
    const fetchMock = stubFetch(202, { ok: true });
    await expect(sendRelay({ action: 'wifi_connect', ssid: 'x'.repeat(2000), psk: '' })).resolves.toEqual({
      ok: false,
      error: 'too_large',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('isValidPsk', () => {
  it.each([
    ['', true],
    ['12345678', true],
    ['clave con espacios', true],
    ['x'.repeat(63), true],
    ['corta', false],
    ['x'.repeat(64), false],
    ['contraseña', false],
    ['linea\nnueva', false],
  ])('%j → %s', (psk, ok) => {
    expect(isValidPsk(psk)).toBe(ok);
  });
});

describe('relayErrorText', () => {
  it('traduce los códigos del CGI', () => {
    expect(relayErrorText('agent')).toMatch(/iniciando/);
    expect(relayErrorText('invalid')).toMatch(/inválidos/);
  });
  it('código desconocido: genérico y acotado', () => {
    expect(relayErrorText('x'.repeat(100))).toBe(`El equipo rechazó el pedido (${'x'.repeat(40)}).`);
  });
});
