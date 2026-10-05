import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { MessageMeta, SenderOverride } from '../core/types';

interface MailSortDB extends DBSchema {
  messages: { key: string; value: MessageMeta };
  overrides: { key: string; value: SenderOverride };
  kv: { key: string; value: unknown };
}

/**
 * Cache local (IndexedDB) : métadonnées des mails, choix de l'utilisateur
 * (catégories, autorisés/bloqués) et réglages. Une base par compte.
 */
export class LocalStore {
  private constructor(private readonly db: IDBPDatabase<MailSortDB>) {}

  static async open(account: string): Promise<LocalStore> {
    const db = await openDB<MailSortDB>(`mailsort:${account}`, 1, {
      upgrade(db) {
        db.createObjectStore('messages', { keyPath: 'id' });
        db.createObjectStore('overrides', { keyPath: 'key' });
        db.createObjectStore('kv');
      },
    });
    return new LocalStore(db);
  }

  static async destroy(account: string): Promise<void> {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(`mailsort:${account}`);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  }

  close() {
    this.db.close();
  }

  getAllMessages() {
    return this.db.getAll('messages');
  }

  async putMessages(messages: MessageMeta[]) {
    const tx = this.db.transaction('messages', 'readwrite');
    await Promise.all([...messages.map((m) => tx.store.put(m)), tx.done]);
  }

  async deleteMessages(ids: string[]) {
    const tx = this.db.transaction('messages', 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  }

  getAllOverrides() {
    return this.db.getAll('overrides');
  }

  putOverride(o: SenderOverride) {
    return this.db.put('overrides', o);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return (await this.db.get('kv', key)) as T | undefined;
  }

  set(key: string, value: unknown) {
    return this.db.put('kv', value, key);
  }

  async clearMessages() {
    await this.db.clear('messages');
  }
}
