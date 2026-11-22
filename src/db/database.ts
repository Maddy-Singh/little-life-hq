export const DB_NAME = 'little_life_hq_db';
export const DB_VERSION = 1;

export const STORE_NAMES = [
  'goals',
  'goal_weekly_checkins',
  'weekly_reviews',
  'subjects',
  'assignments',
  'attendance_records',
  'timetable_events',
  'timetable_exceptions',
  'internship_applications',
  'activities',
  'habits',
  'habit_logs',
  'settings',
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of STORE_NAMES) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, {keyPath: 'id'});
          if (storeName === 'goal_weekly_checkins') {
            store.createIndex('by_goalId', 'goalId', {unique: false});
            store.createIndex('by_weekStart', 'weekStart', {unique: false});
          } else if (storeName === 'assignments') {
            store.createIndex('by_subjectId', 'subjectId', {unique: false});
            store.createIndex('by_dueDate', 'dueDate', {unique: false});
          } else if (storeName === 'attendance_records') {
            store.createIndex('by_subjectId', 'subjectId', {unique: false});
          } else if (storeName === 'timetable_exceptions') {
            store.createIndex('by_eventId', 'eventId', {unique: false});
          } else if (storeName === 'habit_logs') {
            store.createIndex('by_habitId', 'habitId', {unique: false});
            store.createIndex('by_date', 'date', {unique: false});
          }
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('Failed to open IndexedDB database.'));
    };
  });

  return dbPromise;
}

export async function getAllRecords<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error(`Failed reading ${storeName}`));
  });
}

export async function getRecordById<T>(storeName: StoreName, id: string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error ?? new Error(`Failed getting record from ${storeName}`));
  });
}

export async function putRecord<T>(storeName: StoreName, record: T): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error ?? new Error(`Failed saving record to ${storeName}`));
  });
}

export async function putManyRecords<T>(storeName: StoreName, records: T[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const record of records) {
      store.put(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`Failed saving batch to ${storeName}`));
  });
}

export async function deleteRecord(storeName: StoreName, id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`Failed deleting record from ${storeName}`));
  });
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`Failed clearing ${storeName}`));
  });
}

export async function clearAllStores(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...STORE_NAMES], 'readwrite');
    for (const name of STORE_NAMES) {
      tx.objectStore(name).clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed clearing all stores'));
  });
}

export async function replaceAllStoresTransactional(
  recordsByStore: Record<StoreName, unknown[]>
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const tx = db.transaction([...STORE_NAMES], 'readwrite');
    tx.oncomplete = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    tx.onerror = () => fail(tx.error ?? new Error('Transactional replace failed.'));
    tx.onabort = () => fail(tx.error ?? new Error('Transactional replace was aborted.'));

    try {
      for (const name of STORE_NAMES) {
        const store = tx.objectStore(name);
        store.clear();
        const items = recordsByStore[name] ?? [];
        for (const item of items) {
          store.put(item);
        }
      }
    } catch (err) {
      try {
        tx.abort();
      } catch {
        // Ignore if transaction already aborted
      }
      fail(err);
    }
  });
}

export async function closeDatabaseConnection(): Promise<void> {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    db.close();
  } catch {
    // Ignore errors when closing
  } finally {
    dbPromise = null;
  }
}

export async function areAllStoresEmpty(): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([...STORE_NAMES], 'readonly');
    const counts = STORE_NAMES.map((name) =>
      tx.objectStore(name).count()
    );

    tx.oncomplete = () => {
      resolve(counts.every((request) => request.result === 0));
    };

    tx.onerror = () => {
      reject(tx.error ?? new Error('Could not check database contents.'));
    };

    tx.onabort = () => {
      reject(tx.error ?? new Error('Database check was aborted.'));
    };
  });
}
