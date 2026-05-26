# pnode-mono

Browser-first Node.js emulation environment — a monorepo containing packages that together form a complete in-browser module loading and file system stack, plus the server tooling needed to develop and serve it.

## Architecture overview

```
┌─────────────────────────────────────────────┐
│              petit-node                     │  npm-compatible module loader (browser)
│         pnode-bootloader                    │  webpack bundle that boots petit-node
├─────────────────────────────────────────────┤
│               @hoge1e3/fs2                  │  unified FS façade (browser + node)
│    petit-fs          @hoge1e3/sfile         │  virtual FS (browser) / FS wrapper (node)
│  sync-idb-kvs   sync-idb-kvs-multi         │  synchronous IndexedDB KV store
├─────────────────────────────────────────────┤
│  @hoge1e3/rpc   @hoge1e3/content  @hoge1e3/url  webcartridge │  utilities
└─────────────────────────────────────────────┘
```

## Packages

| Package | npm name | Description |
|---------|----------|-------------|
| [petit-node](./petit-node/README.md) | `petit-node` | Browser-native npm-compatible module loader |
| [bootpack](./bootpack/README.md) | `pnode-bootloader` | Webpack bundle that bootstraps petit-node |
| [petit-fs](./petit-fs/README.md) | `petit-fs` | `node:fs`-compatible virtual file system backed by localStorage / IndexedDB |
| [sfile](./sfile/README.md) | `@hoge1e3/sfile` | Object-oriented file wrapper around `node:fs` |
| [fs2](./fs2/README.md) | `@hoge1e3/fs2` | Unified façade combining `petit-fs` (browser) and `@hoge1e3/sfile` (node) |
| [sync-idb-kvs](./sync-idb-kvs/README.md) | `sync-idb-kvs` | Synchronous IndexedDB KV store with async initialisation |
| [sync-idb-kvs-multi](./sync-idb-kvs-multi/README.md) | `sync-idb-kvs-multi` | Multi-context (Worker-shareable) variant of `sync-idb-kvs` |
| [rpc](./rpc/README.md) | `@hoge1e3/rpc` | Proxy-style RPC over `postMessage` for Workers and iframes |
| [content](./content/README.md) | `@hoge1e3/content` | Converts between ArrayBuffer / Uint8Array / Buffer / plain text / data URL |
| [node-url](./node-url/README.md) | `@hoge1e3/url` | Node.js `url` module ported for browsers (adds `pathToFileURL`) |
| [webcartridge](./webcartridge/README.md) | `webcartridge` | ServiceWorker-based "web cartridge" for user-controlled content delivery |

## Setup

```bash
npm i
node clone_acepad.mjs   # clone ./idb/run and hoge1e3.github.io
npm i                   # re-install after cloning
npm run build-dev       # compile TypeScript + webpack (development mode)
npm run gio      # Copy to hoge1e3.github.io(*)
```

## Useful scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Production build (tsc + webpack) across all workspaces |
| `npm run build-dev` | Development build across all workspaces |
| `npm run test` | Run `petit-node` tests |
| `npm run sync` | Git-sync all sub-repos (`gitsync_all.mjs`) |
| `npm run verup` | Version bump + publish to npm |
| `npm run ver-conflict` | Find version conflicts across workspaces |
| `npm run gio` | Copy build output to `hoge1e3.github.io` |
| `npm run bio` | `build-dev` + `gio` in one step |

## Dependency graph (simplified)

```
petit-node
  └── @hoge1e3/fs2
        ├── petit-fs
        │     └── sync-idb-kvs-multi
        │           └── sync-idb-kvs
        └── @hoge1e3/sfile
              └── @hoge1e3/content
  └── @hoge1e3/url
  └── @hoge1e3/rpc

pnode-bootloader
  ├── petit-node
  ├── @hoge1e3/sfile
  └── @hoge1e3/rpc
```

## License

Each package carries its own license (MIT or ISC — see individual `package.json` files).
