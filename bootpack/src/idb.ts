// @hoge1e3/idb
/*global indexedDB*/

export class Idb {
  db: IDBDatabase;
  constructor(db: IDBDatabase) {
    this.db = db;

    // 他の接続がバージョンアップするときは、
    // 自分の接続を閉じてupgradeを妨げないようにする。
    this.db.onversionchange = () => {
      this.db.close();
    };
  }

  /**
   * DBを開く。
   *
   * stores:
   *   作成しておきたいobject storeの名前。
   *
   * 例:
   *   const db = await Idb.open("ipadic", ["k2k", "foo"]);
   *   const k2k = db.table("k2k");
   *   const foo = db.table("foo");
   */
  static open(dbName: string, stores: string[] = []): Promise<Idb> {
    return new Promise<Idb>((resolve, reject) => {
      const requestedStores = [...new Set(stores)];

      const req = indexedDB.open(dbName);

      req.onupgradeneeded = (ev) => {
        const db = (ev.target as IDBOpenDBRequest).result;

        for (const name of requestedStores) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
        }
      };

      req.onsuccess = () => {
        const db = req.result;

        // DBは存在するが、要求されたstoreが足りない場合。
        const missing = requestedStores.filter(
          name => !db.objectStoreNames.contains(name)
        );

        if (missing.length === 0) {
          resolve(new Idb(db));
          return;
        }

        // DBのversionを上げてstoreを追加する。
        const newVersion = db.version + 1;
        db.close();

        const upgradeReq = indexedDB.open(dbName, newVersion);

        upgradeReq.onupgradeneeded = (ev) => {
          const upgradeDb = (ev.target as IDBOpenDBRequest).result;

          for (const name of missing) {
            if (!upgradeDb.objectStoreNames.contains(name)) {
              upgradeDb.createObjectStore(name);
            }
          }
        };

        upgradeReq.onsuccess = () => {
          resolve(new Idb(upgradeReq.result));
        };

        upgradeReq.onerror = () => {
          reject(upgradeReq.error);
        };

        upgradeReq.onblocked = () => {
          reject(new Error(
            `IndexedDB upgrade blocked: ${dbName}`
          ));
        };
      };

      req.onerror = () => {
        reject(req.error);
      };

      req.onblocked = () => {
        reject(new Error(
          `IndexedDB open blocked: ${dbName}`
        ));
      };
    });
  }

  /**
   * object storeを取得する。
   */
  table(name: string): Table {
    if (!this.db.objectStoreNames.contains(name)) {
      throw new Error(`Object store does not exist: ${name}`);
    }

    return new Table(this.db, name);
  }

  /**
   * DBを閉じる。
   */
  close(): void {
    this.db.close();
  }
}


export class Table {
  db: IDBDatabase;
  name: string;
  constructor(db: IDBDatabase, name: string) {
    this.db = db;
    this.name = name;
  }

  putAll(iter: Iterable<[IDBValidKey, any]>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx = this.db.transaction(this.name, "readwrite");
      const store = tx.objectStore(this.name);

      try {
        for (const [key, value] of iter) {
          store.put(value, key);
        }
      } catch (e) {
        reject(e);
        return;
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  put(key: IDBValidKey, value: any): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx = this.db.transaction(this.name, "readwrite");
      const store = tx.objectStore(this.name);
      const req = store.put(value, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  get(key: IDBValidKey): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const tx = this.db.transaction(this.name, "readonly");
      const store = tx.objectStore(this.name);
      const req = store.get(key);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async *keys(): AsyncGenerator<IDBValidKey, void, unknown> {
    const tx = this.db.transaction(this.name, "readonly");
    const store = tx.objectStore(this.name);
    const req = store.getAllKeys();

    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const key of keys) {
      yield key;
    }
  }
  async delete(key: IDBValidKey): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx = this.db.transaction(this.name, "readwrite");
      const store = tx.objectStore(this.name);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
