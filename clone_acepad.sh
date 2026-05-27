#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

USER="hoge1e3"

# hoge1e3.github.io
git clone "git@github.com:${USER}/hoge1e3.github.io.git"

# acepad-dev は idb/run/ 以下に clone
mkdir -p ./idb/run
git clone "git@github.com:${USER}/acepad-dev.git" ./idb/run
