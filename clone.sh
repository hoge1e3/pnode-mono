#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

USER="hoge1e3"

# package.json の workspaces を読んで順に clone
workspaces=$(node -e "const p=require('./package.json'); console.log(p.workspaces.join('\n'))")

while IFS= read -r workspace; do
    echo "Cloning $workspace ..."
    git clone "git@github.com:${USER}/${workspace}.git"
done <<< "$workspaces"
