import {Content, SFile} from "../src/SFile.js";
import {assert, _assert} from "./helpers/assert.js";
import {_console} from "./helpers/logging.js";
import {timeout} from "./helpers/async.js";
import {checkSame, eqa, retryRmdir} from "./helpers/files.js";
import {checkGetDirTree, checkGetDirTree_nw, testGetDirTreeExcludeInSubdir} from "./helpers/dirTree.js";

export type Pass1Options={
  fixture:SFile,
  romd:SFile,
  ramd:SFile,
  testf:SFile,
  ABCD:string,
  CDEF:string,
  cleanups:(()=>Promise<any>)[],
};

export async function runPass1({fixture, romd, ramd, testf, ABCD, CDEF, cleanups}:Pass1Options) {
  const testd = fixture.rel(/*Math.random()*/"testdir" + "/");
  cleanups.push(async ()=>testd.exists() && await retryRmdir(testd));
  _console.log("Enter", testd);
  assert(!testd.exists(), testd+" exists");
  testd.mkdir();
  assert(testd.exists());
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
  let sf = testd.setPolicy({ topDir: testd });
  assert(sf.rel("test.txt").text() == ABCD);
  sf.rel("test3.txt").text(CDEF);
  assert.eq(sf.rel("test3.txt").text(), CDEF);
  assert.ensureError(function () {
    sf.rel("../rom/Actor.tonyu").text();
  });
  sf.rel("test3.txt").rm();
  assert(!testd.rel("test3.txt").exists());
  //ramd.rel("toste.txt").text("fuga");
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
  _console.log("fixturels", fixture.ls());
  fixture.rel("sub/test2.txt").text(romd.rel("Actor.tonyu").text());
  fixture.rel("test.txt").text(ABCD);

  fixture.rel("sub/test.png").copyTo(testd.rel("test.png"));
  await checkCopyFile(fixture.rel("Tonyu/Projects/MapTest/Test.tonyu"));
  await checkCopyFile(fixture.rel("Tonyu/Projects/MapTest/images/park.png"));
  await checkCopyFile(testd.rel("test.png"));
  testd.rel("test.png").rm();
  let beforeAppend = fixture.rel("Tonyu/Projects/MapTest/Test.tonyu");
  let appended = fixture.rel("Tonyu/Projects/MapTest/TestApp.tonyu");
  beforeAppend.copyTo(appended);
  let apText = "\n//tuikasitayo-n\n";
  appended.appendText(apText);
  assert.eq(beforeAppend.text() + apText, appended.text());
  checkMtime(appended);
  checkGetDirTree_nw(fixture);

  _console.log("text.txt", testd.rel("test.txt").path(), testd.rel("test.txt").text());
  testd.rel("test.txt").text(romd.rel("Actor.tonyu").text() + ABCD + CDEF);
  await checkCopyFile(testd.rel("test.txt"));
  testd.rel("test.txt").text(ABCD);

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
  await asyncTest(testd);
}

async function moveTest(testd:SFile) {
  let tmp1 = testd.rel("tmp1");
  tmp1.mkdir();
  let tmp2 = testd.rel("tmp2");
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
    t = f.text();
    tmp.text(t);
    checkSame(f, tmp);
    tmp.text("DUMMY");
  }
  t = f.dataURL();
  tmp.dataURL(t);
  checkSame(f, tmp);
  tmp.text("DUMMY");

  let b = f.getBytes();
  _console.log("f.getBytes",b);
  tmp.setBytes(b);
  _console.log("tmp.getBytes",tmp.getBytes());
  checkSame(f, tmp);

  let c2=Content.bin(b, f.contentType());
  let bins=c2.toArrayBuffer();
  _console.log("bins",b,c2,bins);
  tmp.setBytes(bins);
  tmp.text("DUMMY");

  if (f.isText()) {
    b = f.getBytes();
    c = Content.bin(b, "text/plain");
    t = c.toPlainText();
    tmp.setText(t);
    checkSame(f, tmp);
    tmp.text("DUMMY");
  }
  await retryRmdir(tmp);
}

async function asyncTest(testd:SFile) {
  await checkWatch(testd);
}

async function checkWatch(testd:SFile) {
  const watchd = testd.rel("watch/");
  if (watchd.exists()) await retryRmdir(watchd);
  watchd.mkdir();
  const buf = [] as string[];
  const isN=false
  const w = watchd.watch((type, f) => {
    buf.push(type + ":" + f.relPath(watchd));
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
  await buildScrap(watchd.rel("hogefuga.txt"));
  w.remove();
  await buildScrap(watchd.rel("hogefuga.txt"));
  await retryRmdir(watchd);
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
  _assert.deepStrictEqual(uniq(buf), (isN?uniq([
    "rename:hogefuga.txt",
    "change:hogefuga.txt",
    "change:hogefuga.txt",
    "change:hogefuga.txt",
  ]):uniq([
    'rename:hogefuga.txt',
    'change:hogefuga.txt',
  ])));
}

function checkMtime(f:SFile) {
  const t=f.lastUpdate();
  const nt=t-30*60*1000;
  f.setMetaInfo({lastUpdate:nt});
  _console.log("checkMtime", f.path(), t, nt);
  assert(Math.abs(f.lastUpdate()-nt)<2000);
}
