export declare function factoryReset(): Promise<void>;
export declare function fullBackup(): Promise<void>;
export declare function removeAllFromIDB(dbName: string): Promise<void>;
export declare function fullRestore(arrayBuf: ArrayBuffer): Promise<void>;
