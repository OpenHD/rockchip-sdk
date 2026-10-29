import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

/** APK de NEX TV para instalar en los TV box. Se publica junto al panel en public/downloads/. */
export const APK_PATH = '/downloads/nex-tv.apk';

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
      className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
    >
      <Download className="h-4 w-4" aria-hidden />
      <span className="min-w-0">
        <span className="block font-medium">Descargar NEX TV</span>
        <span className="block text-[11px] text-zinc-500">APK para TV box Android</span>
      </span>
    </a>
  );
}
