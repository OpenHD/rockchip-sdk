const DB_NAME = 'nex-fs-blobs';
const STORE = 'blobs';
const VERSION = 1;

type BlobRecord = { path: string; data: ArrayBuffer };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'path' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IDB open failed'));
  });
}

/** In-memory fallback when IDB is unavailable (SSR / private mode edge cases). */
const memory = new Map<string, Uint8Array>();

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const req = fn(store);
      if (!req) {
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = () => reject(tx.error);
        return;
      }
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export async function blobGet(path: string): Promise<Uint8Array | null> {
  const rec = await withStore<BlobRecord>('readonly', (store) => store.get(path));
  if (rec?.data) return new Uint8Array(rec.data);
  return memory.get(path) ?? null;
}

export async function blobSet(path: string, data: Uint8Array): Promise<void> {
  const copy = data.slice();
  memory.set(path, copy);
  const ab = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
  await withStore('readwrite', (store) =>
    store.put({ path, data: ab } satisfies BlobRecord),
  );
}

export async function blobDelete(path: string): Promise<void> {
  memory.delete(path);
  await withStore('readwrite', (store) => store.delete(path));
}

export async function blobDeletePrefix(prefix: string): Promise<void> {
  const p = prefix.endsWith('\\') ? prefix : `${prefix}\\`;
  for (const key of [...memory.keys()]) {
    if (key === prefix || key.startsWith(p)) memory.delete(key);
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const key = String(cursor.key);
        if (key === prefix || key.startsWith(p)) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* memory already cleaned */
  }
}

export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
