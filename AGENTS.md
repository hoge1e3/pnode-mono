# AGENTS.md — pnode-mono

## プロジェクト概要

ブラウザ上で Node.js 互換の実行環境を実現するモノレポ。  
中核は `petit-node`（ブラウザ内 npm モジュールローダー）と、それを支えるファイルシステム・RPC・コンテンツ変換レイヤーから成る。

詳細は [README.md](./README.md) および各パッケージの README を参照。

## 開発環境

Windows上ではmsys(mingw)。Linuxでも多分動作する。
---

## モノレポ構成

npm workspaces を使用。ルートの `package.json` の `workspaces` フィールドが正式なパッケージ一覧。

```
rpc / node-url / content / sync-idb-kvs / sync-idb-kvs-multi /
petit-fs / sfile / fs2 / petit-node / bootpack / webcartridge
```

各パッケージは独自の `tsconfig.json` + `webpack.config.cjs` を持つ。

---
## ワークツリー不使用

ワークツリーは使用せず直接書き換えてよい。

## ビルド

ビルドは手動で行うので、ソースコードの変更だけ行うこと。以下は人間用のメモ。

tscはnode_modulesに入っているバージョン（5.9.3）を使用。
### 全パッケージ一括

```bash
npm run build-dev   # tsc + webpack (development) — 通常はこちら
npm run build       # tsc + webpack (production) ー まだデバッグ段階なのでプロダクト版は当分作らない
```
### 個別パッケージ

```bash
cd <package-dir>
npm run tsc         # TypeScript コンパイルのみ
npm run webpack-dev # webpack のみ (development)
```

### 出力先

| パッケージ | 出力 |
|-----------|------|
| `bootpack` | `bootpack/dist/index.js` |
| `webcartridge` | `webcartridge/dist/webcartridge.js` |
| その他 | 各パッケージ内 `js/` または `src/` (tsc のみ、webpack なし) |

### GitHub Pages への反映

```bash
npm run gio   # dist を hoge1e3.github.io/acepad/ へコピー
npm run bio   # build-dev + gio
```

`gio` の実体は `scripts/copy-to-gio.mjs`。`idb/run/` を zip 化して `setup.zip` として配置する処理も含む。
---

## 開発サーバー

hoge1e3.github.ioを使用。xampp/apacheなどを想定。
http://localhost/gio/acepad
./gio/ -> hoge1e3.github.io

---

## テスト

- テストは手動実行なので、ソースコードの変更だけを行うこと。以下は「特別にテストはするように指示があった場合」の注意点

```bash
npm run test          # petit-node のテストのみ (http-server で test/index.html を開く)
cd <package> && npm run test  # 各パッケージ個別
```
- ブラウザベースのテストが多い（`npx http-server -o test/index.html` パターン）。
- nodeベースのテストは必ず`npm run test`を使うこと。勝手にtestフォルダの中身を単独で実行しないこと。
---

## バージョン管理・リリース

バージョンはルート `package.json` の `version` が単一の真実。全パッケージはこのバージョンに揃える。

```bash
# ルートの package.json の version を上げてから:
npm run verup   # npm login + versionup.mjs + publish.mjs
```

- `versionup.mjs` — 変更のあったパッケージのみバージョンを上げ、依存パッケージの `package.json` も更新してコミット
- `publish.mjs` — 同バージョンのパッケージのみ `npm publish --access=public` (OTP 入力あり)
- `verup_check.mjs` — バージョンアップが必要か判定

バージョン競合の確認:

```bash
npm run ver-conflict   # scripts/find-package-conflict.mjs
```

---

## Git 
モノレポを採用。ただし
hoge1e3.github.io（https://github.com/hoge1e3/hoge1e3.github.io/）と
/idb/run（https://github.com/hoge1e3/acepad-dev）は別。
(npm run syncはモノレポでなかったときの名残なので無視)
---

## パッケージ間依存関係の原則

- パッケージ間の依存は npm パッケージ名で参照（`@hoge1e3/sfile` など）
- モノレポ内のパッケージが互いを依存するとき、バージョンは `^<rootVersion>` に揃える
- 循環依存は禁止

依存の方向（下位 → 上位の順）:

```
sync-idb-kvs → sync-idb-kvs-multi → petit-fs
@hoge1e3/content → @hoge1e3/sfile → @hoge1e3/fs2 → petit-node
@hoge1e3/rpc → petit-node, pnode-bootloader
```

---

## コーディング規約

- **言語**: TypeScript（一部 `.mjs` スクリプトは JSDoc 付き JavaScript）
- **モジュール形式**: ESM (`"type": "module"`)。ルートと `bootpack` の webpack 設定は `.cjs`
- **型定義**: `tsc` で生成。`js/` または `src/` に `.d.ts` を出力
- **ブラウザ向けコード**: `@types/web` を使用。Node.js 型 (`@types/node`) はサーバー側パッケージのみ
- **スペーシング**　スマートフォンで編集されることも想定して、余計な空行、スペースは極力禁止。インデントサイズは2スペース（一部従ってないコードもあるが将来的に書き換え）

---

## ファイル編集時の注意

- `#!run` 等のシェバン行があるファイルは必ず保持すること
- `shell.mjs` は `@hoge1e3/sfile` ベースのシェルユーティリティ。各 `.mjs` スクリプトで共通使用

---

## よく使うファイル

| ファイル | 用途 |
|---------|------|
| `package.json` | ルート — workspaces 一覧、共通スクリプト、バージョン |
| `shell.mjs` | シェルユーティリティ (`cp`, `exec`, `pushd/popd` 等) |
| `workspaces.mjs` | `Workspace` クラス — package.json の読み書きと依存解決 |
| `versionup.mjs` | バージョンアップ自動化 |
| `publish.mjs` | npm publish 自動化 |
| `scripts/copy-to-gio.mjs` | GitHub Pages へのデプロイ |

## サブプロジェクト

- **gsync** is a git-like synchronization tool designed for AcePad/node,
   - [詳細](gsync/AGENTS.md)

