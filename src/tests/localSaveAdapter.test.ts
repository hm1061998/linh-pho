import { describe, expect, it } from 'vitest';
import { LocalSaveAdapter } from '../adapters/LocalSaveAdapter';

/** An in-memory stand-in for localStorage. */
function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

/** An IndexedDB factory whose database never opens, the way some private windows behave. */
function failingIndexedDb(): IDBFactory {
  return {
    open: () => {
      const request: { onerror?: () => void; onsuccess?: () => void } = {};
      setTimeout(() => request.onerror?.(), 0);
      return request as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;
}

describe('LocalSaveAdapter', () => {
  it('reports that nothing is stored, and that writes failed, when no backend exists', async () => {
    const adapter = new LocalSaveAdapter({});
    expect(await adapter.read()).toBeNull();
    expect(await adapter.write('{"version":1}')).toBe(false);
    expect(await adapter.writeBackup('bad')).toBe(false);
  });

  it('stores and reads the save through localStorage when IndexedDB is missing', async () => {
    const storage = memoryStorage();
    const adapter = new LocalSaveAdapter({ storage });
    expect(await adapter.write('{"version":1,"coins":30}')).toBe(true);
    expect(await adapter.read()).toBe('{"version":1,"coins":30}');
  });

  it('keeps the backup under its own key, so a backup never overwrites the save', async () => {
    const storage = memoryStorage();
    const adapter = new LocalSaveAdapter({ storage });
    await adapter.write('good save');
    expect(await adapter.writeBackup('unreadable save')).toBe(true);
    expect(await adapter.read()).toBe('good save');
    expect([...storage.map.values()]).toContain('unreadable save');
  });

  it('falls back to localStorage when IndexedDB refuses to open', async () => {
    const storage = memoryStorage();
    const adapter = new LocalSaveAdapter({ indexedDB: failingIndexedDb(), storage });
    expect(await adapter.write('saved anyway')).toBe(true);
    expect(await adapter.read()).toBe('saved anyway');
  });

  it('reports a failed write when the storage is full, and does not throw', async () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const adapter = new LocalSaveAdapter({ storage });
    expect(await adapter.write('too big')).toBe(false);
  });

  it('treats a storage that cannot be read as nothing stored', async () => {
    const storage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
    };
    const adapter = new LocalSaveAdapter({ storage });
    expect(await adapter.read()).toBeNull();
  });
});
