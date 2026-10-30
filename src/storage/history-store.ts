import type { HistoryEntry } from "../domain/history-entry";

const databaseVersion = 1;
const objectStoreName = "entries";
const defaultDatabaseName = "mathematical-instrument-history";

export interface HistoryStore {
  list(): Promise<HistoryEntry[]>;
  add(entry: HistoryEntry): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, databaseVersion);
    let settled = false;

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(objectStoreName)) {
        database.createObjectStore(objectStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
    request.onerror = () => {
      if (!settled) {
        settled = true;
        reject(request.error ?? new Error("Не удалось открыть локальную историю."));
      }
    };
    request.onblocked = () => {
      if (!settled) {
        settled = true;
        reject(new Error("База истории занята другой вкладкой. Закройте её и попробуйте снова."));
      }
    };
  });
}

export function createHistoryStore(name = defaultDatabaseName): HistoryStore {
  const database = openDatabase(name);

  function transact<T>(
    mode: IDBTransactionMode,
    createRequest: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return database.then((db) => new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(objectStoreName, mode);
      let requestComplete = false;
      let transactionComplete = false;
      let result: T;
      let settled = false;

      const resolveWhenComplete = () => {
        if (!settled && requestComplete && transactionComplete) {
          settled = true;
          resolve(result);
        }
      };
      const rejectOnce = (error: DOMException | Error | null) => {
        if (!settled) {
          settled = true;
          reject(error ?? new Error("Не удалось сохранить локальную историю."));
        }
      };

      let request: IDBRequest<T>;
      try {
        request = createRequest(transaction.objectStore(objectStoreName));
      } catch (error) {
        transaction.abort();
        rejectOnce(error instanceof Error ? error : new Error("Не удалось выполнить операцию с историей."));
        return;
      }

      request.onsuccess = () => {
        result = request.result;
        requestComplete = true;
        resolveWhenComplete();
      };
      request.onerror = () => rejectOnce(request.error);
      transaction.oncomplete = () => {
        transactionComplete = true;
        resolveWhenComplete();
      };
      transaction.onabort = () => rejectOnce(transaction.error);
      transaction.onerror = () => rejectOnce(transaction.error);
    }));
  }

  return {
    list: async () => {
      const entries = await transact("readonly", (store) => store.getAll());
      return entries.sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
    },
    add: async (entry) => {
      await transact("readwrite", (store) => store.put(entry));
    },
    delete: async (id) => {
      await transact("readwrite", (store) => store.delete(id));
    },
    clear: async () => {
      await transact("readwrite", (store) => store.clear());
    },
    close: async () => {
      (await database).close();
    },
  };
}

export const historyStore = createHistoryStore();
