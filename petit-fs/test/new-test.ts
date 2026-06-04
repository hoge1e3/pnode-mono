import {fs, dev, path, process, LSFS} from "../src/index.js";
import * as jszip from "jszip";
import {FileSystemFactory, SFile,Content} from "@hoge1e3/sfile";
import {main, SetupResult} from "@hoge1e3/sfile/js/test/test.js";
import {Pass1Context, runPass1} from "@hoge1e3/sfile/js/test/pass1.js";
import {Pass2Context, runPass2} from "@hoge1e3/sfile/js/test/pass2.js";
import { Buffer } from "buffer";
import {assert,_assert} from "@hoge1e3/sfile/js/test/helpers/assert.js";
import {_console} from "@hoge1e3/sfile/js/test/helpers/logging.js";
import { toCanonicalPath } from "../src/pathUtil2.js";

const FS = new FileSystemFactory({
    fs:   fs as unknown as typeof import("fs"),
    path: path as unknown as typeof import("path"),
    Buffer,
});
(globalThis as any).process=process;
async function extractFixture(to: SFile) {
    const resp = await fetch("fixture.zip");
    const buf = await resp.arrayBuffer();
    const zipf = await jszip.loadAsync(buf);
    for (const key of Object.keys(zipf.files)) {
        const obj = zipf.files[key];
        const f = to.rel(obj.name);
        if (obj.dir) {
            f.mkdir();
        } else {
            const b = await obj.async("arraybuffer");
            f.setBytes(b);
            if (b.byteLength > 0 && f.size() == 0) {
                throw new Error("Size mismatch after write: " + f.path() + " buf=" + b.byteLength);
            }
        }
    }
}
async function setup(FS: FileSystemFactory, cleanups: (()=>Promise<any>)[]): Promise<SetupResult> {
    // Re-mount on every load (RAM mount is lost on reload)
    fs.mkdirSync("/zip/", {recursive: true});
    try { dev.mountSync("/zip/", "ram"); } catch(e) { /* already mounted */ }
    fs.mkdirSync("/ram/", {recursive: true});
    try { dev.mountSync("/ram/", "ram"); } catch(e) { /* already mounted */ }
    await dev.mount("/idb/","idb");
    await dev.mount("/lv3/","idb",{dbName:"lazy",lazy:3});

    (globalThis as any).FS=FS;
    root = FS.get("/");
    const zipDir = root.rel("zip/");
    // Always re-extract fixture (RAM is volatile, lost on reload)
    await extractFixture(zipDir);

    const fixture = zipDir.rel("fixture/");
    const ramd = root.rel("ram/");

    const testf = root.rel("testfn.txt");
    cleanups.push(async () => testf.exists() && testf.rm());
    const testd = root.rel(/*Math.random()*/"testdir" + "/");
    return {fixture, ramd, testf, testd, cleanups, skipRamdCleanup: true};
}
let root:SFile;

main({
    async runPass1(c:Pass1Context){
        await runPass1(c);
        if (!root) throw new Error("Pass1Context.root should be provided.");
        await testIDB(1, c.fixture, root.rel("idb/pfs-test/"));
        await testFineMtime(FS);
    },
    async runPass2(c:Pass2Context){
        await runPass2(c);
        if (!root) throw new Error("Pass1Context.root should be provided.");
        await testIDB(2, c.fixture, root.rel("idb/pfs-test/"));        
    },
    FS,
    setup,
});
async function testIDB(pass:number, fixture:SFile, idbdir:SFile) {
    if (pass==1) {
        fixture.copyTo(idbdir);
        assert(idbdir.exists(), "IDBDir not exists.");
        checkSameDirContents(fixture, idbdir);
        testSymlink(idbdir.path());
    } else {
        checkSameDirContents(fixture, idbdir);
        const README=idbdir.rel("README.txt");
        const orig_README=README.text();
        const p=new Promise((resolve, reject) => {
            idbdir.watch((type, f) => {
                _console.log("watch", type, f.path());
                resolve(void 0);
            });
        });
        new Worker("./worker.webpack.js",{type:"module"});
        await p;
        console.log("new README", README.text());   
        assert.eq(README.text(), orig_README+"Hello");
        // Cannot remove mountPoint. /idb/pfs-test is ok
        //idbdir.rm({r:true});
        for (let f of idbdir.listFiles()) f.rm({r:true});
    }
} 
function testSymlink(baseDir: string) {
    const assert_eq=(a:any,b:any,m:string)=>{
        console.log("symlink:",a,b,m);
        assert.eq(a,b,m);
    }
  const tmp = path.join(baseDir, "symlink-test");

  // clean & prepare
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });

  const targetFile = path.join(tmp, "target.txt");
  fs.writeFileSync(targetFile, "hello");

  // === absolute symlink test ===
  const absLink = path.join(tmp, "abs-link.txt");
  fs.symlinkSync(targetFile, absLink);

  const absRead = fs.readlinkSync(absLink);
  assert_eq(absRead, targetFile, "absolute readlink should return absolute path");

  const absContent = fs.readFileSync(absLink, "utf-8");
  assert_eq(absContent, "hello", "absolute symlink should resolve to correct content");

  // === relative symlink test ===
  const relLink = path.join(tmp, "rel-link.txt");
  const relPath = path.relative(tmp, targetFile);
  fs.symlinkSync(relPath, relLink);
  
  const relRead = fs.readlinkSync(relLink);
  assert_eq(relRead, relPath, "relative readlink should return relative path");

  const relContent = fs.readFileSync(relLink, "utf-8");
  assert_eq(relContent, "hello", "relative symlink should resolve to correct content");

  // === double symlink resolution test ===
  const link1 = path.join(tmp, "link1.txt");
  const link2 = path.join(tmp, "link2.txt");

  fs.symlinkSync(targetFile, link1); // link1 -> target
  const relToLink1 = path.relative(tmp, link1);
  fs.symlinkSync(relToLink1, link2); // link2 -> link1

  const link2Read = fs.readlinkSync(link2);
  assert_eq(link2Read, relToLink1, "link2 should point to link1");

  const contentVia2Links = fs.readFileSync(link2, "utf-8");
  assert_eq(contentVia2Links, "hello", "double symlink should resolve correctly");

  // === realpath resolution ===
  const resolved = fs.realpathSync(link2);
  assert_eq(resolved, targetFile, "realpath should resolve to final target");

  console.log("All symlink assertions passed.");
  fs.rmSync(tmp, { recursive: true, force: true });
}

