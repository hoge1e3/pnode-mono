# webcartridge

A ServiceWorker-based "web cartridge" host.  
Instead of a website bundling its own content, the user supplies a **boot disk** (a zip file containing a `package.json` + entry point) that is served entirely through the ServiceWorker cache — no server required after the initial load.

## Concept

```
User's browser
  ├── webcartridge (this package) — ServiceWorker + host shell
  └── "cartridge" (user-supplied zip)
        ├── package.json   { "menus": { "My App": { "main": "index.js" } } }
        └── index.js       (any petit-node compatible app)
```

The host shell installs the ServiceWorker, lets the user upload or download a boot disk zip, and then boots `petit-node` from the cartridge's entry point.

## Usage

### Building

```bash
npm install
npm run tsc          # compile TypeScript → js/
npm run webpack-dev  # bundle for development
npm run webpack      # bundle for production
```

### Embedding in a page

`pnode-bootloader` consumes webcartridge internally.  
If you want to use it standalone, point a `<script type="module">` at the webpack output and call `onInitCartridge(opt)`:

```js
import { onInitCartridge } from "pnode-bootloader";

onInitCartridge({
    main: "myapp",      // menu label to auto-start
    autostart: "myapp"
});
```

### Boot disk format

A boot disk is a zip file with the following structure:

```
boot/
  package.json    { "menus": { "<label>": { "main": "<entry>" } } }
  <entry>.js      (ES module, runs inside petit-node)
```

The ServiceWorker serves the extracted files as if they were static assets at the cartridge's scope origin.

## Architecture

| Module | Responsibility |
|--------|---------------|
| `sw.ts` | ServiceWorker — caching, `BroadcastChannel`-style message dispatch, blob serving (`serve_blob` / `unserve_blob`), custom URL handlers |
| `cartridges.ts` | Read/write the root `boot/package.json` (menu registry), serve uploaded blobs, handle boot disk insertion |
| `main.ts` | Entry point — boots petit-node, installs PWA, prefetches CDN libraries (Ace editor, vConsole, jQuery) |
| `pwa.ts` | PWA install helpers, `fetchServed` / `serveBlob` wrappers |
| `menu.ts` | Render and manage the app menu from `package.json` |
| `prefetcher.ts` | Dynamic `<script>` injection for CDN prefetch |
| `util.ts` | DOM helpers, environment variable access |
| `global.ts` | Typed global state bag |

## ServiceWorker message types

The ServiceWorker responds to `postMessage` with the following `type` values:

| type | Description |
|------|-------------|
| `serve_blob` | Store a `Blob` in the SW cache at a given URL |
| `unserve_blob` | Remove a previously served blob |
| `list_blob` | List all cached URLs |
| `serve` | Register a custom URL path handler (delegated back to the page) |
| `EVAL` | Evaluate a script string inside the SW (debug) |
| `CACHE_NAME` | Return the current cache version name |
