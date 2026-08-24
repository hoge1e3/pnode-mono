// @hoge1e3/idb
/*global indexedDB*/

export class Idb {
  constructor(db) {
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
  static open(dbName, stores = []) {
    return new Promise((resolve, reject) => {
      const requestedStores = [...new Set(stores)];

      const req = indexedDB.open(dbName);

      req.onupgradeneeded = (ev) => {
        const db = ev.target.result;

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
          const upgradeDb = ev.target.result;

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
  table(name) {
    if (!this.db.objectStoreNames.contains(name)) {
      throw new Error(`Object store does not exist: ${name}`);
    }

    return new Table(this.db, name);
  }

  /**
   * DBを閉じる。
   */
  close() {
    this.db.close();
  }
}


export class Table {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }

  putAll(iter) {
    return new Promise((resolve, reject) => {
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

  put(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.name, "readwrite");
      const store = tx.objectStore(this.name);
      const req = store.put(value, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  get(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.name, "readonly");
      const store = tx.objectStore(this.name);
      const req = store.get(key);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async *keys() {
    const tx = this.db.transaction(this.name, "readonly");
    const store = tx.objectStore(this.name);
    const req = store.getAllKeys();

    const keys = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const key of keys) {
      yield key;
    }
  }
}