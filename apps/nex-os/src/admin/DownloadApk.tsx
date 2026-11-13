import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

/** APK de NEX TV para instalar en los TV box. Se publica en R2 (bucket nex-tv-descargas), servido por nextv-descargas.macch.ai. */
export const APK_PATH = 'https://nextv-descargas.macch.ai/nex-tv.apk';

/** Botón de descarga del APK. Solo aparece si el archivo está publicado, así el panel puede salir antes que el APK. */
export default function DownloadApk() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(APK_PATH, { method: 'HEAD', cache: 'no-store' })
      .then((r) => !cancelled && setAvailable(r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (!available) return null;
  return (
    <a
      href={APK_PATH}
      download="nex-tv.apk"
      className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2 text-sm text-fg-2 transition hover:border-line-strong hover:bg-fill hover:text-fg"
    >
      <Download className="h-4 w-4 shrink-0 text-fg-4" aria-hidden />
      <span className="min-w-0">
        <span className="block font-medium">Descargar NEX TV</span>
        <span className="block text-[11px] text-fg-4">APK para TV box Android</span>
      </span>
    </a>
  );
}
