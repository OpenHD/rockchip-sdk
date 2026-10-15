import qrcode from 'qrcode-generator';
import type { MdmApp } from './agentState';

/** URL de lanzamiento: con atestación si la app la pide y el agente tiene una vigente. */
export function launchUrl(app: MdmApp, attestation: string | null): string | null {
  if (app.disabled || !app.launch_url) return null;
  if (!app.pass_attestation || !attestation) return app.launch_url;
  // Va en el fragmento: no viaja en la petición HTTP ni queda en logs del servidor.
  const sep = app.launch_url.includes('#') ? '&' : '#';
  return `${app.launch_url}${sep}nex_attestation=${encodeURIComponent(attestation)}`;
}

/** QR generado en el equipo (data URL): el contenido no pasa por ningún servicio externo. */
export function localQr(text: string, cellSize = 8): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createDataURL(cellSize, 2);
}
