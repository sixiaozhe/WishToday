import type { AppState } from '@dayline/core';

const IDB_NAME = 'dayline.attachments';
const IDB_STORE = 'files';
const IDB_VERSION = 1;

export interface SavedAttachmentFile {
  storagePath: string;
  sha256: string;
}

function hasOpfs(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.storage?.getDirectory);
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/** SHA-256 fallback for HTTP LAN pages where crypto.subtle is unavailable. */
function sha256Fallback(bytes: Uint8Array): string {
  const bitLength = bytes.length * 8;
  const withPadding = new Uint8Array(((bytes.length + 8) >> 6) * 64 + 64);
  withPadding.set(bytes);
  withPadding[bytes.length] = 0x80;
  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(withPadding.length - 4, bitLength >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < withPadding.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      w[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotr(w[index - 15] ?? 0, 7) ^ rotr(w[index - 15] ?? 0, 18) ^ ((w[index - 15] ?? 0) >>> 3);
      const s1 = rotr(w[index - 2] ?? 0, 17) ^ rotr(w[index - 2] ?? 0, 19) ^ ((w[index - 2] ?? 0) >>> 10);
      w[index] = ((w[index - 16] ?? 0) + s0 + (w[index - 7] ?? 0) + s1) >>> 0;
    }

    let a = h[0] ?? 0;
    let b = h[1] ?? 0;
    let c = h[2] ?? 0;
    let d = h[3] ?? 0;
    let e = h[4] ?? 0;
    let f = h[5] ?? 0;
    let g = h[6] ?? 0;
    let hh = h[7] ?? 0;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + (SHA256_K[index] ?? 0) + (w[index] ?? 0)) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = ((h[0] ?? 0) + a) >>> 0;
    h[1] = ((h[1] ?? 0) + b) >>> 0;
    h[2] = ((h[2] ?? 0) + c) >>> 0;
    h[3] = ((h[3] ?? 0) + d) >>> 0;
    h[4] = ((h[4] ?? 0) + e) >>> 0;
    h[5] = ((h[5] ?? 0) + f) >>> 0;
    h[6] = ((h[6] ?? 0) + g) >>> 0;
    h[7] = ((h[7] ?? 0) + hh) >>> 0;
  }

  const output = new Uint8Array(32);
  const outputView = new DataView(output.buffer);
  for (let index = 0; index < 8; index += 1) {
    outputView.setUint32(index * 4, h[index] ?? 0);
  }
  return bytesToHex(output);
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return bytesToHex(new Uint8Array(digest));
  }
  return sha256Fallback(new Uint8Array(buffer));
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'));
  });
}

async function idbPut(key: string, blob: Blob): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE, 'readwrite');
    transaction.objectStore(IDB_STORE).put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('附件写入失败'));
  });
  db.close();
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openIdb();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE, 'readonly');
    const request = transaction.objectStore(IDB_STORE).get(key);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('附件读取失败'));
  });
  db.close();
  return result;
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE, 'readwrite');
    transaction.objectStore(IDB_STORE).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('附件删除失败'));
  });
  db.close();
}

async function opfsWrite(key: string, buffer: ArrayBuffer): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const parts = key.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) throw new Error('附件路径为空');
  let directory = root;
  for (const part of parts) {
    directory = await directory.getDirectoryHandle(part, { create: true });
  }
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(buffer);
  await writable.close();
}

async function opfsRead(key: string): Promise<Blob | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const parts = key.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) return null;
    let directory = root;
    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part);
    }
    const handle = await directory.getFileHandle(name);
    return await handle.getFile();
  } catch {
    return null;
  }
}

async function opfsDelete(key: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const parts = key.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) return;
    let directory = root;
    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part);
    }
    await directory.removeEntry(name);
  } catch {
    // Already missing.
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('读取附件失败'));
    reader.readAsDataURL(blob);
  });
}

