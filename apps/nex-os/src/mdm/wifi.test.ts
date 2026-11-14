import { describe, expect, it } from 'vitest';
import { connectedSsid, moveFocus, networkDetail, parseWifiScan, parseWifiStatus, passwordError, signalLabel } from './wifi';

describe('parseWifiStatus', () => {
  it.each([null, 'x', 7, [], {}, { connected: 'true' }])('entrada inválida %j → null', (raw) => {
    expect(parseWifiStatus(raw)).toBeNull();
  });

  it('estado completo', () => {
    expect(parseWifiStatus({ ssid: 'Casa', connected: true, ethernet: false, level: 3, ip: '192.168.0.12' })).toEqual({
      ssid: 'Casa',
      connected: true,
      ethernet: false,
      level: 3,
      ip: '192.168.0.12',
    });
  });

  it('limita la señal a 0..4 y descarta una IP o un nombre mal formados', () => {
    const s = parseWifiStatus({ ssid: '   ', connected: true, level: 9, ip: 'fe80::1' });
    expect(s).toEqual({ ssid: null, connected: true, ethernet: false, level: 4, ip: null });
    expect(parseWifiStatus({ connected: false, level: -2 })?.level).toBe(0);
    expect(parseWifiStatus({ connected: false, level: 'alta' })?.level).toBe(0);
  });

  it('recorta un nombre de red demasiado largo', () => {
    expect(parseWifiStatus({ connected: true, ssid: 'a'.repeat(80) })?.ssid).toHaveLength(32);
  });
});

describe('parseWifiScan', () => {
  const net = (extra: Record<string, unknown> = {}) => ({ ssid: 'Casa', level: 3, secure: true, saved: false, unsupported: false, ...extra });

  it.each([null, 'x', 7, [], {}])('entrada inválida %j → sin estado ni redes', (raw) => {
    expect(parseWifiScan(raw)).toEqual({ status: null, networks: [] });
  });

  it('conserva las redes válidas y descarta las mal formadas', () => {
    const { networks } = parseWifiScan({ networks: [net(), null, { ssid: '' }, { ssid: 7 }, { ssid: 'a'.repeat(33) }, 'x'] });
    expect(networks).toEqual([net()]);
  });

  it('los campos que no son true quedan en false y la señal se limita a 0..4', () => {
    const { networks } = parseWifiScan({ networks: [{ ssid: 'Bar', level: 12, secure: 'si', saved: 1 }] });
    expect(networks).toEqual([{ ssid: 'Bar', level: 4, secure: false, saved: false, unsupported: false }]);
  });

  it('ordena de la señal más fuerte a la más débil, sin cambiar el orden entre iguales', () => {
    const { networks } = parseWifiScan({ networks: [net({ ssid: 'A', level: 1 }), net({ ssid: 'B', level: 4 }), net({ ssid: 'C', level: 1 })] });
    expect(networks.map((n) => n.ssid)).toEqual(['B', 'A', 'C']);
  });

  it('una red repetida aparece una sola vez, con su mejor señal', () => {
    const { networks } = parseWifiScan({ networks: [net({ level: 1 }), net({ level: 4 }), net({ level: 2 })] });
    expect(networks).toEqual([net({ level: 4 })]);
  });

  it('no recorta los espacios del nombre: se manda igual al conectar', () => {
    expect(parseWifiScan({ networks: [net({ ssid: ' Casa ' })] }).networks[0].ssid).toBe(' Casa ');
  });

  it('lee el estado que viene con la búsqueda', () => {
    expect(parseWifiScan({ status: { connected: true, ssid: 'Casa', level: 2 }, networks: [] }).status?.ssid).toBe('Casa');
  });

  it('limita la cantidad de redes', () => {
    const many = Array.from({ length: 80 }, (_, i) => net({ ssid: `Red ${i}` }));
    expect(parseWifiScan({ networks: many }).networks).toHaveLength(30);
  });
});

