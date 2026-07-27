import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistence port. The app never talks to a storage engine directly, so the
 * local adapter can be replaced by a Supabase-backed one without touching any
 * feature code.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const asyncStorageAdapter: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

/** In-memory adapter used by tests and by the web preview. */
export function createMemoryAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    async getItem(key) {
      return store.get(key) ?? null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
    async removeItem(key) {
      store.delete(key);
    },
  };
}

export const STORAGE_KEY = 'comeback.state.v1';
