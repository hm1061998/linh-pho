import type { SavePort } from '../ports/SavePort';

/**
 * Stores the save in the browser. IndexedDB is the main store. localStorage is the fallback, for browsers or private
 * windows where IndexedDB is missing or refuses to open. Every access is guarded: a failed read is treated as "nothing
 * stored", and a failed write is reported as `false`, never thrown into the game loop.
 */

const DB_NAME = 'linh-pho';
const STORE_NAME = 'saves';
const DB_VERSION = 1;
const SAVE_KEY = 'progress';
const BACKUP_KEY = 'progress-backup';
const FALLBACK_SAVE_KEY = 'linh-pho.progress';
const FALLBACK_BACKUP_KEY = 'linh-pho.progress-backup';

/** The storage this adapter may use. Injected, so tests can run without a browser. */
export interface SaveBackends {
  readonly indexedDB?: IDBFactory;
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

function browserBackends(): SaveBackends {
  const backends: { indexedDB?: IDBFactory; storage?: Storage } = {};
  try {
    if (typeof indexedDB !== 'undefined') {
      backends.indexedDB = indexedDB;
    }
  } catch {
    // Some privacy modes throw on access. Treat that as unavailable.
  }
  try {
    if (typeof localStorage !== 'undefined') {
      backends.storage = localStorage;
    }
  } catch {
    // Same as above: blocked storage is simply unavailable.
  }
  return backends;
}

export class LocalSaveAdapter implements SavePort {
  private readonly backends: SaveBackends;

  constructor(backends: SaveBackends = browserBackends()) {
    this.backends = backends;
  }

  async read(): Promise<string | null> {
    const fromDatabase = await this.databaseGet(SAVE_KEY);
    return fromDatabase ?? this.storageGet(FALLBACK_SAVE_KEY);
  }

  async write(text: string): Promise<boolean> {
    return (await this.databasePut(SAVE_KEY, text)) || this.storageSet(FALLBACK_SAVE_KEY, text);
  }

  async writeBackup(text: string): Promise<boolean> {
    return (await this.databasePut(BACKUP_KEY, text)) || this.storageSet(FALLBACK_BACKUP_KEY, text);
  }

  private storageGet(key: string): string | null {
    try {
      return this.backends.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private storageSet(key: string, value: string): boolean {
    try {
      this.backends.storage?.setItem(key, value);
      return this.backends.storage !== undefined;
    } catch {
      return false;
    }
  }

  private openDatabase(): Promise<IDBDatabase | null> {
    const factory = this.backends.indexedDB;
    if (!factory) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      try {
        const request = factory.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async databaseGet(key: string): Promise<string | null> {
    const db = await this.openDatabase();
    if (!db) {
      return null;
    }
    return new Promise((resolve) => {
      try {
        const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
        request.onsuccess = () => {
          db.close();
          resolve(typeof request.result === 'string' ? request.result : null);
        };
        request.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    });
  }

  private async databasePut(key: string, value: string): Promise<boolean> {
    const db = await this.openDatabase();
    if (!db) {
      return false;
    }
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(value, key);
        transaction.oncomplete = () => {
          db.close();
          resolve(true);
        };
        transaction.onerror = () => {
          db.close();
          resolve(false);
        };
        transaction.onabort = () => {
          db.close();
          resolve(false);
        };
      } catch {
        db.close();
        resolve(false);
      }
    });
  }
}
