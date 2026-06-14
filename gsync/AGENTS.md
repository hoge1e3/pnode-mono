# gsync — Coding Agent Documentation

## Overview

**gsync** (`@acepad/gsync`) is a git-like synchronization tool designed for AcePad, enabling version control and collaborative file synchronization across browsers and servers. It provides a minimal but robust API for cloning repositories, committing changes, and syncing with remote servers.

---

## Project Structure

```
gsync/
├── node/
│   ├── src/
│   │   ├── cmd.ts          # Command-line interface entry point
│   │   ├── sync.ts         # Core sync engine and SyncFactory
│   │   ├── git.ts          # Git object model and Repo class
│   │   ├── index_file.ts   # Index/staging area management
│   │   ├── objects.ts      # Object store (blobs, trees, commits)
│   │   ├── types.ts        # Type-safe branded types
│   │   ├── codec.ts        # Serialization/deserialization
│   │   ├── webapi.ts       # HTTP client for server communication
│   │   ├── constants.ts    # Magic strings (.gsync, .gitignore, etc.)
│   │   ├── util.ts         # Utility functions
│   │   ├── path_typed.ts   # Path handling utilities
│   │   └── splash.ts       # Welcome/help text
│   ├── test/
│   │   ├── test.ts         # Core functionality tests
│   │   ├── test2.ts        # Additional unit tests
│   │   ├── test-index.ts   # Index file tests
│   │   └── test-branch-merge.ts # Branch and merge tests
│   └── bin.js              # CLI executable wrapper
└── package.json            # npm package metadata
```

---

## Key Types

All types use TypeScript's branded types pattern for compile-time safety without runtime overhead:

### Path Types
- **`FilePath`**: Absolute or relative file system path
- **`PathInRepo`**: Path relative to repository root (always uses `/` separator)
- **`BranchName`**: Git branch name (e.g., `"main"`, `"feature/auth"`)

### Git Objects
- **`Hash`**: 40-character SHA1 hash (must match `/^[0-9a-f]{40}$/`)
- **`Mode`**: File permission ("40000" for dir, "100644" for file, "120000" for symlink)
- **`PHPTimestamp`**: Unix timestamp (used for server communication)

### API Types
- **`APIConfig`**: `{ serverUrl, repoId, apiKey }`
- **`SyncStatus`**: `"auto_merged" | "no_changes" | "newly_pushed" | "pushed" | "pulled" | PathInRepo[]`
- **`IgnoreState`**: `"none" | "max_mtime" | "all"` (controls which files to sync)

---

## Core APIs

### Command Interface (`cmd.ts`)

Entry point: `main(cwd, argv)`

**Supported commands:**

| Command | Args | Description |
|---------|------|-------------|
| `clone` | `<serverUrl> <repoId> [branch]` | Clone entire repo with checkout |
| `clone_nocheckout` | `<serverUrl> <repoId> [branch]` | Clone without working directory checkout |
| `clone_overwrite` | `<serverUrl> <repoId> [branch]` | Clone, overwriting existing files |
| `init` | `<serverUrl>` | Initialize new repository (empty local) |
| `commit` | — | Stage and commit all changes (interactive mode) |
| `sync` | — | Full sync (push+pull) with merge conflict detection |
| `newer` | — | Only pull newer commits (no push) |
| `log` | `[--verbose]` | Show commit history |
| `branch` | `[list/create/switch]` | Manage branches |

### Sync Engine (`sync.ts`)

```typescript
class SyncFactory {
  constructor(gitDir: FilePath) { }
  
  async readConfig(): Promise<APIConfig>          // Load config from .gsync/remote.conf
  async writeConfig(conf: APIConfig): Promise<void>
  async init(serverUrl: string): Promise<Sync>    // Initialize new repo
  async load(): Promise<Sync>                     // Load existing repo
}

class Sync {
  async sync(policy?: ConflictResolutionPolicy): Promise<SyncStatus>  // Full sync
  async commit(message: string, author: Author): Promise<Hash>       // Create commit
  async pull(): Promise<SyncStatus>               // Fetch + merge remote changes
  async push(): Promise<SyncStatus>               // Upload local commits
  async getCurrentBranch(): Promise<BranchName>   // Get active branch
  async getBranches(): Promise<BranchName[]>      // List all branches
}
```

### Git Model (`git.ts`)

```typescript
class Repo {
  async readTree(hash: Hash): Promise<TreeEntry[]>        // Read tree object
  async readBlob(hash: Hash): Promise<Uint8Array>         // Read blob (file content)
  async readCommit(hash: Hash): Promise<CommitEntry>      // Read commit metadata
  async writeBlob(data: Uint8Array): Promise<Hash>        // Write blob
  async writeTree(entries: TreeEntry[]): Promise<Hash>    // Write tree
  async writeCommit(...): Promise<Hash>                   // Write commit
}
```

### Index File (`index_file.ts`)

Manages staging area (similar to `.git/index`):

