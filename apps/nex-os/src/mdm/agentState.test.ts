import { describe, expect, it } from 'vitest';
import { parseAgentState } from './agentState';

const ORIGIN = 'https://appassets.androidplatform.net';
const ID = '3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b5c';
const ID2 = '11111111-2222-4333-8444-555555555555';

function state(extra: Record<string, unknown> = {}) {
  return parseAgentState({ mode: 'active', wifi_token: 'tok', ...extra });
}

function notice(extra: Record<string, unknown> = {}) {
  return { id: ID, title: 'Corte programado', body: 'Mañana de 8 a 10.', category: 'corte', severity: 'importante', expires_at: 1_800_000_000, ...extra };
}

describe('parseAgentState: falla cerrado', () => {
  it.each([null, 'x', 42, [], {}])('entrada inválida %j → starting', (raw) => {
    const s = parseAgentState(raw);
    expect(s.mode).toBe('starting');
    expect(s.apps).toEqual([]);
    expect(s.notices).toEqual([]);
  });

  it('modo desconocido → starting, sin avisos', () => {
    expect(parseAgentState({ mode: 'unlocked', notices: [notice()] }).notices).toEqual([]);
  });
});

describe('apps', () => {
  it('app Android instalada: conserva URL e ícono local, install=false', () => {
    const [app] = state({
      apps: [{ id: 'android:com.netflix.ninja', name: 'Netflix', kind: 'web', launch_url: `${ORIGIN}/android/com.netflix.ninja`, icon: '/agent/icon/com.netflix.ninja' }],
    }).apps;
    expect(app).toEqual({
      id: 'android:com.netflix.ninja',
      name: 'Netflix',
      kind: 'web',
      launch_url: `${ORIGIN}/android/com.netflix.ninja`,
      icon: '/agent/icon/com.netflix.ninja',
      install: false,
    });
  });

  it('ícono de otro origen se descarta', () => {
    const [app] = state({ apps: [{ id: 'a', name: 'A', kind: 'web', launch_url: 'https://a.example/', icon: 'https://evil.example/x.png' }] }).apps;
    expect(app.icon).toBeNull();
  });

  it('app por instalar: URL exacta de Play, sin ícono, install=true', () => {
    const [app] = state({
      apps: [{ id: 'play:com.disney.disneyplus', name: 'Disney+', kind: 'web', launch_url: `${ORIGIN}/android-play/com.disney.disneyplus`, icon: null, install: true }],
    }).apps;
    expect(app).toEqual({
      id: 'play:com.disney.disneyplus',
      name: 'Disney+',
      kind: 'web',
      launch_url: `${ORIGIN}/android-play/com.disney.disneyplus`,
      icon: null,
      install: true,
    });
  });

  it('app por instalar con id truncado a 41 caracteres', () => {
    const pkg = 'com.empresa.con.un.nombre.de.paquete.muy.largo';
    const [app] = state({
      apps: [{ id: `play:${pkg}`.slice(0, 41), name: 'Larga', kind: 'web', launch_url: `${ORIGIN}/android-play/${pkg}`, icon: null, install: true }],
    }).apps;
    expect(app.install).toBe(true);
    expect(app.id).toHaveLength(41);
  });

  it('app por instalar nunca lleva ícono, aunque llegue uno', () => {
    const [app] = state({
      apps: [{ id: 'play:com.a.b', name: 'A', kind: 'web', launch_url: `${ORIGIN}/android-play/com.a.b`, icon: '/agent/icon/com.a.b', install: true }],
    }).apps;
    expect(app.icon).toBeNull();
  });

  it.each([
    ['otro origen', 'https://evil.example/android-play/com.a.b'],
    ['origen parecido', 'https://appassets.androidplatform.net.evil.example/android-play/com.a.b'],
    ['http', 'http://appassets.androidplatform.net/android-play/com.a.b'],
    ['usuario en la URL', 'https://x@appassets.androidplatform.net/android-play/com.a.b'],
    ['puerto', 'https://appassets.androidplatform.net:8443/android-play/com.a.b'],
    ['otro prefijo', `${ORIGIN}/android/com.a.b`],
    ['subir de carpeta', `${ORIGIN}/android-play/../agent/setup/root`],
    ['barra extra', `${ORIGIN}/android-play/com.a.b/x`],
    ['query', `${ORIGIN}/android-play/com.a.b?token=1`],
    ['fragmento', `${ORIGIN}/android-play/com.a.b#x`],
    ['codificado', `${ORIGIN}/android-play/com.a%2Eb`],
    ['espacio', `${ORIGIN}/android-play/com.a.b `],
    ['salto de línea', `${ORIGIN}/android-play/com.a.b\n`],
    ['guion', `${ORIGIN}/android-play/com.a-b.c`],
    ['sin punto', `${ORIGIN}/android-play/paquete`],
    ['segmento vacío', `${ORIGIN}/android-play/com..b`],
    ['segmento que empieza con número', `${ORIGIN}/android-play/com.1a.b`],
    ['vacío', `${ORIGIN}/android-play/`],
    ['mayúsculas en el origen', 'https://APPASSETS.androidplatform.net/android-play/com.a.b'],
  ])('app por instalar con URL inválida (%s) se descarta', (_name, url) => {
    expect(state({ apps: [{ id: 'play:com.a.b', name: 'A', kind: 'web', launch_url: url, icon: null, install: true }] }).apps).toEqual([]);
  });

  it('app por instalar con datos incoherentes se descarta', () => {
    const ok = { id: 'play:com.a.b', name: 'A', kind: 'web', launch_url: `${ORIGIN}/android-play/com.a.b`, icon: null, install: true };
    expect(state({ apps: [{ ...ok, kind: 'internal' }] }).apps).toEqual([]);
    expect(state({ apps: [{ ...ok, id: 'android:com.a.b' }] }).apps).toEqual([]);
    expect(state({ apps: [{ ...ok, launch_url: null }] }).apps).toEqual([]);
    expect(state({ apps: [{ ...ok, launch_url: 42 }] }).apps).toEqual([]);
  });

  it('install solo vale con true literal', () => {
    const [app] = state({ apps: [{ id: 'a', name: 'A', kind: 'web', launch_url: 'https://a.example/', install: 'true' }] }).apps;
    expect(app.install).toBe(false);
  });
});

