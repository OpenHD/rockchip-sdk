/**
 * Lee un APK en el navegador: paquete, versionCode, versionName y nombre (si es texto literal) del
 * AndroidManifest.xml binario, y el sha256 del archivo. Así el ISP solo elige el archivo.
 * El TV vuelve a verificar paquete, versión y sha256 antes de instalar: esto es comodidad, no seguridad.
 */

export interface ApkInfo {
  package: string;
  versionCode: number;
  versionName: string | null;
  /** android:label de <application> si es texto literal; null si apunta a un recurso. */
  label: string | null;
}

export class ApkError extends Error {}

const EOCD = 0x06054b50;
const CEN = 0x02014b50;
const LOC = 0x04034b50;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Busca un archivo dentro del zip por el directorio central y lo devuelve descomprimido. */
export async function readZipEntry(buf: ArrayBuffer, wanted: string): Promise<Uint8Array> {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65_557); i--) {
    if (v.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ApkError('El archivo no es un APK (no es un zip)');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.byteLength || v.getUint32(p, true) !== CEN) throw new ApkError('APK dañado');
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(buf, p + 46, nameLen));
    if (name === wanted) {
      if (v.getUint32(local, true) !== LOC) throw new ApkError('APK dañado');
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const data = new Uint8Array(buf, start, compSize);
      if (method === 0) return data;
      if (method === 8) return inflateRaw(data);
      throw new ApkError('APK con compresión no soportada');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new ApkError('El APK no tiene AndroidManifest.xml');
}

// Tipos de chunk y de valor del XML binario de Android (ResourceTypes.h).
const RES_XML = 0x0003;
const RES_STRING_POOL = 0x0001;
const RES_XML_START_ELEMENT = 0x0102;
const TYPE_STRING = 0x03;
const TYPE_INT_DEC = 0x10;
const TYPE_INT_HEX = 0x11;
const NO_INDEX = 0xffffffff;

function readStringPool(v: DataView, at: number): string[] {
  const count = v.getUint32(at + 8, true);
  const utf8 = (v.getUint32(at + 16, true) & 0x100) !== 0;
  const stringsStart = at + v.getUint32(at + 20, true);
  const out: string[] = [];
  const u8 = new TextDecoder('utf-8');
  for (let i = 0; i < count; i++) {
    let p = stringsStart + v.getUint32(at + v.getUint16(at + 2, true) + i * 4, true);
    if (utf8) {
      // Largo en caracteres y en bytes, cada uno de 1 o 2 bytes.
      p += v.getUint8(p) & 0x80 ? 2 : 1;
      let len = v.getUint8(p);
      if (len & 0x80) {
        len = ((len & 0x7f) << 8) | v.getUint8(p + 1);
        p += 2;
      } else {
        p += 1;
      }
      out.push(u8.decode(new Uint8Array(v.buffer, v.byteOffset + p, len)));
    } else {
      let len = v.getUint16(p, true);
      if (len & 0x8000) {
        len = ((len & 0x7fff) << 16) | v.getUint16(p + 2, true);
        p += 4;
      } else {
        p += 2;
      }
      let s = '';
      for (let c = 0; c < len; c++) s += String.fromCharCode(v.getUint16(p + c * 2, true));
      out.push(s);
    }
  }
  return out;
}

/** Saca los datos de <manifest> y <application> del AndroidManifest.xml compilado. */
export function parseBinaryManifest(bytes: Uint8Array): ApkInfo {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 8 || v.getUint16(0, true) !== RES_XML) throw new ApkError('Manifiesto inválido');
  let strings: string[] = [];
  let pkg: string | null = null;
  let versionCode: number | null = null;
  let versionName: string | null = null;
  let label: string | null = null;
  let p = v.getUint16(2, true);
  while (p + 8 <= bytes.byteLength) {
    const type = v.getUint16(p, true);
    const headerSize = v.getUint16(p + 2, true);
    const size = v.getUint32(p + 4, true);
    if (size < 8 || p + size > bytes.byteLength) throw new ApkError('Manifiesto inválido');
    if (type === RES_STRING_POOL) {
      strings = readStringPool(v, p);
    } else if (type === RES_XML_START_ELEMENT) {
      const ext = p + headerSize;
      const element = strings[v.getUint32(ext + 4, true)];
      if (element === 'manifest' || element === 'application') {
        const attrStart = ext + v.getUint16(ext + 8, true);
        const attrSize = v.getUint16(ext + 10, true);
        const attrCount = v.getUint16(ext + 12, true);
        for (let i = 0; i < attrCount; i++) {
          const a = attrStart + i * attrSize;
          const name = strings[v.getUint32(a + 4, true)];
          const raw = v.getUint32(a + 8, true);
          const dataType = v.getUint8(a + 15);
          const data = v.getUint32(a + 16, true);
          const str = raw !== NO_INDEX ? strings[raw] : dataType === TYPE_STRING ? strings[data] : null;
          if (element === 'manifest') {
            if (name === 'package') pkg = str;
            else if (name === 'versionCode' && (dataType === TYPE_INT_DEC || dataType === TYPE_INT_HEX)) versionCode = data;
            else if (name === 'versionCode' && str && /^[0-9]+$/.test(str)) versionCode = Number(str);
            else if (name === 'versionName') versionName = str;
          } else if (name === 'label' && str) {
            label = str;
          }
        }
        if (element === 'application') break;
      }
    }
    p += size;
  }
  if (!pkg) throw new ApkError('El APK no declara el paquete');
  if (!versionCode) throw new ApkError('El APK no declara versionCode');
  return { package: pkg, versionCode, versionName, label };
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readApk(buf: ArrayBuffer): Promise<ApkInfo & { sha256: string }> {
  const info = parseBinaryManifest(await readZipEntry(buf, 'AndroidManifest.xml'));
  return { ...info, sha256: await sha256Hex(buf) };
}

/** Paquete desde un link de la Play Store (…/details?id=com.x.y) o el paquete tal cual. */
export function packageFromPlayInput(input: string): string | null {
  const text = input.trim();
  try {
    const url = new URL(text);
    if (!/(^|\.)play\.google\.com$/.test(url.hostname) && url.protocol !== 'market:') return null;
    return url.searchParams.get('id');
  } catch {
    return text || null;
  }
}
