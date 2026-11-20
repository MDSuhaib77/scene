/**
 * SceneOS — Vault Binary Media Storage Service
 *
 * Stores uploaded media payloads cleanly inside IndexedDB off React state and
 * localStorage JSON paths, with an in-memory fallback strictly for non-IndexedDB
 * environments (SSR / Node tests), proper quota/abort error propagation so failed
 * video/audio uploads never falsely report success, and deterministic ObjectURL cleanup.
 */

const DB_NAME = 'sceneos_vault_media_v1';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

interface StoredBlobRecord {
  id: string;
  productionId: string;
  blob: Blob;
  updatedAt: string;
}

const memoryFallbackStore = new Map<string, StoredBlobRecord>();
const activeObjectUrls = new Map<string, { url: string; productionId: string }>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openVaultDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('productionId', 'productionId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open Vault IndexedDB'));
  });
}

function formatStorageError(err: unknown): Error {
  const rawName = (err as { name?: string })?.name || '';
  const rawMsg = (err as { message?: string })?.message || String(err || '');
  if (rawName === 'QuotaExceededError' || /quota/i.test(rawMsg)) {
    return new Error(
      'Browser storage quota exceeded while saving media file. Free disk/browser storage or remove older unused assets.'
    );
  }
  return new Error(rawMsg || 'Failed to persist media file to browser IndexedDB storage.');
}

export async function saveVaultMediaBlob(
  assetId: string,
  productionId: string,
  blob: Blob
): Promise<void> {
  // Detach native OS File references into a standalone Blob slice so IndexedDB storage remains durable across reloads
  const storableBlob =
    typeof blob.slice === 'function' ? blob.slice(0, blob.size, blob.type) : blob;

  const record: StoredBlobRecord = {
    id: assetId,
    productionId,
    blob: storableBlob,
    updatedAt: new Date().toISOString(),
  };

  if (!hasIndexedDb()) {
    memoryFallbackStore.set(assetId, record);
    return;
  }

  const db = await openVaultDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        reject(formatStorageError(err));
      };

      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error || new Error('Storage transaction aborted (likely quota exceeded).'));

      try {
        const req = tx.objectStore(STORE_NAME).put(record);
        req.onerror = () => fail(req.error);
      } catch (putErr) {
        fail(putErr);
      }
    });

    // Only populate fast-access memory cache AFTER IndexedDB commit actually succeeded
    memoryFallbackStore.set(assetId, record);
  } catch (err) {
    memoryFallbackStore.delete(assetId);
    throw err instanceof Error ? err : formatStorageError(err);
  } finally {
    try {
      db.close();
    } catch {
      // ignore close errors
    }
  }
}

export async function getVaultMediaBlob(
  assetId: string,
  productionId: string
): Promise<Blob | null> {
  const mem = memoryFallbackStore.get(assetId);
  if (mem && mem.productionId === productionId) {
    return mem.blob;
  }

  if (!hasIndexedDb()) return null;

  try {
    const db = await openVaultDatabase();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(assetId);
      req.onsuccess = () => {
        db.close();
        const rec = req.result as StoredBlobRecord | undefined;
        if (rec && rec.productionId === productionId && rec.blob) {
          memoryFallbackStore.set(assetId, rec);
          resolve(rec.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function deleteVaultMediaBlob(assetId: string): Promise<void> {
  releaseVaultObjectUrl(assetId);
  memoryFallbackStore.delete(assetId);

  if (!hasIndexedDb()) return;

  try {
    const db = await openVaultDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(assetId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore storage cleanup error gracefully
  }
}

export async function acquireVaultObjectUrl(
  assetId: string,
  productionId: string
): Promise<string | null> {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null;
  }

  const cached = activeObjectUrls.get(assetId);
  if (cached && cached.productionId === productionId) {
    return cached.url;
  }

  const blob = await getVaultMediaBlob(assetId, productionId);
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  activeObjectUrls.set(assetId, { url, productionId });
  return url;
}

export function releaseVaultObjectUrl(assetId: string): void {
  const cached = activeObjectUrls.get(assetId);
  if (!cached) return;
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    try {
      URL.revokeObjectURL(cached.url);
    } catch {
      // ignore revoke errors
    }
  }
  activeObjectUrls.delete(assetId);
}

export function releaseProductionVaultUrls(productionId?: string): void {
  for (const [assetId, entry] of activeObjectUrls.entries()) {
    if (!productionId || entry.productionId === productionId) {
      releaseVaultObjectUrl(assetId);
    }
  }
}