describe('avisos', () => {
  it('sin el campo → lista vacía', () => {
    expect(state().notices).toEqual([]);
    expect(state({ notices: 'x' }).notices).toEqual([]);
  });

  it('aviso válido', () => {
    expect(state({ notices: [notice()] }).notices).toEqual([
      { id: ID, title: 'Corte programado', body: 'Mañana de 8 a 10.', category: 'corte', severity: 'importante', expiresAt: 1_800_000_000 },
    ]);
  });

  it('el HTML queda como texto, sin tocar', () => {
    const [n] = state({ notices: [notice({ title: '<b>Hola</b>', body: '<img src=x onerror=alert(1)>' })] }).notices;
    expect(n.title).toBe('<b>Hola</b>');
    expect(n.body).toBe('<img src=x onerror=alert(1)>');
  });

  it('recorta título (80) y cuerpo (500) y normaliza saltos de línea', () => {
    const [n] = state({ notices: [notice({ title: `  ${'t'.repeat(200)}`, body: 'a\r\nb\n\n\n\n\nc' })] }).notices;
    expect(n.title).toHaveLength(80);
    expect(n.body).toBe('a\nb\n\nc');
    expect(state({ notices: [notice({ body: 'x'.repeat(900) })] }).notices[0].body).toHaveLength(500);
  });

  it('cuerpo ausente → vacío; categoría desconocida → general', () => {
    const [n] = state({ notices: [notice({ body: undefined, category: 'ovnis' })] }).notices;
    expect(n.body).toBe('');
    expect(n.category).toBe('general');
  });

  it.each([
    ['id que no es uuid', { id: 'abc' }],
    ['id con texto extra', { id: `${ID}&token=x` }],
    ['id numérico', { id: 7 }],
    ['sin título', { title: '   ' }],
    ['título no texto', { title: { a: 1 } }],
    ['gravedad desconocida', { severity: 'critica' }],
    ['sin vencimiento', { expires_at: undefined }],
    ['vencimiento como texto', { expires_at: '1800000000' }],
    ['vencimiento no finito', { expires_at: Number.POSITIVE_INFINITY }],
    ['vencimiento negativo', { expires_at: -1 }],
  ])('aviso inválido (%s) se descarta', (_name, extra) => {
    expect(state({ notices: [notice(extra), null, 'x', 3] }).notices).toEqual([]);
  });

  it('ordena del más grave al más leve, respetando el orden de llegada', () => {
    const ids = ['a', 'b', 'c', 'd'].map((c) => ID.replace(/^./, c));
    const list = state({
      notices: [
        notice({ id: ids[0], severity: 'info' }),
        notice({ id: ids[1], severity: 'importante' }),
        notice({ id: ids[2], severity: 'emergencia' }),
        notice({ id: ids[3], severity: 'importante' }),
      ],
    }).notices;
    expect(list.map((n) => n.id)).toEqual([ids[2], ids[1], ids[3], ids[0]]);
  });

  it('sin repetidos y máximo 5 (se quedan los más graves)', () => {
    expect(state({ notices: [notice(), notice({ id: ID.toUpperCase() }), notice({ id: ID2 })] }).notices.map((n) => n.id)).toEqual([ID, ID2]);
    const many = Array.from({ length: 8 }, (_, i) =>
      notice({ id: ID.replace(/^./, String(i)), severity: i === 7 ? 'emergencia' : 'info' }),
    );
    const list = state({ notices: many }).notices;
    expect(list).toHaveLength(5);
    expect(list[0].severity).toBe('emergencia');
  });

  it('los avisos llegan en cualquier modo (una emergencia se muestra aunque el equipo esté bloqueado)', () => {
    expect(parseAgentState({ mode: 'locked', notices: [notice({ severity: 'emergencia' })] }).notices).toHaveLength(1);
  });
});

describe('versión de NEX TV', () => {
  it('versión y compilación válidas se conservan', () => {
    const s = state({ version: '0.1.0', build: 12 });
    expect(s.version).toBe('0.1.0');
    expect(s.build).toBe(12);
  });

  it('son opcionales: un agente que no las publica deja null', () => {
    const s = state();
    expect(s.version).toBeNull();
    expect(s.build).toBeNull();
  });

  it.each(['', 'v1', '1', '<b>1.0</b>', '1.0.0 beta', 7, null, '1.2.3.4.5'])('versión inválida %j → null', (version) => {
    expect(state({ version }).version).toBeNull();
  });

  it('acepta sufijo de prerelease', () => {
    expect(state({ version: '1.4.2-beta.1' }).version).toBe('1.4.2-beta.1');
  });

  it.each([0, -3, 1.5, '12', null, Number.NaN])('compilación inválida %j → null', (build) => {
    expect(state({ build }).build).toBeNull();
  });
});
