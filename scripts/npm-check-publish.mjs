#!run
import {promises as fs} from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
//import {tarEncode, tarDecode} from "@hoge1e3/tar";
//import * as zlib from 'zlib';
//import * as tar from 'tar';

// restore-node-modules.js
// usage: node restore-node-modules.js path/to/package-lock.json
// Node.js >=18 (fetch, fs/promises)


const lockPath = 'package-lock.json';

function isRootPackage(name) {
  return !name.includes('node_modules');
}
let rootDir;
function packagePathToDir(pkgPath) {
  // "node_modules/a/node_modules/b" -> "node_modules/a/node_modules/b"
  return path.join(rootDir, pkgPath);
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}
function url(name, version){
  const names=name.split("/");
  const fname=names.pop();
  return `https://registry.npmjs.org/${name}/-/${fname}-${version}.tgz`;
}
async function *traverseOne(pkg_dir){
  const pkg_json_path=path.join(pkg_dir,"package.json");
  try{
    const pkg_json=JSON.parse(await fs.readFile(pkg_json_path,"utf-8"));
    yield [pkg_dir, pkg_json.name, pkg_json.version];
  }catch(e){/*console.error(e);*/}
  const nested_node_modules=path.join(pkg_dir,"node_modules");
  yield* traverse(nested_node_modules);
}

async function *traverse(node_modules) {
  try {
    const stat=await fs.stat(node_modules);
    if (!stat.isDirectory()) return;
    // traverse node_modules(path string) and yield all [name, version]
    // example: ["some-package","1.0.2"], ["@user/other-package","2.1.2"]....
    const entries=await fs.readdir(node_modules,{withFileTypes:true});
    for(const entry of entries){
      if(!entry.isDirectory())continue;
      if(entry.name.startsWith("@")){
        // scoped package
        const scope_dir=path.join(node_modules,entry.name);
        try {
          const scoped_entries=await fs.readdir(scope_dir,{withFileTypes:true});
          for(const scoped_entry of scoped_entries){
            if(!scoped_entry.isDirectory())continue;
            const pkg_dir=path.join(scope_dir,scoped_entry.name);
            yield* traverseOne(pkg_dir);
          }
        }catch(e){/*console.error(e);*/}
      }else{
        //  normal package 
        const pkg_dir=path.join(node_modules,entry.name);
        yield* traverseOne(pkg_dir);
      }
    }
  }catch(e){/*console.error(e);*/}
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`download failed: ${url} ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(dest));
}

async function extractTgz(tgzPath, destDir) {
  const buf=await fs.readFile(tgzPath);
  const files=await tarDecode(buf, true);
  for (let file of files) {
    const dst=path.join(destDir, file.name);
    await fs.writeFile(dst, await file.arrayBuffer());
  }
  /*await tar.x({
    file: tgzPath,
    cwd: destDir,
    strip: 1, // remove "package/" prefix
  });*/
}

async function installPackage(pkgPath, meta) {
  if (!meta.resolved || !meta.integrity) return;

  const installDir = packagePathToDir(pkgPath);
  await ensureDir(installDir);

  const tgzName = path.basename(meta.resolved);
  const tgzPath = path.join(installDir, tgzName);

  console.log('install', pkgPath, meta.version);

  await download(meta.resolved, tgzPath);
  await extractTgz(tgzPath, installDir);
  await fs.unlink(tgzPath);
}

export async function main() {
  rootDir = ".";//this.resolve(".").path();
  const nodeModulesDir = path.join(rootDir, 'node_modules');
  for await(const [dir, name,version] of traverse(nodeModulesDir)) {
    const u=url(name, version);
    try {
      const r=await fetch(u);
      if (r.status!==200) {
        console.log("Not found: ",r.status,name,version);
      } else {
        console.log("Found: ",dir,name,version);
      }
    }catch(e){
      console.log("Not found: ",name,version);
    }
  }
/*
  const lock = JSON.parse(await fs.readFile(lockPath, 'utf8'));

  if (!lock.packages) {
    throw new Error('lockfileVersion >= 2 required');
  }

  await ensureDir(nodeModulesDir);

  // package-lock.json v2+ の packages セクションをそのまま再現
  for (const [pkgPath, meta] of Object.entries(lock.packages)) {
    if (pkgPath === '') continue; // root
    await installPackage(pkgPath, meta);
  }
*/
  console.log('done');
}
process.chdir("./idb/run");
main();

