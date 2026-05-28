import {DirTree, ExcludeHash, ExcludeOption, MetaInfo, SFile} from "../../src/SFile.js";
import {assert} from "./assert.js";
import {_console} from "./logging.js";
import {retryRmdir} from "./files.js";

const exAttr={atimeMs:1, atime:1,ctimeMs:1, ctime:1};
const eqTree=assert.func(_eqTree);

function getDirTree3Type(dir:SFile, excludes?:ExcludeOption) {
  if (!excludes) {
    excludes={};
  } else if (Array.isArray(excludes)) {
    excludes={
      hier:excludes, rel:excludes,
      abs:excludes.map(e=>dir.rel(e).path()),
    };
  } else if (typeof excludes==="function") {
    excludes={
      hier:excludes, rel:excludes,
      abs:excludes
    };
  }
  const hier=dir.getDirTree({style:"hierarchical",excludes:excludes.hier});
  _console.log("hier",hier);
  const rel=dir.getDirTree({style:"flat-relative",excludes:excludes.rel});
  _console.log("rel",rel);
  const abs=dir.getDirTree({style:"flat-absolute",excludes:excludes.abs});
  _console.log("abs",abs);
  eqtree3(hier, rel,abs);
  return {hier, rel, abs};
  function eqtree3(hier:DirTree,rel:DirTree,abs:DirTree) {
    eqtree2(rel,abs);
    eqtreeH(rel,hier);
  }
  function eqtreeH(rel:DirTree, hier:DirTree){
    const uncheckedRel={} as {[key:string]:number};
    for (let k in rel) uncheckedRel[k]=1;
    function loop(hier:DirTree, path:string) {
      for (let k in hier) {
        let np=path+k;
        _console.log("hier, k, path", hier, k, path);
        delete uncheckedRel[np];
        if (k.match(/\/$/)) {
          loop(hier[k] as DirTree, np);
        } else {
          eqTree(rel[np] as MetaInfo, hier[k] as MetaInfo, np, exAttr);
        }
      }
    }
    loop(hier,"");
    assert(Object.keys(uncheckedRel).length==0,
    "Unchecked rel"+
    `(${Object.keys(uncheckedRel).length}: ${Object.keys(uncheckedRel).join(",")}`);
  }
  function eqtree2(rel: DirTree, abs:DirTree){
    const uncheckedAbs={} as {[key:string]:number};
    for (let k in abs) uncheckedAbs[k]=1;
    for (let k in rel) {
      const absk=dir.rel(k).path();
      _console.log("k-absk",k, absk);
      delete uncheckedAbs[absk];
      eqTree(abs[absk], rel[k], k, exAttr);
    }
    assert(Object.keys(uncheckedAbs).length==0,"Unchecked abs"+
    `${Object.keys(uncheckedAbs).length}: ${Object.keys(uncheckedAbs).join(",")}`);
  }
}

export function checkGetDirTree(dir: SFile) {
  const noex=getDirTree3Type(dir);
  assert.eq(Object.keys(noex.abs).length,50, "count of dirtree abs");
  assert.eq(Object.keys(noex.rel).length,50, "count of dirtree rel");
  assert.eq(Object.keys(noex.hier).length,17, "count of dirtree hier");

  const exa=getDirTree3Type(dir,["event/"]);
  assert.eq(Object.keys(exa.abs).length,50-6, "count of dirtree abs-ea");
  assert.eq(Object.keys(exa.rel).length,50-6, "count of dirtree rel-ea");
  assert.eq(Object.keys(exa.hier).length,17-1, "count of dirtree hier-ea");

  function exfn(f:SFile) {
    return f.isDir() && f.rel("CrashToHandler.tonyu").exists();
  }
  const exf=getDirTree3Type(dir,exfn);
  assert.eq(Object.keys(exf.abs).length,50-6, "count of dirtree abs-ef");
  assert.eq(Object.keys(exf.rel).length,50-6, "count of dirtree rel-ef");
  assert.eq(Object.keys(exf.hier).length,17-1, "count of dirtree hier-ef");

  eqTree(exf.hier, exa.hier, "hier_efea", exAttr);
  eqTree(exf.rel, exa.rel, "rel_efea", exAttr);
  eqTree(exf.abs, exa.abs, "abs_efea", exAttr);
}

export function checkGetDirTree_nw(dir: SFile) {
  const noex=getDirTree3Type(dir);
  _console.log("getDirTree-nw", noex);
}

export async function testGetDirTreeExcludeInSubdir(testdir:SFile) {
  const work=testdir.rel("testGetDirTreeExcludeInSubdir");
  work.mkdir();
  work.rel("a.txt").text("a");
  work.rel("b/c/c.txt").text("c");
  work.rel("b/d/d.txt").text("d");
  work.rel("b/d/secret.txt").text("this is secret folder");
  const tree=work.getDirTree({
    style:"flat-relative",
    excludes(f:SFile) {
      return f.rel("secret.txt").exists();
    }
  });
  console.log("testGetDirTreeExcludeInSubdir",tree);
  assert(tree["a.txt"],"a.txt");
  assert(tree["b/c/c.txt"],"c.txt");
  assert(!tree["b/d/d.txt"],"d.txt");
  assert(!tree["b/d/secret.txt"],"secret.txt");
  await retryRmdir(work);
}

function _eqTree(a:any, b:any, path:string, excludes:ExcludeHash) {
  assert.eq(typeof a, typeof b, "typeof not match:"+path);
  if (a==null) {
    assert(b==null, "both should be null: "+path);
    return;
  }
  if (typeof a!=="object") {
    assert(a===b, `non-equal non-object: ${path} ${a}!==${b}`);
    return;
  }
  for (let k in a) {
    if (excludes[k]) continue;
    eqTree(a[k], b[k], path+"."+k, excludes);
  }
  for (let k in b) {
    if (excludes[k]) continue;
    eqTree(b[k], a[k], path+"."+k, excludes);
  }
}
