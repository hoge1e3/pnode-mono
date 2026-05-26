# pnode-bootloader

Webpack bundle that bootstraps [`petit-node`](../petit-node/README.md) in the browser.  
This package is the runtime glue between the host page, the virtual file system, the ServiceWorker, and the user's boot disk.

## Role in the stack

```
host page (HTML)
  └── pnode-bootloader  (this package, webpack bundle)
        ├── petit-node        — in-browser npm module loader
        ├── @hoge1e3/sfile    — file object API
        └── @hoge1e3/rpc      — postMessage RPC (Worker ↔ page)
```

`pnode-bootloader` is consumed by [`webcartridge`](../webcartridge/README.md) as the boot entry point, but it can also be embedded directly into any page that wants to run a petit-node app.

## Usage

### Build

```bash
npm install
npm run webpack-dev   # development bundle → dist/
```

### Embedding

```js
import { onInitCartridge } from "pnode-bootloader";

onInitCartridge({
    autostart: "My App",   // optional: label of menu entry to click automatically
    main: "myapp",         // optional: set WEBCARTRIDGE_MAIN env var
});
```

`onInitCartridge` registers a `DOMContentLoaded` listener that:

1. Shows a splash screen while loading.
2. Initialises `petit-node` with install/rescue directories.
3. Reads `/package.json` from the virtual FS to build the app menu.
4. Mounts RAM and IndexedDB file systems.
5. Auto-starts the requested menu entry (if `autostart` is set).

### Boot disk helpers

```js
import { networkBoot, insertBootDisk, unzipURL, unzipBlob } from "pnode-bootloader/js/boot.js";

// Download and install a zip from a URL
await networkBoot("https://example.com/myapp.zip");

// Show file-picker UI and install from local zip
insertBootDisk();

// Lower-level helpers
await unzipURL(url, destSFile);
await unzipBlob(blob, destSFile);
```

## Module overview

| File | Description |
|------|-------------|
| `main.js` | Entry point — calls `onInitCartridge`, wires up the UI |
| `boot.js` | Boot disk helpers: `networkBoot`, `insertBootDisk`, `unzipURL`, `unzipBlob` |
| `pnode.js` | `init()` / `getInstance()` wrappers around `petit-node` |
| `fstab.js` | Mount table — reads `fstab` config and mounts RAM/IDB file systems |
| `menu.js` | Renders app menus from `/package.json`, scans for prefetch hints |
| `worker.js` | Worker-side entry — starts RPC server in Worker context |
| `ws-client.js` | WebSocket client for live-reload during development |
| `backup.js` | Backup / restore helpers for the virtual FS |
| `prefetcher.js` | Injects CDN `<script>` tags for prefetching |
| `pwa.js` | PWA install helpers |
| `ui.js` | `showModal`, `splash`, `rmbtn` — UI primitives |
| `global.js` | Typed global state bag |
| `util.js` | DOM helpers |
