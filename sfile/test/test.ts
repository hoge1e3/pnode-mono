import * as _assert from "assert";
import {FileSystemFactory,SFile,Content, DirectoryOptions, DirTree, MetaInfo, ExcludeOption, ExcludeHash, getNodeFS} from "../src/SFile.js";
const assert = Object.assign(
    (b:any, m?:string)=>_assert.ok(b,m),{
    eq:_assert.equal,   
    ensureError: _assert.throws,
    func<T extends (...args: any[]) => any>(f:T) {
        return ((...args:Parameters<T>):ReturnType<T>=>{
            try {
                return f(...args);
            } catch(e) {
                console.log(f.name+" failed. args:",...args);
                throw e;
            }
        }) as T;
    },
    deepStrictEqual: _assert.deepStrictEqual,
});

const _console={
    taglist: {
        "metaurl": false,
        "isChildOf": false,
        "Convert Content ": false,
        "Test #": true,
        "Enter": false,
        "lastUpdate": false,
        ".tonyu files in ": false,
        "directories in ": false,
        "files in ": false,
        "hier": false,
        "rel": false,
        "abs": false,
        "k-absk": false,
        "hier, k, path": false,
        "nfsls": false,
        "check same": false,
        "bin dump:": false,
        "ALERT": true,
        "f.getBytes": false,
        "tmp.getBytes": false,
        "bins": false,
        "checkMtime": false,
        "getDirTree-nw": false,
        "text.txt": false,
        "BLOB reading...": false,
        "BLOB read done!": false,
        "buildScrap": false,
        "checkWatch": false,
        "checkSameDir": false,
        getDirTree: false,
        FULLL: false,
    } as {[key:string]:boolean},
    unknownlist: {} as {[key:string]:boolean},
    error: console.error.bind(console),
    log(tag:string, ...args:any[]) {
        if (this.taglist[tag]==null) this.unknownlist[tag]=true;
        else if (!this.taglist[tag]) return;
        console.log(tag,...args);
    }
}
const exAttr={atimeMs:1, atime:1,ctimeMs:1, ctime:1};
const timeout = (t:number) => new Promise(s => setTimeout(s, t));
declare const location:any;
const alert:Function=(s:string)=>_console.log("ALERT",s);
        