```typescript
class Index {
  async readIndex(): Promise<IndexEntry[]>        // Read staged files
  async writeIndex(entries: IndexEntry[]): Promise<void>
  async computeDiff(repoRoot: FilePath): Promise<Change[]>  // Compare working tree to index
}
```

---

## Development Workflow

### Setup
```bash
cd gsync/node
npm install
npm run build
npm run test
```

### Building

**TypeScript compilation only:**
```bash
npm run tsc
```
Output: `js/src/*.js` and `js/test/*.js`

**Run tests:**
```bash
npm run test
# Runs: tsc + test2.js + test-index.js + test-branch-merge.js
```

### File Conventions

1. **Shebang lines** (`#!/bin/bash`, `#!run`): Must be preserved in output
2. **ESM modules**: All TypeScript files must use ES2020+ import/export
3. **Branded types**: Use provided validation functions (`isHash()`, `asFilePath()`, etc.)
4. **Error handling**: Throw descriptive errors; avoid silent failures

---

## Key Patterns

### Type Safety via Branded Types

Instead of plain strings, gsync uses TypeScript's structural typing with symbols:

```typescript
export type Hash = string & { [SymHash]: undefined };
export function asHash(s: string) {
  if (!isHash(s)) throw new Error(`${s} is not a hash`);
  return s as Hash;
}
```

**Rule**: Always validate user input with `asHash()`, `asFilePath()`, etc. before using as typed value.

### Object Store Pattern

Files are stored as git objects (blobs, trees, commits):
- **Blobs**: Raw file content (`Uint8Array`)
- **Trees**: Directory listings (entries with hash + mode)
- **Commits**: Metadata (author, message, tree hash, parent hash)

Store is abstraction-based: `FileBasedObjectStore` (Node.js filesystem) or browser-compatible variant.

### Conflict Resolution

When local and remote branches diverge:

```typescript
type ConflictResolutionPolicy = {
  acceptLocal?: boolean;      // Keep local changes
  acceptRemote?: boolean;     // Take remote changes
  manual?: (conflicts: PathInRepo[]) => Promise<void>;  // Custom resolution
};
```

Conflicted paths are returned in `SyncStatus` array for manual intervention.

---

## Common Tasks for Agents

### Adding a New Command

1. Add case in `cmd.ts` switch statement
2. Implement handler function (follow `clone()`, `commit()` pattern)
3. Add corresponding method to `Sync` class if needed
4. Add test in `test/*.ts`

### Modifying Sync Logic

- Core algorithm: `sync()` in `sync.ts`
- Conflict detection: happens during merge in `git.ts`
- Object storage: implement new `ObjectStore` for alternate backends

### Extending Type System

1. Define branded type in `types.ts`
2. Add validation function (`isX()` and `asX()`)
3. Use in function signatures for compile-time safety

### Debugging

Enable verbose output:
```typescript
// In sync.ts, top of file:
let verbose = true;  // Log all object reads/writes
```

---

## Important Constraints

1. **Circular dependencies prohibited**: Respect the import graph (types → utils → core classes)
2. **Node.js API only**: No DOM/browser APIs in core `sync.ts`, `git.ts`, `objects.ts` (must remain isomorphic)
3. **Immutable types**: Commit hashes, tree entries are never mutated in-place (always create new objects)
4. **Server protocol**: HTTP-based (see `webapi.ts` for implementation details)

---

## Testing Strategy

- Unit tests in `test/*.ts` compiled to `js/test/*.ts`
- Run with `npm run test`
- Covers:
  - Index file reading/writing
  - Git object model (blobs, trees, commits)
  - Branch operations
  - Merge conflict detection

**Important**: Tests are run via Node.js CLI, not in browser. Use `@types/node` APIs freely in tests.

---

## References

- `.gsync/` directory structure: See `constants.ts` for file paths
- Remote config format: `REMOTE_CONF_FILE` in constants
- Server API: `PHPClientFactory` in `webapi.ts` (HTTP endpoints)
- Ignore patterns: Uses `ignore` npm package (`.gitignore` compatible)

---

## Performance Notes

1. **Object store caching**: Object lookups are cached in-memory; invalidate when writing
2. **Index file parsing**: Synchronous read of `index` file; keep small for performance
3. **Tree diffing**: O(n) per sync; complex tree structures may be slow
4. **Blob streaming**: Large files (>10MB) should use chunked reads

---

## Common Pitfalls

- ❌ Using plain string instead of branded type → compile error (good!)
- ❌ Forgetting to validate hash input → runtime error in object store
- ❌ Mutating commit entries in-place → breaks hash consistency
- ❌ Blocking on network I/O synchronously → hangs the UI (browser mode)
- ❌ Missing test case for new command → merge conflicts later

---

## Related Projects

- **pnode-mono**: Parent monorepo; see `AGENTS.md` for build system and workspace layout
- **AcePad**: Frontend editor consuming gsync; see documentation for integration points