function keyFromPath(storagePath: string): { scheme: 'opfs' | 'idb'; key: string } | null {
  if (storagePath.startsWith('opfs:')) {
    return { scheme: 'opfs', key: storagePath.slice(5) };
  }
  if (storagePath.startsWith('idb:')) {
    return { scheme: 'idb', key: storagePath.slice(4) };
  }
  return null;
}

function scopedAttachmentKey(scope: string, hash: string): string {
  const safe = scope.replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
  return `attachments/${safe}/${hash}`;
}

export async function saveAttachmentFile(
  file: File,
  scope = 'default',
): Promise<SavedAttachmentFile> {
  const buffer = await file.arrayBuffer();
  const sha256 = await sha256Hex(buffer);
  const key = scopedAttachmentKey(scope, sha256);
  const blob = new Blob([buffer], { type: file.type || 'application/octet-stream' });

  if (hasOpfs()) {
    try {
      await opfsWrite(key, buffer);
      return { storagePath: `opfs:${key}`, sha256 };
    } catch (error) {
      console.warn('[attachments] OPFS write failed, falling back to IndexedDB', error);
    }
  }

  try {
    await idbPut(key, blob);
    return { storagePath: `idb:${key}`, sha256 };
  } catch (error) {
    console.warn('[attachments] IndexedDB write failed, falling back to data URL', error);
  }

  return { storagePath: await blobToDataUrl(blob), sha256 };
}

/** Migrates a legacy inline data URL attachment to OPFS / IndexedDB. */
export async function migrateDataUrlAttachment(
  dataUrl: string,
  scope = 'default',
): Promise<SavedAttachmentFile | null> {
  if (!dataUrl.startsWith('data:')) return null;
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const sha256 = await sha256Hex(buffer);
    const key = scopedAttachmentKey(scope, sha256);

    if (hasOpfs()) {
      try {
        await opfsWrite(key, buffer);
        return { storagePath: `opfs:${key}`, sha256 };
      } catch {
        // fall through
      }
    }
    try {
      await idbPut(key, blob);
      return { storagePath: `idb:${key}`, sha256 };
    } catch {
      // Keep the data URL if neither backend works.
    }
  } catch (error) {
    console.warn('[attachments] data URL migration failed', error);
  }
  return null;
}

export async function resolveAttachmentUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  if (storagePath.startsWith('data:') || storagePath.startsWith('http')) return storagePath;

  const parsed = keyFromPath(storagePath);
  if (!parsed) return null;
  const blob =
    parsed.scheme === 'opfs' ? await opfsRead(parsed.key) : await idbGet(parsed.key);
  return blob ? URL.createObjectURL(blob) : null;
}

export async function exportAttachmentDataUrl(storagePath: string): Promise<string | null> {
  if (storagePath.startsWith('data:')) return storagePath;
  const parsed = keyFromPath(storagePath);
  if (!parsed) return null;
  const blob =
    parsed.scheme === 'opfs' ? await opfsRead(parsed.key) : await idbGet(parsed.key);
  return blob ? blobToDataUrl(blob) : null;
}

/** Inlines attachment blobs so a JSON backup is portable across devices. */
export async function hydrateAttachmentDataUrls(state: AppState): Promise<AppState> {
  const attachments = await Promise.all(
    state.attachments.map(async (attachment) => {
      if (attachment.deletedAt !== null || attachment.storagePath.startsWith('data:')) {
        return attachment;
      }
      const dataUrl = await exportAttachmentDataUrl(attachment.storagePath);
      return dataUrl ? { ...attachment, storagePath: dataUrl } : attachment;
    }),
  );
  return { ...state, attachments };
}

export async function deleteAttachmentFile(storagePath: string): Promise<void> {
  const parsed = keyFromPath(storagePath);
  if (!parsed) return;
  if (parsed.scheme === 'opfs') {
    await opfsDelete(parsed.key);
  } else {
    try {
      await idbDelete(parsed.key);
    } catch {
      // ignore
    }
  }
}