export async function main(){
let pass:number=0;
//let testf: SFile;
const cleanups=[] as (()=>Promise<any>)[];
const eqTree=assert.func(_eqTree);
try {
    const FS=await getNodeFS();
    _console.log("metaurl",import.meta.url);
    console.log(FS.get("/"));
    console.log(FS.get("/").up());
    assert(!FS.get("/").up());
    const fixture=FS.get(import.meta.url).sibling("fixture/");
    //const fixture=topDir;//.setPolicy({topDir});
    await checkCopyDir(fixture);
    //let cd =fixture;
    const r=fixture.rel.bind(fixture);
    const romd=r("rom/");
    // check relpath:
    //  path= /a/b/c   base=/a/b/  res=c
    assert.eq(r("a/b/c").relPath(r("a/b/")) , "c");
    assert.eq(r("a/b/c").relPath(fixture.rel("a/b/")) , "c");
    //  path= /a/b/c/   base=/a/b/  res=c/
    assert(r("a/b/c/").path().endsWith("/"), "endsWith/ "+r("a/b/c/").path());
    assert(r("a/b/c/").isDirPath(), "dirpath");
    assert.eq(r("a/b/c/").relPath(r("a/b/")) ,"c/");
    //  path= /a/b/c/   base=/a/b/c/d  res= ../
    assert.eq(r("a/b/c/").relPath(r("a/b/c/d")) , "../");
    //  path= /a/b/c/   base=/a/b/e/f  res= ../../c/
    assert.eq(r("a/b/c/").relPath(r("a/b/e/f")) , "../../c/");
    // ext()
    assert.eq(fixture.rel("test.txt").ext(), ".txt");
    //assert.eq(P.normalize("c:\\hoge/fuga\\piyo//"), "c:/hoge/fuga/piyo/");
    _console.log("isChildOf", r("hoge/fuga\\"),(r("hoge\\fuga/piyo//")));
    assert(r("hoge/fuga\\").contains(r("hoge\\fuga/piyo//")), "isChildOf");
    assert(!r("hoge/fugo\\").contains(r("hoge\\fuga/piyo//")), "!isChildOf");
    testContent();
    checkTruncSep(FS);
    let ABCD = "abcd\nefg";
    let CDEF = "defg\nてすと";
    //obsolate: ls does not enum mounted dirs
    //assert(r.indexOf("rom/")>=0, r);
    //let romd = root.rel("rom/");
    let ramd = fixture.rel("ram/");
    if(ramd.exists()) await retryRmdir(ramd);
    ramd.mkdir();
    const testf = fixture.rel("testfn.txt");
    cleanups.push(async ()=>testf.exists() && testf.rm());  
    let testd: SFile;
    if (!testf.exists()) {
        pass=1;
        _console.log("Test #", pass);
        testd = fixture.rel(/*Math.random()*/"testdir" + "/");
        cleanups.push(async ()=>testd.exists() && await retryRmdir(testd));
        _console.log("Enter", testd);
        assert(!testd.exists(), testd+" exists");
        testd.mkdir();
        //--- check exists
        assert(testd.exists());
        //--- check lastUpdate
        let d = new Date().getTime();
        testf.text(testd.path());
        _console.log("lastUpdate", testf.lastUpdate(), d);
        assert(Math.abs(testf.lastUpdate() - d) <= 1000);
        testd.rel("test.txt").text(ABCD);
        assert(romd.rel("Actor.tonyu").text().length > 0);
        testd.rel("sub/test2.txt").text(romd.rel("Actor.tonyu").text());
        listFilesTest(romd);
        await testGetDirTreeExcludeInSubdir(testd);
        let tncnt:string[] = [];
        const pushtn=(f:SFile)=>tncnt.push(f.relPath(romd));
        romd.recursive(pushtn, { 
            // Notice: f.ext() !== ".tonyu" only does not work since it skips directories (and *.tonyu file its subdirectories).
            excludes:(f:SFile)=>(!f.isDir() && f.ext() !== ".tonyu")
        });
        _console.log(".tonyu files in ", romd, tncnt);
        assert.eq(tncnt.length, 46, "tncnt: "+tncnt.length+"!==46");

        tncnt = [];
        romd.recursive(pushtn, { 
            excludes:(f:SFile)=>!f.isDir(),
            includeDir:true,
        });
        _console.log("directories in ", romd, tncnt);
        assert.eq(tncnt.length, 9, "tncnt");

        tncnt = [];
        let exdirs = ["physics/", "event/", "graphics/"];
        romd.recursive(pushtn, { excludes: exdirs });
        _console.log("files in ", romd+" except", exdirs, tncnt);
        assert.eq(tncnt.length, 33, "tncnt 33!="+tncnt.length);
        checkGetDirTree(romd);

        assert(testd.rel("sub/").exists());
        assert(fixture.rel("testdir/sub/").exists());
        assert(testf.exists());
        let sf = testd.setPolicy({ topDir: testd });//SandBoxFile.create(testd._clone());
        assert(sf.rel("test.txt").text() == ABCD);
        sf.rel("test3.txt").text(CDEF);
        /*assert.ensureError(function () {
            let rp = romd.rel("Actor.tonyu").relPath(sf);
            _console.log(rp);
        })*/;
        assert.eq(sf.rel("test3.txt").text(), CDEF);
        assert.ensureError(function () {
            sf.rel("../rom/Actor.tonyu").text();
        });
        sf.rel("test3.txt").rm();
        assert(!testd.rel("test3.txt").exists());
        //let ramd=r("ram/");
        ramd.rel("toste.txt").text("fuga");
        /*assert.ensureError(function () {
            ramd.rel("files").link(testd);
        });*/
        ramd.rel("files/").link(testd);
        eqa(ramd.rel("files/").ls(), testd.ls() );
        eqa(ramd.rel("files/").listFiles().map(f=>f.name()),
             testd.listFiles().map(f=>f.name()) );
        testd.rel("sub/del.txt").text("DEL");
        assert(testd.rel("sub/del.txt").exists(), "del.txt not exists");
        assert(ramd.rel("files/").isLink());
        assert.eq(ramd.rel("files/test.txt").resolveLink().path(), testd.rel("test.txt").path());
        assert.eq(ramd.rel("files/test.txt").text(), ABCD);
        assert.eq(ramd.rel("files/sub/test2.txt").text(), romd.rel("Actor.tonyu").text());
        ramd.rel("files/sub/del.txt").rm();
        assert(!testd.rel("sub/del.txt").exists());
        ramd.rel("files/").rm();
        assert(testd.exists());
        //const nfs=fixture;
        _console.log("fixturels", fixture.ls());
        fixture.rel("sub/test2.txt").text(romd.rel("Actor.tonyu").text());
        fixture.rel("test.txt").text(ABCD);
        /*let pngurl = nfs.rel("Tonyu/Projects/MapTest/images/park.png").text();
        assert(pngurl.startsWith("data:"));
        nfs.rel("sub/test.png").text(pngurl);*/

        fixture.rel("sub/test.png").copyTo(testd.rel("test.png"));
        await checkCopyFile(fixture.rel("Tonyu/Projects/MapTest/Test.tonyu"));
        await checkCopyFile(fixture.rel("Tonyu/Projects/MapTest/images/park.png"));
        await checkCopyFile(testd.rel("test.png"));
        testd.rel("test.png").rm();
        //---- test append
        let beforeAppend = fixture.rel("Tonyu/Projects/MapTest/Test.tonyu");
        let appended = fixture.rel("Tonyu/Projects/MapTest/TestApp.tonyu");
        beforeAppend.copyTo(appended);
        let apText = "\n//tuikasitayo-n\n";
        appended.appendText(apText);
        assert.eq(beforeAppend.text() + apText, appended.text());
        checkMtime(appended);
        //await checkRemoveError(nfs);
        checkGetDirTree_nw(fixture);
    
        _console.log("text.txt", testd.rel("test.txt").path(), testd.rel("test.txt").text());
        testd.rel("test.txt").text(romd.rel("Actor.tonyu").text() + ABCD + CDEF);
        await checkCopyFile(testd.rel("test.txt"));
        testd.rel("test.txt").text(ABCD);
        //testEach(testd);
        //--- the big file
        //if (typeof localStorage!=="undefined" && !nfs) await chkBigFile(testd);

        //------------------
        
        // blob->blob
        let f = testd.rel("hoge.txt");
        f.text("hogefuga");
        checkMtime(f);
        let tmp = testd.rel("fuga.txt");
        let b = f.getBlob();
        _console.log("BLOB reading...", f.name(), tmp.name());
        await tmp.setBlob(b);
        checkSame(f, tmp);
        _console.log("BLOB read done!", f.name(), tmp.name());
        tmp.rm();
        f.rm();
        await moveTest(testd);
        //setTimeout(function () {location.reload();},10000);
        await asyncTest(testd);

    } else {
        try {
            pass=2;
            _console.log("Test #", pass);
            //testf = root.rel("testfn.txt");
            testd = FS.get(testf.text());
            assert(testd.name().match(/^testdir/));
            assert(testd.exists());
            _console.log("Enter", testd);
            const tmp2=testd.rel("tmp2");
            assert(tmp2.exists());
            await retryRmdir(tmp2);
            //tmp2.rm({r:true});
            assert(testd.rel("test.txt").text() === ABCD);
            assert(testd.rel("sub/").exists());
            assert(testd.rel("sub/test2.txt").text() === romd.rel("Actor.tonyu").text());
            chkRecur(testd, {}, ["test.txt","sub/test2.txt"]);
            //_console.log("testd.size", testd.size());
            //assert.eq(testd.size(), ABCD.length + testd.rel("sub/test2.txt").size(), "testd.size");
            eqa(testd.ls(), ["test.txt","sub/"]);
            chkRecur(testd, { excludes: ["sub/"] }, ["test.txt"]);
            testd.rel("test.txt").rm();
            chkRecur(testd, {}, ["sub/test2.txt"]);
            _console.log("FULLL", testd.path());
            /*_console.log("FULLL", localStorage[testd.path()]);
            chkRecur(testd, {}, ["test.txt","sub/test2.txt"]);
            testd.rel("test.txt").rm();
            chkRecur(testd, {}, ["sub/test2.txt"]);
            */

            await retryRmdir(testd);//.rm({ r: true });
            assert(!testd.exists());
            testf.rm({ r: true });
            assert(!testf.exists());
            assert(!testd.rel("test.txt").exists());
            /*await ramd.rel("a/b.txt").text("c").then(function () {
                return ramd.rel("c.txt").text("d");
            }).then(function () {
                return chkRecurAsync(ramd, {}, ["a/b.txt","c.txt"]);
            });*/
            assert.eq(fixture.rel("sub/test2.txt").text(), romd.rel("Actor.tonyu").text());
            assert.eq(fixture.rel("test.txt").text(), ABCD);
            //let pngurl = nfs.rel("Tonyu/Projects/MapTest/images/park.png").text();
            //assert.eq(nfs.rel("sub/test.png").text(), pngurl);
        } finally {
           
        }
    }
    if(ramd.exists()) await retryRmdir(ramd);
    console.log("passed", "#"+pass);
    if (pass==1) {
        await timeout(1000);
        if (typeof location!=="undefined" && !location.href.match(/pass1only/)) location.reload();
    } else {
        console.log("All test passed.");
    }
} catch (e) {
    process.exitCode = 1;
    console.log((e as any).stack);
    alert("#"+pass+" test Failed. "+e);
    try {
        for (let c of cleanups) await c();
    } catch (e) {
        _console.error(e);
    }
    console.log("Unknown tags:", JSON.stringify(_console.unknownlist,null,2))
}
async function moveTest(testd:SFile) {
    let tmp1 = testd.rel("tmp1");
    tmp1.mkdir();
    let tmp2 = testd.rel("tmp2");
    //tmp2.mkdir();
    let sub = testd.rel("sub");
    let res1=[];
    for (let f of sub.recursive()) {
        res1.push(f.relPath(sub));
    }
    sub.copyTo(tmp1);
    tmp1.moveTo(tmp2);
    assert(!tmp1.exists());
    let res2=[];
    for (let f of tmp2.recursive()) {
        res2.push(f.relPath(tmp2));
    }
    console.log("movetes",res1,res2);
    _assert.deepStrictEqual(res1,res2);
}
function listFilesTest(romd: SFile) {
    eqa(romd.listFiles().map(f=>f.name()), [
        "event/","graphics/","js/",
        "physics/", "sound/","t1/","thread/", "ui/",
        ".desktop", "Actor.tonyu", "BaseActor.tonyu",
        "Boot.tonyu", "MathMod.tonyu", "NoviceActor.tonyu",
        "options.json", "TObject.tonyu", "TQuery.tonyu"
    ]);
}
/*
async function chkBigFile(testd: SFile) {
    let cap = LSFS.getCapacity();
    _console.log("usage", cap);
    if (cap.max < 100000000) {
        let len = cap.max - cap.using + 1500;
        let buf = "a";
        while (buf.length < len) buf += buf;
        let bigDir = testd.rel("bigDir/");
        let bigDir2 = bigDir.sibling("bigDir2/");
        if (bigDir2.exists()) bigDir2.rm({ r: 1 });
        let bigFile = bigDir.rel("theBigFile.txt");
        assert.ensureError(function () {
            _console.log("Try to create the BIG ", buf.length, "bytes file");
            return bigFile.text(buf);
        });
        assert(!bigFile.exists(), "BIG file remains...?");
        buf = buf.substring(0, cap.max - cap.using - 1500);
        buf = buf.substring(0, buf.length / 10);
        for (let i = 0; i < 6; i++) bigDir.rel("test" + i + ".txt").text(buf);
        await bigDir.moveTo(bigDir2).then(
            function () { alert("You cannot come here(move big)"); },
            function (e) {
                _console.log("Failed Successfully! (move big!)", e);
                return DU.resolve();
            }
        ).then(function () {
            for (let i = 0; i < 6; i++) assert(bigDir.rel("test" + i + ".txt").exists());
            assert(!bigDir2.exists(), "Bigdir2 (" + bigDir2.path() + ") remains");
            _console.log("Bigdir removing");
            bigDir.removeWithoutTrash({ recursive: true });
            bigDir2.removeWithoutTrash({ recursive: true });
            assert(!bigDir.exists());
            _console.log("Bigdir removed!");
            return DU.resolve();
        });//.then(DU.NOP, DU.E);
    }
}*/
async function checkCopyDir(dir:SFile) {
    let tmp = dir.sibling("tmp_" + dir.name());
    dir.copyTo(tmp);
    checkSameDir(dir, tmp);
    await retryRmdir(tmp);
    //tmp.rm({r:true});
}
function checkSameDir(a:SFile, b:SFile) {
    let res1 = [] as string[];
    let res2 = [] as string[];
    a.recursive(function (f:SFile) {
        res1.push(f.relPath(a));
    });
    b.recursive(function (f:SFile) {
        res2.push(f.relPath(b));
    });
    _console.log("checkSameDir", a.path(), b.path(), res1, res2);
    _assert.deepStrictEqual(res1.sort(), res2.sort());
}
async function checkCopyFile(f:SFile) {
    let tmp = f.sibling("tmp_" + f.name());
    f.copyTo(tmp);
    checkSame(f, tmp);
    tmp.text("DUMMY");

    let c = f.getContent();
    tmp.setContent(c);
    checkSame(f, tmp);
    tmp.text("DUMMY");

    let t:string;
    if (f.isText()) {
        // plain->plain(.txt) / url(bin->URL)->url(URL->bin) (.bin)
        t = f.text();
        tmp.text(t);
        checkSame(f, tmp);
        tmp.text("DUMMY");
    }
    // url(bin->URL)->url(URL->bin)
    t = f.dataURL();
    tmp.dataURL(t);
    checkSame(f, tmp);
    tmp.text("DUMMY");

    // bin->bin
    let b = f.getBytes();
    _console.log("f.getBytes",b);
    tmp.setBytes(b);
    _console.log("tmp.getBytes",tmp.getBytes());
    //_console.log(peekStorage(f));
    //_console.log(peekStorage(tmp));
    checkSame(f, tmp);
    
    // bin->Uint8Array->bin
    let c2=Content.bin(b, f.contentType());
    let bins=c2.toArrayBuffer();
    _console.log("bins",b,c2,bins);
    tmp.setBytes(bins);
    tmp.text("DUMMY");


    if (f.isText()) {
        // plain->bin(lsfs) , bin->plain(natfs)
        b = f.getBytes();
        c = Content.bin(b, "text/plain");
        t = c.toPlainText();
        tmp.setText(t);
        checkSame(f, tmp);
        tmp.text("DUMMY");
    }
    await retryRmdir(tmp);
    //tmp.rm({r:true});
}
function checkSame(a:SFile, b:SFile) {
    _console.log("check same", a.name(), b.name(), a.text().length, b.text().length);
    if(a.isText() && b.isText() && a.text() !== b.text()) {
        throw new Error("text is not match: " + a + "!=" + b+"\n"+
        "content ----\n"+a.text()+"\n----\n"+b.text());
    }
    let _a1 = a.getBytes({ binType: ArrayBuffer });
    let _b1 = b.getBytes({ binType: ArrayBuffer });
    let a1 = new Uint8Array(_a1);
    let b1 = new Uint8Array(_b1);
    _console.log("bin dump:", a1[0], a1[1], a1[2], a1[3]);
    assert(a1.length > 0, "shoule be longer than 0");
    assert(a1.length == b1.length, "length is not match: " + a + "," + b);
    for (let i = 0; i < a1.length; i++) assert(a1[i] == b1[i], "failed at [" + i + "]");
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

function eqa(a:any[],b:any[]) {
    _assert.deepStrictEqual(a.sort().join(","),b.sort().join(","));
}
function chkRecur(dir:SFile, options:DirectoryOptions, result:string[]) {
    const di = [] as string[];
    dir.recursive(function (f) {
        di.push(f.relPath(dir));
    }, options);
    eqa(di, result);
    let t = dir.getDirTree({excludes:options.excludes,style:"flat-relative"});
    _console.log("getDirTree",dir, t);
    eqa(Object.keys(t), result);
}
function testContent() {
    let C = Content;
    const a=[0xe3, 0x81, 0xa6, 0xe3, 0x81, 0x99, 0xe3, 0x81, 0xa8, 0x61, 0x62, 0x63];
    const conts:{[key:string]: [string|ArrayBuffer|Buffer, ( ((s:string)=>Content)| ((s:ArrayBuffer)=>Content) ) , (c:Content)=>string|ArrayBuffer|Buffer]}={
        p:["てすとabc", (s:string)=>C.plainText(s), (c:Content)=>c.toPlainText()],
        u:["data:text/plain;base64,44Gm44GZ44GoYWJj", (u:string)=>C.url(u), (c:Content)=>c.toURL()],
        a:[Uint8Array.from(a).buffer, (a:ArrayBuffer)=>C.bin(a, "text/plain"), (c:Content)=>c.toArrayBuffer()],
        n:[Buffer.from(a),(n:ArrayBuffer)=>C.bin(n, "text/plain"), (c:Content)=>c.toNodeBuffer()],
    };
    /*if (typeof Buffer!=="undefined") {
        conts.n=[Buffer.from(a),(n)=>C.bin(n, "text/plain"), (c)=>c.toNodeBuffer()];
    }*/
    const SRC=0, TOCONT=1, FROMCONT=2;
    let binLen=(conts.a[SRC] as ArrayBufferLike).byteLength;
    for (let tfrom of Object.keys(conts) ) 
        for (let tto of Object.keys(conts) ) chk(tfrom,tto);
    function chk(tfrom: string ,tto:string) {
        const src=conts[tfrom][SRC];
        const c=conts[tfrom][TOCONT](src as any);
        if (c.hasNodeBuffer()) {
            assert.eq(((c as any).nodeBuffer as Buffer).length, binLen,"Bin length not match");
        }
        const dst=conts[tto][FROMCONT](c);
        _console.log("Convert Content ",tfrom,"->",tto);
        if (!contEq(dst as any, conts[tto][SRC] as any)) {
            _console.log("Actual: ",dst);
            _console.log("Expected: ",conts[tto][SRC]);
            //_console.log("Content bufType ", c.bufType );
            throw new Error(`Fail at ${tfrom} to ${tto}`);
        }
    }

    /*let c1 = C.plainText(s);
    test(c1, [s]);

    function test(c, path) {
        let p = c.toPlainText();
        let u = c.toURL();
        let a = c.toArrayBuffer();
        let n = C.hasNodeBuffer() && c.toNodeBuffer();
        _console.log("TestCont", path, "->", p, u, a, n);
        let cp = C.plainText(p);
        let cu = C.url(u);
        let ca = C.bin(a, "text/plain");
        let cn = n && C.bin(n, "text/plain");
        if (path.length < 2) {
            test(cp, path.concat([p]));
            test(cu, path.concat([u]));
            test(ca, path.concat([a]));
            if (n) test(cn, path.concat([n]));
        } else {
            //assert.eq(cp,p, "cp!=p");
            //assert.eq(cu,u, "cu!=u");
        }
    }*/
}
async function asyncTest(testd:SFile) {
    //await checkZip(testd);
    await checkWatch(testd);
}
async function checkWatch(testd:SFile) {
    const buf = [] as string[];
    //const isN = NativeFS.available && testd.getFS() instanceof NativeFS;
    //_console.log("isN",isN);
    const isN=false
    const w = testd.watch((type, f) => {
        buf.push(type + ":" + f.relPath(testd));
    });
    async function buildScrap(f:SFile, t = "aaa") {
        _console.log("buildScrap",f.path());
        await timeout(100);
        f.text(t);
        await timeout(100);
        f.text(t + "!");
        await timeout(100);
        f.rm();
    }
    await buildScrap(testd.rel("hogefuga.txt"));
    w.remove();
    await buildScrap(testd.rel("hogefuga.txt"));
    _console.log("checkWatch", buf);
    const uniq=(a:string[])=>{
        const has=new Set();
        const res=[];
        for (let e of a) {
            if (has.has(e)) continue;
            has.add(e);
            res.push(e);
        }
        return res;
    };
    _assert.deepStrictEqual(uniq(buf)/*.join("\n")*/, (isN?uniq([
        "rename:hogefuga.txt",
        "change:hogefuga.txt",
        "change:hogefuga.txt",
        "change:hogefuga.txt",
        //"change:hogefuga.txt",
    ]):uniq([
        /*"create:hogefuga.txt",
        "change:",
        "change:hogefuga.txt",
        "change:",
        "delete:hogefuga.txt",
        "change:"*/
        'rename:hogefuga.txt',
        'change:hogefuga.txt',
    ]))/*.join("\n")*/);//, "checkWatch");

}
function checkTruncSep(FS:FileSystemFactory) {
    assert.eq(FS.get("/tmp/test/").name(), "test/");
    assert.eq(FS.get("/tmp/test/").truncSep(), "test");
    assert.eq(FS.get("/tmp/test").name(), "test");
    assert.eq(FS.get("/tmp/test").truncSep(), "test");
}
function checkMtime(f:SFile) {
    const t=f.lastUpdate();
    const nt=t-30*60*1000;
    f.setMetaInfo({lastUpdate:nt});
    _console.log("checkMtime", f.path(), t, nt);
    assert(Math.abs(f.lastUpdate()-nt)<2000);
}
/*
async function checkZip(dir:SFile) {
    const cleanExt=async ()=>{
        assert.eq(ext.name(),"ext/");
        if (ext.exists()) {
            for (let i=0;i<10;i++) {
                try {
                    await ext.rm({ recursive: true });
                    break;
                } catch(e) {
                    _console.log("Rm"+ext+" retry... "+i);
                    await timeout(1000);
                }    
            }
            assert(!ext.exists(),ext+" remains ");        
        }    
    };
    await timeout(3000);
    let ext = dir.rel("ext/");
    await cleanExt();
    dir.rel("ziping.txt").text("zipping");
    let tre = dir.getDirTree();
    _console.log("TRE", tre);
    const zipf = FS.get("/ram/comp.zip");
    await FS.zip.zip(dir, zipf);
    ext.mkdir();
    await FS.zip.unzip(zipf, ext);

    let tre2 = ext.getDirTree();
    _console.log("TRE2", tre2);
    dir.rel("ziping.txt").removeWithoutTrash();
    await cleanExt();
    assert.eq(Object.keys(tre).length, Object.keys(tre2).length);
    for (let k2 of Object.keys(tre2)) {
        let k = k2.replace(/\/ext/, "");
        _console.log("k-k2", k, k2);
        assert(k2 in tre2);
        assert(k in tre);
        assert(tre[k].lastUpdate);
        _console.log("mtime diff", tre[k].lastUpdate - tre2[k2].lastUpdate);
        //assert(Math.abs(tre[k].lastUpdate-tre2[k2].lastUpdate)<2000);
        assert(Math.abs(
            Math.floor(tre[k].lastUpdate / 2000) -
            Math.floor(tre2[k2].lastUpdate / 2000)) <= 2,
            `Zip timestamp not match ${k}=${tre[k].lastUpdate}, ${k2}=${tre2[k2].lastUpdate}, Diff=${tre[k].lastUpdate - tre2[k2].lastUpdate}`
        );
    }
    await timeout(1000);
}*/
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
function checkGetDirTree(dir: SFile) {
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
function checkGetDirTree_nw(dir: SFile) {
    const noex=getDirTree3Type(dir);
    _console.log("getDirTree-nw", noex);
}
async function testGetDirTreeExcludeInSubdir(testdir:SFile) {
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
/*
async function checkRemoveError(dir) {
    const fs=await import("fs");
    dir=dir.rel("rmtest/");
    dir.mkdir();
    const locked=dir.rel("locked.txt");
    locked.text("test");
    const np=locked.fs.toNativePath(locked.path());
    _console.log("np",np);
    fs.chmodSync(np,0o400);
    await timeout(10000);
    fs.unlinkSync(np);
    _console.log("WHT!!!",np);
    await assert.ensureErrorAsync(()=>dir.rm({r:true}));
    fs.chmodSync(np,0o666);
    await dir.rm({r:true});
    assert(!dir.exists(), dir+" remains (checkRemove)");    
}*/
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
async function retryRmdir(dir: SFile) {
    for (let i=0;i<10;i++) {
        try {
            dir.rm({ r: true });
            return ;
        } catch (e) {
            _console.log("retryRmdir", (e as any).stack);
            await timeout(1000);
        }
    }
    throw new Error("retryRmdir "+dir+" failed");
}

}
// of main()
//(globalThis as any).main=main;
main();
