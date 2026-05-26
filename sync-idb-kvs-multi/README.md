# sync-idb-kvs-multi

Multi-context synchronous IndexedDB Key-Value Store — extends [`sync-idb-kvs`](../sync-idb-kvs/README.md) so that changes made in one Worker are immediately visible in all other Workers and the main thread.

## Motivation

`sync-idb-kvs` keeps a memory cache of IndexedDB data for synchronous access, but the cache is per-context.  
`sync-idb-kvs-multi` adds a `BroadcastChannel` layer on top so that every `setItem` / `removeItem` in any context is propagated to all other instances holding the same database.

## Install

```bash
npm install sync-idb-kvs-multi
```

## Quick start

```ts
import { MultiSyncIDBStorage } from "sync-idb-kvs-multi";

// Create — async initialisation (same as sync-idb-kvs)
const store = await MultiSyncIDBStorage.create<string>("myDB", {});

// Synchronous read/write
store.setItem("key", "value");   // written to IDB + broadcast to other contexts
console.log(store.getItem("key")); // "value"
store.removeItem("key");

// Listen for changes coming from OTHER contexts
store.addEventListener("change", (e) => {
    console.log(e.key, e.value, e.oldValue);
});
```

## API

```ts
class MultiSyncIDBStorage<T> implements IStorage<T> {
    /** Async factory — creates storage and loads all IDB data into memory */
    static async create<T>(
        dbName: string,
        initialData: Record<string, T>,
        opt?: SyncIDBStorageOptions
    ): Promise<MultiSyncIDBStorage<T>>;

    /** Synchronous localStorage-like interface */
    getItem(key: string): T | null;
    setItem(key: string, value: T): void;   // also broadcasts to other contexts
    removeItem(key: string): void;          // also broadcasts to other contexts
    itemExists(key: string): boolean;
    keys(): IterableIterator<string>;

    /** Fired when another context changes a key */
    addEventListener(type: "change", callback: (e: ChangeEvent<T>) => void): void;
    removeEventListener(callback: (e: ChangeEvent<T>) => void): void;

    /** Re-fetch a single key from IDB (useful after another context wrote directly) */
    reload(key: string): Promise<T | null>;

    /** Resolves when all pending writes have been committed to IDB */
    waitForCommit(): Promise<void>;

    /** Name of the underlying BroadcastChannel */
    channelName: string;
}

type ChangeEvent<T> = {
    key: string;
    value: T | null;
    oldValue: T | null;
};
```

## How it works

1. On `create()`, all IDB data is loaded into an in-memory cache (via `sync-idb-kvs`).
2. A `BroadcastChannel` is opened with the same name as the IDB store.
3. Every `setItem` / `removeItem` call writes to IDB **and** posts a message on the channel.
4. Other instances receive the message and update their own memory cache synchronously, then fire `change` listeners.

## Build & test

```bash
npm install
npm run tsc          # compile TypeScript
npm run webpack-dev  # bundle (development)
npm test             # opens test/index.html via http-server
```
