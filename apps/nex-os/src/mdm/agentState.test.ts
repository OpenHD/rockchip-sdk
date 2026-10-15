import { describe, expect, it } from 'vitest';
import { parseAgentState } from './agentState';

const NOW = 1_790_000_000_000;
const T = NOW / 1000;

function base(extra: Record<string, unknown> = {}) {
  return { mode: 'active', updated_at: T, ...extra };
}

const app = {
  id: 'yt',
  name: 'YouTube',
  kind: 'web',
  launch_url: 'https://youtube.com/tv',
  pass_attestation: true,
};

describe('parseAgentState: falla cerrado', () => {
  it.each([null, 'x', 42, [], {}])('entrada inválida %j → starting', (raw) => {
    expect(parseAgentState(raw, NOW).mode).toBe('starting');
  });

  it('modo desconocido → starting', () => {
    expect(parseAgentState(base({ mode: 'unlocked' }), NOW).mode).toBe('starting');
  });

  it('sin updated_at → starting', () => {
    expect(parseAgentState({ mode: 'active' }, NOW).mode).toBe('starting');
  });

  it('agente caído (estado de hace más de 2 minutos) → starting', () => {
    expect(parseAgentState(base({ updated_at: T - 121 }), NOW).mode).toBe('starting');
    expect(parseAgentState(base({ updated_at: T - 119 }), NOW).mode).toBe('active');
  });

  it('acepta los cinco modos conocidos', () => {
    for (const mode of ['starting', 'unpaired', 'locked', 'restricted', 'active']) {
      expect(parseAgentState(base({ mode }), NOW).mode).toBe(mode);
    }
  });
});

describe('parseAgentState: apps', () => {
  it('app web válida en modo activo', () => {
    const s = parseAgentState(base({ apps: [app] }), NOW);
    expect(s.apps).toEqual([{ ...app, launch_url: 'https://youtube.com/tv', disabled: false }]);
  });

  it('descarta apps con URL no https o sin nombre', () => {
    const s = parseAgentState(
      base({ apps: [{ ...app, launch_url: 'http://x.com' }, { ...app, launch_url: 'javascript:alert(1)' }, { ...app, name: '' }] }),
      NOW,
    );
    expect(s.apps).toEqual([]);
  });

  it('en modo restringido todas las apps quedan deshabilitadas aunque el archivo diga otra cosa', () => {
    const s = parseAgentState(base({ mode: 'restricted', apps: [app] }), NOW);
    expect(s.apps[0]).toMatchObject({ id: 'yt', disabled: true, launch_url: null, pass_attestation: false });
  });

  it('app marcada disabled se acepta sin URL', () => {
    const s = parseAgentState(base({ mode: 'restricted', apps: [{ id: 'yt', name: 'YouTube', kind: 'web', disabled: true }] }), NOW);
    expect(s.apps).toHaveLength(1);
  });
});

describe('parseAgentState: atestación', () => {
  const jwt = 'aaa.bbb.ccc';
  it('solo en modo activo', () => {
    expect(parseAgentState(base({ attestation: jwt }), NOW).attestation).toBe(jwt);
    expect(parseAgentState(base({ mode: 'locked', attestation: jwt }), NOW).attestation).toBeNull();
    expect(parseAgentState(base({ mode: 'restricted', attestation: jwt }), NOW).attestation).toBeNull();
  });
  it('rechaza lo que no parece un JWT', () => {
    expect(parseAgentState(base({ attestation: 'a.b' }), NOW).attestation).toBeNull();
    expect(parseAgentState(base({ attestation: 'a.b.c<script>' }), NOW).attestation).toBeNull();
  });
});

describe('parseAgentState: pago y estados escalonados', () => {
  it('aviso solo en modo activo', () => {
    expect(parseAgentState(base({ service_warning: true }), NOW).serviceWarning).toBe(true);
    expect(parseAgentState(base({ mode: 'locked', service_warning: true }), NOW).serviceWarning).toBe(false);
  });

  it('datos de pago validados', () => {
    const s = parseAgentState(
      base({ payment: { due: '2026-10-01', phone: '+54 11 5555-0000', url: 'https://pagos.example.com/x', message: 'Pagá' } }),
      NOW,
    );
    expect(s.payment).toEqual({ due: '2026-10-01', phone: '+54 11 5555-0000', url: 'https://pagos.example.com/x', message: 'Pagá' });
  });

  it('descarta URL de pago no https, teléfono raro y fecha inválida', () => {
    const s = parseAgentState(
      base({ payment: { due: 'mañana', phone: 'llamá ya!!', url: 'http://pagos.example.com', message: null } }),
      NOW,
    );
    expect(s.payment).toEqual({ due: null, phone: null, url: null, message: null });
  });

  it('tipo de restricción por defecto: manual', () => {
    expect(parseAgentState(base({ mode: 'restricted' }), NOW).restrictKind).toBe('manual');
    expect(parseAgentState(base({ mode: 'restricted', restrict_kind: 'payment' }), NOW).restrictKind).toBe('payment');
    expect(parseAgentState(base({ restrict_kind: 'payment' }), NOW).restrictKind).toBeNull();
  });
});

describe('parseAgentState: Wi-Fi y desbloqueo', () => {
  it('estados en minúsculas y IP con charset válido', () => {
    const s = parseAgentState(base({ wifi: { iface: 'wlan0', state: 'connected', ssid: 'Casa', ip: '192.168.1.5', scan: [] } }), NOW);
    expect(s.wifi).toMatchObject({ state: 'connected', ip: '192.168.1.5' });
    const bad = parseAgentState(base({ wifi: { state: 'COMPLETED', ip: '1.2.3.4; rm' } }), NOW);
    expect(bad.wifi).toMatchObject({ state: null, ip: null });
  });

  it('red escaneada sin señal válida se descarta', () => {
    const s = parseAgentState(
      base({ wifi: { scan: [{ ssid: 'A', signal: -50, secure: true }, { ssid: 'B', signal: 10 }, { ssid: '', signal: -60 }] } }),
      NOW,
    );
    expect(s.wifi?.scan).toEqual([{ ssid: 'A', signal: -50, secure: true }]);
  });

  it('resultado del código de desbloqueo', () => {
    const s = parseAgentState(base({ mode: 'locked', unlock: { result: 'ok', at: T, until: T + 259200 } }), NOW);
    expect(s.unlock).toEqual({ result: 'ok', at: T, until: T + 259200 });
    expect(parseAgentState(base({ unlock: { result: 'hackeado' } }), NOW).unlock.result).toBeNull();
  });
});
