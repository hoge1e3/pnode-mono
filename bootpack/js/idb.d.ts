export declare class Idb {
    db: IDBDatabase;
    constructor(db: IDBDatabase);
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
    static open(dbName: string, stores?: string[]): Promise<Idb>;
    /**
     * object storeを取得する。
     */
    table(name: string): Table;
    /**
     * DBを閉じる。
     */
    close(): void;
}
export declare class Table {
    db: IDBDatabase;
    name: string;
    constructor(db: IDBDatabase, name: string);
    putAll(iter: Iterable<[IDBValidKey, any]>): Promise<void>;
    put(key: IDBValidKey, value: any): Promise<void>;
    get(key: IDBValidKey): Promise<any>;
    keys(): AsyncGenerator<IDBValidKey, void, unknown>;
    delete(key: IDBValidKey): Promise<void>;
}
