#!/bin/bash
set -euo pipefail

# スクリプトのあるディレクトリからリポジトリルートへ移動
cd "$(dirname "$0")/.."
ROOT=$(pwd)

AP="$ROOT/hoge1e3.github.io/acepad"

# bootpack / webcartridge の成果物をコピー
cp "$ROOT/bootpack/dist/index.js"             "$AP/preinstalled/petit-node.js"
cp "$ROOT/webcartridge/dist/webcartridge.js"  "$AP/webcartridge.js"

# idb/run を setup.zip に圧縮（.gsync と .git を除外）
ZIPFILE="$AP/setup.zip"
rm -f "$ZIPFILE"
cd "$ROOT/idb/run"
zip -r "$ZIPFILE" . -x ".gsync/*" -x ".git/*"

echo "gio: done"
