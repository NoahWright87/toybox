export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key); }
    catch { return null; }
  }

  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); }
    catch (e) { console.warn("[FS] Storage quota exceeded", e); }
  }

  removeItem(key: string): void {
    try { localStorage.removeItem(key); }
    catch { /* silent */ }
  }
}
