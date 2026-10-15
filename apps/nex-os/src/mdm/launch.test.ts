import { describe, expect, it } from 'vitest';
import type { MdmApp } from './agentState';
import { launchUrl, localQr } from './launch';

const app: MdmApp = {
  id: 'isp-tv',
  name: 'ISP TV',
  kind: 'web',
  launch_url: 'https://tv.isp.example/app',
  pass_attestation: true,
  disabled: false,
};

describe('launchUrl', () => {
  it('agrega la atestación en el fragmento (no viaja al servidor)', () => {
    expect(launchUrl(app, 'a.b.c')).toBe('https://tv.isp.example/app#nex_attestation=a.b.c');
  });

  it('si la URL ya tiene fragmento, la agrega con &', () => {
    expect(launchUrl({ ...app, launch_url: 'https://tv.isp.example/#/home' }, 'a.b.c')).toBe(
      'https://tv.isp.example/#/home&nex_attestation=a.b.c',
    );
  });

  it('sin atestación o si la app no la pide, la URL va sin cambios', () => {
    expect(launchUrl(app, null)).toBe(app.launch_url);
    expect(launchUrl({ ...app, pass_attestation: false }, 'a.b.c')).toBe(app.launch_url);
  });

  it('una app deshabilitada nunca se abre', () => {
    expect(launchUrl({ ...app, disabled: true }, 'a.b.c')).toBeNull();
  });
});

describe('localQr', () => {
  it('genera el QR en el equipo como data URL', () => {
    expect(localQr('https://pagos.example.com/x')).toMatch(/^data:image\/gif;base64,/);
  });
});
