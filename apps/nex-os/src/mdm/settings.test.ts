import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, networkSummary, parseAppearance, versionLabel } from './settings';

describe('parseAppearance', () => {
  it.each([null, '', 'x', '42', 'null', '[]'])('entrada inválida %j → valores por defecto', (raw) => {
    expect(parseAppearance(raw)).toEqual(DEFAULT_APPEARANCE);
  });

  it('conserva lo guardado', () => {
    expect(parseAppearance('{"dimWallpaper":true,"bigTiles":false}')).toEqual({ dimWallpaper: true, bigTiles: false });
    expect(parseAppearance('{"bigTiles":true}')).toEqual({ dimWallpaper: false, bigTiles: true });
  });

  it('solo true enciende: otros valores quedan apagados y las claves extra se ignoran', () => {
    expect(parseAppearance('{"dimWallpaper":"yes","bigTiles":1,"otra":true}')).toEqual(DEFAULT_APPEARANCE);
  });
});

describe('networkSummary', () => {
  const wifi = { ssid: 'Casa', connected: true, ethernet: false, level: 3, ip: '10.0.0.5' };

  it('Wi-Fi conectado: nombre de la red y señal', () => {
    expect(networkSummary(wifi, true)).toEqual({ kind: 'wifi', label: 'Conectado a Casa', network: 'Casa', level: 3, ip: '10.0.0.5' });
  });

  it('Wi-Fi conectado sin nombre', () => {
    expect(networkSummary({ ...wifi, ssid: null }, true).label).toBe('Conectado por Wi-Fi');
  });

  it('el cable gana sobre el Wi-Fi', () => {
    const s = networkSummary({ ...wifi, ethernet: true }, true);
    expect(s.kind).toBe('ethernet');
    expect(s.label).toBe('Conectado por cable');
    expect(s.level).toBeNull();
  });

  it('el agente dice que no hay red: sin conexión, aunque el navegador diga lo contrario', () => {
    expect(networkSummary({ ...wifi, connected: false }, true).kind).toBe('offline');
  });

  it('sin estado del agente manda el navegador', () => {
    expect(networkSummary(null, true)).toEqual({ kind: 'online', label: 'Conectado', network: null, level: null, ip: null });
    expect(networkSummary(null, false).label).toBe('Sin conexión');
  });
});

describe('versionLabel', () => {
  it('versión y compilación del agente', () => {
    expect(versionLabel('0.1.0', 12, '0.1')).toBe('0.1.0 (compilación 12)');
  });

  it('sin compilación muestra solo la versión', () => {
    expect(versionLabel('1.2.0', null, '0.1')).toBe('1.2.0');
  });

  it('sin versión del agente usa la de la interfaz', () => {
    expect(versionLabel(null, 12, '0.1')).toBe('0.1');
  });
});