function checkSameDirContents(d1:SFile, d2:SFile) {
    let ls1 = d1.ls();
    let ls2 = d2.ls();
    eqaSorted(ls1, ls2);
    for (let name of ls1) {
        const f1= d1.rel(name);
        const f2= d2.rel(name);
        assert((f1.isDir() === f2.isDir()), "isDirSame");
        if (f1.isDir()) {
            checkSameDirContents(f1, f2);
        } else {
            let c1 = f1.getContent();
            let c2 = f2.getContent();
            checkSameContent(c1, c2, `${f1} ${f2}`);
        }
    }
}
function checkSameContent(c1:Content, c2:Content, tag="checkSameContent") {
    assert(contEq(
        new Uint8Array(c1.toArrayBuffer()), 
        new Uint8Array(c2.toArrayBuffer())), tag);
}
function contEq(a:Uint8Array|string, b:Uint8Array|string) {
    if (typeof a!==typeof b)return false;
    if (typeof a==="string") return a===b;
    if (typeof b==="string") return false;
    a = new Uint8Array(a);
    b = new Uint8Array(b);
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i]!==b[i]) return false;
    return true;
}
function eqaSorted(actual:any[],expected:any[]) {
    _assert.deepStrictEqual(actual.sort(),expected.sort());
}

async function testFineMtime(FS:FileSystemFactory) {
    async function set(){
        const n=performance.now();
        for (let fs of dev.df()) {
            if (fs.fstype()==="idb") {
                const lsfs=fs as LSFS;
                const mpf=FS.get(fs.mountPoint);
                if (fs.mountPoint.includes("lv3"))continue;
                for (let e of mpf.listFiles()) {
                    const nmt=naiveMtime(e);
                    const fmt=await lsfs.setFineMtime(toCanonicalPath(e.path()));
                    console.log("testFineMtime",fmt, nmt, e.path())
                    assert.eq(fmt, nmt, e.path());
                }
            }
        }
        console.log("setFineMtime took ",performance.now()-n,"msec.");
    }
    await set();
    const touch="/idb/pfs-test/Tonyu/Projects/MapTest/Test.tonyu";
    const touchF=FS.get(touch);
    for (let f=touchF;f.truncSep()!=="idb";f=f.up()!) {
        const m1=f.getMetaInfo();
        assert(m1.hasFineMtime,"!m1.hasFineMTime "+f);        
    }
    touchF.appendText("/*APPENDED*/");
    for (let f=touchF.up()!;f.truncSep()!=="idb";f=f.up()!) {
        const m1=f.getMetaInfo();
        assert(!m1.hasFineMtime,"m1.hasFineMTime "+f);        
    }
    await set();
    touchF.text(touchF.text().replace(/..APPENDED..$/,"") );
    function naiveMtime(dir:SFile):number {
        let max=0;
        for (let f of dir.listFiles()) {
            const mt=(f.isDir()? naiveMtime(f) : f.lastUpdate());
            if (mt>max) max=mt;
        }
        return max;
    }
}