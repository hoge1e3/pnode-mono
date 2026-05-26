#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

/**
 * 再帰的に package.json を探す
 */
function findPackageJsons(dir, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (e.name=== "idb" ||
          e.name==="cotest" || 
          e.name === 'node_modules' || 
          e.name.startsWith('.')) continue;
      findPackageJsons(path.join(dir, e.name), result);
    } else if (e.name === 'package.json') {
      result.push(path.join(dir, e.name));
    }
  }
  return result;
}

/**
 * package.json の依存を抽出
 */
function readDeps(pkgPath) {
  const json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = {};
  const sections = ['dependencies', 'devDependencies', 'peerDependencies'];
  for (const key of sections) {
    if (json[key]) {
      for (const [name, version] of Object.entries(json[key])) {
        if (deps[name]) {
          throw new Error(`Duplocate definition ${name} in ${pkgPath}`);
        }
        deps[name] = deps[name] || new Set();
        deps[name].add(version);
      }
    }
  }
  return { name: /*json.name || */pkgPath, deps };
}

/**
 * 依存のバージョンをマージ
 */
function mergeDeps(allDeps, pkg) {
  for (const [name, versions] of Object.entries(pkg.deps)) {
    allDeps[name] = allDeps[name] || {};
    allDeps[name][pkg.name] = [...versions][0];
  }
}

/**
 * メイン処理
 */
function main() {
  const root = process.cwd();
  const pkgjsons = findPackageJsons(root);
  console.log("list of package.json:",pkgjsons);
  const pkgs = pkgjsons.map(readDeps);

  const allDeps = {};
  pkgs.forEach(pkg => mergeDeps(allDeps, pkg));

  const conflicts = Object.entries(allDeps)
    .filter(([name, uses]) => new Set(Object.values(uses)).size > 1);

  if (conflicts.length === 0) {
    console.log('✅ 競合はありません。すべての依存バージョンが一致しています。');
    return;
  }

  console.log('⚠️ 競合が見つかりました:');
  for (const [name, uses] of conflicts) {
    console.log(`\n  ${name}:`);
    for (const [pkg, version] of Object.entries(uses)) {
      console.log(`    ${pkg}: ${version}`);
    }
  }
  process.exitCode = 1;
}

main();