describe('connectedSsid', () => {
  const status = { ssid: 'Casa', connected: true, ethernet: false, level: 3, ip: null };

  it('Wi-Fi conectado → su nombre', () => {
    expect(connectedSsid(status)).toBe('Casa');
  });

  it('sin conexión, por cable o sin estado → null', () => {
    expect(connectedSsid({ ...status, connected: false })).toBeNull();
    expect(connectedSsid({ ...status, ethernet: true })).toBeNull();
    expect(connectedSsid(null)).toBeNull();
  });
});

describe('networkDetail', () => {
  const n = { ssid: 'Casa', level: 3, secure: true, saved: false, unsupported: false };

  it('describe la seguridad', () => {
    expect(networkDetail(n, null)).toBe('Con contraseña');
    expect(networkDetail({ ...n, secure: false }, null)).toBe('Abierta');
  });

  it('marca la guardada y la conectada', () => {
    expect(networkDetail({ ...n, saved: true }, null)).toBe('Guardada · Con contraseña');
    expect(networkDetail({ ...n, saved: true }, 'Casa')).toBe('Conectada');
  });

  it('la no compatible lo dice antes que nada', () => {
    expect(networkDetail({ ...n, unsupported: true }, 'Casa')).toBe('No es compatible con este equipo');
  });
});

describe('signalLabel', () => {
  it('nombra cada nivel y tolera valores fuera de rango', () => {
    expect([0, 1, 2, 3, 4].map(signalLabel)).toEqual(['Sin señal', 'Débil', 'Regular', 'Buena', 'Excelente']);
    expect(signalLabel(9)).toBe('Excelente');
    expect(signalLabel(Number.NaN)).toBe('Sin señal');
  });
});

describe('passwordError', () => {
  const MSG = 'La contraseña debe tener entre 8 y 63 caracteres.';

  it('red de la lista: siempre pide de 8 a 63 caracteres', () => {
    expect(passwordError('', true)).toBe(MSG);
    expect(passwordError('1234567', true)).toBe(MSG);
    expect(passwordError('12345678', true)).toBeNull();
    expect(passwordError('a'.repeat(63), true)).toBeNull();
    expect(passwordError('a'.repeat(64), true)).toBe(MSG);
  });

  it('otra red: vacía vale (red abierta); si se escribe, de 8 a 63', () => {
    expect(passwordError('', false)).toBeNull();
    expect(passwordError('123', false)).toBe(MSG);
    expect(passwordError('12345678', false)).toBeNull();
    expect(passwordError('a'.repeat(64), false)).toBe(MSG);
  });
});

describe('moveFocus', () => {
  // Formulario de "Otra red": nombre / contraseña + mostrar / conectar + cancelar.
  const rows = ['ssid', 'pass', 'pass', 'actions', 'actions'];

  it('▲▼ van al primer elemento de la fila vecina', () => {
    expect(moveFocus(rows, 0, 'ArrowDown')).toBe(1);
    expect(moveFocus(rows, 1, 'ArrowDown')).toBe(3);
    expect(moveFocus(rows, 2, 'ArrowDown')).toBe(3);
    expect(moveFocus(rows, 4, 'ArrowUp')).toBe(1);
    expect(moveFocus(rows, 2, 'ArrowUp')).toBe(0);
  });

  it('◀▶ se mueven solo dentro de la fila', () => {
    expect(moveFocus(rows, 1, 'ArrowRight')).toBe(2);
    expect(moveFocus(rows, 2, 'ArrowRight')).toBe(2);
    expect(moveFocus(rows, 4, 'ArrowLeft')).toBe(3);
    expect(moveFocus(rows, 3, 'ArrowLeft')).toBe(3);
    expect(moveFocus(rows, 0, 'ArrowRight')).toBe(0);
  });

  it('no se sale de los extremos', () => {
    expect(moveFocus(rows, 0, 'ArrowUp')).toBe(0);
    expect(moveFocus(rows, 3, 'ArrowDown')).toBe(3);
  });

  it('sin foco en la pantalla va al primero; sin elementos, a ninguno; otra tecla no mueve', () => {
    expect(moveFocus(rows, -1, 'ArrowDown')).toBe(0);
    expect(moveFocus([], 0, 'ArrowDown')).toBe(-1);
    expect(moveFocus(rows, 2, 'Enter')).toBe(2);
  });
});
