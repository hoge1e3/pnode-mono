import { IStorage, SyncIDBStorage, SyncIDBStorageOptions } from "sync-idb-kvs";
import { ChangeEvent, ChangeEventTrait } from "./changeEvent.js";

export type BroadCastEvent<T> = MessageEvent<
  | {
      type: "set";
      key: string;
      value: T;
    }
  | {
      type: "remove";
      key: string;
    }
>;

// T is the type of value
export class MultiSyncIDBStorage<T> implements IStorage<T> {
  storageType: string = "idb";
  private storage: SyncIDBStorage<T>;
  private channel: BroadcastChannel;
  channelName: string;
  changeEventTrait=new ChangeEventTrait<T>(this);
  // Only receives updates from other workers
  addEventListener(type: "change", callback: (e: ChangeEvent<T>) => void): void {
    this.changeEventTrait.addEventListener(type, callback);
  }
  removeEventListener(callback: (e: ChangeEvent<T>)=>void): void {
    this.changeEventTrait.removeEventListener(callback);
  }
  static async create<T>(dbName:string, 
      initialData:Record<string, T>,
      opt={} as SyncIDBStorageOptions): Promise<MultiSyncIDBStorage<T>> {
        const s=await SyncIDBStorage.create<T>(dbName, initialData,opt);
        return new MultiSyncIDBStorage<T>(s);
  }
  async waitForCommit() {
    return await this.storage.waitForCommit();
  }
  constructor(storage: SyncIDBStorage<T>) {
    this.storage = storage;
    this.channelName=storage.channelName;
    this.channel = new BroadcastChannel(this.channelName);
    
    storage.memoryCacheEnabledPromise.
    then(() => {
      console.log("BroadcastChannel activated",this.channelName)
      // 他のワーカーからの更新通知を受け取る
      this.channel.onmessage = (event:BroadCastEvent<T>) => {
        if (event.data.type === "set") {
          const { type, key, value } = event.data;
          const oldValue=this.storage.memoryCache[key];
          this.storage.memoryCache[key] = value;
          this.changeEventTrait.notifyListeners(key, value ?? null, oldValue ?? null);
        } else if (event.data.type === "remove") {
          const { type, key} = event.data;
          const oldValue=this.storage.memoryCache[key];
          this.storage.memoryCache[key]=null;
          this.changeEventTrait.notifyListeners(key, null, oldValue ?? null);
        }
    }});
  }

  getItem(key: string): T | null {
    return this.storage.getItem(key);
  }

  setItem(key: string, value: T): void {
    this.storage.setItem(key, value);
    this.channel.postMessage({ type: "set", key, value });
  }

  removeItem(key: string): void {
    this.storage.removeItem(key);
    this.channel.postMessage({ type: "remove", key });
  }

  itemExists(key: string): boolean {
    return this.storage.itemExists(key);
  }

  keys(): IterableIterator<string> {
    return this.storage.keys();
  }

  async reload(key: string): Promise<T | null> {
    return this.storage.reload(key);
  }
}
