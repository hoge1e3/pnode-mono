import {FileSystemFactory,SFile,Content, DirectoryOptions} from "../src/SFile.js";
import {assert, _assert} from "./helpers/assert.js";
import {_console, alert} from "./helpers/logging.js";
import {timeout} from "./helpers/async.js";
import {checkSame, checkSameDir, eqa, retryRmdir} from "./helpers/files.js";
import {checkGetDirTree, checkGetDirTree_nw, testGetDirTreeExcludeInSubdir} from "./helpers/dirTree.js";
import {checkPathMethods} from "./helpers/path.js";
declare const location:any;
        
export async function getNodeFS():Promise<FileSystemFactory> {
  try {
    const fs = await import(/* webpackIgnore: true */"node:fs");
    const path = await import(/* webpackIgnore: true */"node:path");
    return new FileSystemFactory({fs, path, Buffer});
  } catch(e) {
    const p=(globalThis as any)?.FS;
    if (p && typeof p.getRootFS==="function") return p;
    const p2=(globalThis as any)?.pNode?.FS;
    if (p2 && typeof p2.getRootFS==="function") return p2; 
    throw e; 
  }
}

export async function main(){
let pass:number=0;
//let testf: SFile;
const cleanups=[] as (()=>Promise<any>)[];
try {
    const FS=await getNodeFS();
    _console.log("metaurl",import.meta.url);
    console.log(FS.get("/"));
    console.log(FS.get("/").up());
    const here=FS.get(import.meta.url);
    const fixtureInSameDir=here.sibling("fixture/");
    const fixture=fixtureInSameDir.exists() ? fixtureInSameDir : here.sibling("../../test/fixture/");
    //const fixture=topDir;//.setPolicy({topDir});
    await checkCopyDir(fixture);
    //let cd =fixture;
    const r=fixture.rel.bind(fixture);
    const romd=r("rom/");
    checkPathMethods(FS, fixture);
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
async function checkCopyDir(dir:SFile) {
    let tmp = dir.sibling("tmp_" + dir.name());
    dir.copyTo(tmp);
    checkSameDir(dir, tmp);
    await retryRmdir(tmp);
    //tmp.rm({r:true});
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
function checkMtime(f:SFile) {
    const t=f.lastUpdate();
    const nt=t-30*60*1000;
    f.setMetaInfo({lastUpdate:nt});
    _console.log("checkMtime", f.path(), t, nt);
    assert(Math.abs(f.lastUpdate()-nt)<2000);
}
}
// of main()
//(globalThis as any).main=main;
main();
