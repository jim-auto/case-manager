/**
 * IndexedDB layer for Case Manager
 *
 * Schema (object store: "contacts"):
 *   id          – auto-increment primary key
 *   name        – string  (indexed)
 *   contactId   – string  (LINE ID, email, etc.)
 *   lastContact – string  (ISO 8601 date, indexed for sorting)
 *   memo        – string
 *   tags        – string[] (multi-entry index for filtering)
 *   createdAt   – string  (ISO 8601)
 *   updatedAt   – string  (ISO 8601)
 */

const DB_NAME = 'case-manager';
const DB_VERSION = 1;
const STORE_NAME = 'contacts';

/** @type {IDBDatabase | null} */
let _db = null;

/**
 * Open (or create) the database. Returns a cached connection on subsequent calls.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('lastContact', 'lastContact', { unique: false });
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Add a new contact entry.
 * @param {{ name: string, contactId?: string, lastContact?: string, memo?: string, tags?: string[] }} entry
 * @returns {Promise<number>} The auto-generated id
 */
export async function addEntry(entry) {
  const db = await openDB();
  const now = new Date().toISOString();

  const record = {
    name: entry.name,
    contactId: entry.contactId ?? '',
    lastContact: entry.lastContact ?? '',
    memo: entry.memo ?? '',
    tags: entry.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all contacts, ordered by lastContact descending (most recent first).
 * @returns {Promise<object[]>}
 */
export async function getAllEntries() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const entries = req.result.sort(
        (a, b) => (b.lastContact || '').localeCompare(a.lastContact || '')
      );
      resolve(entries);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get a single contact by id.
 * @param {number} id
 * @returns {Promise<object|undefined>}
 */
export async function getEntry(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Update an existing contact. Merges provided fields with the existing record.
 * @param {number} id
 * @param {Partial<{ name: string, contactId: string, lastContact: string, memo: string, tags: string[] }>} updates
 * @returns {Promise<void>}
 */
export async function updateEntry(id, updates) {
  const existing = await getEntry(id);
  if (!existing) throw new Error(`Entry ${id} not found`);

  const record = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(record);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Delete a contact by id.
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteEntry(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all contacts that have a specific tag.
 * @param {string} tag
 * @returns {Promise<object[]>}
 */
export async function getEntriesByTag(tag) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('tags');
    const req = index.getAll(tag);

    req.onsuccess = () => {
      const entries = req.result.sort(
        (a, b) => (b.lastContact || '').localeCompare(a.lastContact || '')
      );
      resolve(entries);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all unique tags currently in use.
 * @returns {Promise<string[]>}
 */
export async function getAllTags() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('tags');
    const tags = new Set();
    const cursor = index.openKeyCursor();

    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (c) {
        tags.add(c.key);
        c.continue();
      } else {
        resolve([...tags].sort());
      }
    };
    cursor.onerror = (e) => reject(e.target.error);
  });
}
