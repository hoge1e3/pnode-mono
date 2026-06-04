import {Content, AFile} from "../src/SFile.js";
import {assert, _assert} from "./helpers/assert.js";
import {_console} from "./helpers/logging.js";
import {timeout} from "./helpers/async.js";
import {checkSame, eqa, retryRmdir} from "./helpers/files.js";
import {ABCD, CDEF} from "./helpers/constants.js";
import {Pass1Context} from "./pass1.js";

export async function runPass1(ctx: Pass1Context) {
  const fixture = ctx.fixture.async();
  const romd = fixture.rel("rom/").async();
  const ramd    = ctx.ramd.async();
  const testf   = ctx.testf.async();
  const {cleanups} = ctx;

  // Setup
  const testd = fixture.rel("testdir/");
  cleanups.push(async () => (await testd.exists()) && await retryRmdir(testd.sync()));
  _console.log("Enter", testd);
  assert(!await testd.exists(), testd+" exists");
  await testd.mkdir();
  assert(await testd.exists());
  await testDirFileOverlap(testd.rel("dirfile/"));

  // Record the temporary directory for pass2 and check basic mtime behavior.
  let d = new Date().getTime();
  await testf.text(testd.path());
  const lastUpd = await testf.lastUpdate();
  _console.log("lastUpdate", lastUpd, d);
  assert(Math.abs(lastUpd - d) <= 1000);
  await testd.rel("test.txt").text(ABCD);
  assert((await romd.rel("Actor.tonyu").text()).length > 0);
  await testd.rel("sub/test2.txt").text(await romd.rel("Actor.tonyu").text());

  // Directory listing checks
  await listFilesTest(romd);

  // Relative path and symlink behavior
  assert(await testd.rel("sub/").exists());
  assert(await fixture.rel("testdir/sub/").exists());
  assert(await testf.exists());
  await testPolicy(testd);
  await testSymlinks(testd, {ramd, romd, fixture});

  // Prepare fixture files used by later copy and pass2 checks.
  await fixture.rel("sub/test2.txt").text(await romd.rel("Actor.tonyu").text());
  await fixture.rel("test.txt").text(ABCD);

  // Copy file content through each supported content API.
  await checkContentCopyApis(testd, fixture);
  // Append text and verify explicit mtime updates.
  await checkAppendAndMtime(fixture);
  // Reuse test.txt for text copy checks, then restore it for pass2.
  await checkTextCopyAndRestore(testd, romd);
  // Blob round-trip
  await checkBlobRoundTrip(testd);
  //------------
  await moveTest(testd);
  await asyncTest(testd);
}

async function testDirFileOverlap(base: AFile) {
  await base.mkdir();
  const dir = base.rel("dir");
  await dir.mkdir();
  const file = base.rel("file");
  await file.text("ABCD");
  await assert.ensureErrorAsync(async () => { await dir.getContent(); });
  await assert.ensureErrorAsync(async () => { await dir.text("ABCD"); });
  await assert.ensureErrorAsync(async () => { await file.listFiles(); });
  await base.rm({ r: true });
}

type SymlinkTestContext = { ramd: AFile, romd: AFile, fixture: AFile };

async function testSymlinks(testd: AFile, {ramd, romd, fixture}: SymlinkTestContext) {
  await ramd.rel("files/").link(testd);
  eqa(await ramd.rel("files/").ls(), await testd.ls());
  eqa(
    (await ramd.rel("files/").listFiles()).map(f => f.name()),
    (await testd.listFiles()).map(f => f.name())
  );
  await testd.rel("sub/del.txt").text("DEL");
  assert(await testd.rel("sub/del.txt").exists(), "del.txt not exists");
  assert(await ramd.rel("files/").isLink());
  assert.eq(
    (await ramd.rel("files/test.txt").resolveLink()).path(),
    testd.rel("test.txt").path()
  );
  assert.eq(await ramd.rel("files/test.txt").text(), ABCD);
  assert.eq(await ramd.rel("files/sub/test2.txt").text(), await romd.rel("Actor.tonyu").text());
  await ramd.rel("files/sub/del.txt").rm();
  assert(!await testd.rel("sub/del.txt").exists());
  await ramd.rel("files/").rm();
  assert(await testd.exists());
  _console.log("fixturels", await fixture.ls());
}

async function testPolicy(testd: AFile) {
  // Policy test uses SFile
  const sf = testd.sync().setPolicy({ topDir: testd.sync() });
  assert(sf.rel("test.txt").text() == ABCD);
  sf.rel("test3.txt").text(CDEF);
  assert.eq(sf.rel("test3.txt").text(), CDEF);
  assert.ensureError(function () {
    sf.rel("../rom/Actor.tonyu").text();
  });
  sf.rel("test3.txt").rm();
  assert(!await testd.rel("test3.txt").exists());
}

async function checkContentCopyApis(testd: AFile, fixture: AFile) {
  await fixture.rel("sub/test.png").copyTo(testd.rel("test.png"));
  await checkCopyFile(fixture.rel("Tonyu/Projects/MapTest/Test.tonyu"));
  await checkCopyFile(fixture.rel("Tonyu/Projects/MapTest/images/park.png"));
  await checkCopyFile(testd.rel("test.png"));
  await testd.rel("test.png").rm();
}

async function checkAppendAndMtime(fixture: AFile) {
  let beforeAppend = fixture.rel("Tonyu/Projects/MapTest/Test.tonyu");
  let appended = fixture.rel("Tonyu/Projects/MapTest/TestApp.tonyu");
  await beforeAppend.copyTo(appended);
  let apText = "\n//tuikasitayo-n\n";
  await appended.appendText(apText);
  assert.eq(await beforeAppend.text() + apText, await appended.text());
  await checkMtime(appended);
}

async function checkTextCopyAndRestore(testd: AFile, romd: AFile) {
  _console.log("text.txt", testd.rel("test.txt").path(), await testd.rel("test.txt").text());
  await testd.rel("test.txt").text(await romd.rel("Actor.tonyu").text() + ABCD + CDEF);
  await checkCopyFile(testd.rel("test.txt"));
  await testd.rel("test.txt").text(ABCD);
}

async function checkBlobRoundTrip(testd: AFile) {
  let f = testd.rel("hoge.txt");
  await f.text("hogefuga");
  await checkMtime(f);
  let tmp = testd.rel("fuga.txt");
  let b = await f.getBlob();
  _console.log("BLOB reading...", f.name(), tmp.name());
  await tmp.setBlob(b);
  checkSame(f.sync(), tmp.sync());
  _console.log("BLOB read done!", f.name(), tmp.name());
  await tmp.rm();
  await f.rm();
}

async function moveTest(testd: AFile) {
  let tmp1 = testd.rel("tmp1");
  await tmp1.mkdir();
  let tmp2 = testd.rel("tmp2");
  let sub = testd.rel("sub");
  let res1 = [] as string[];
  for await (let f of sub.recursive()) {
    res1.push(f.relPath(sub));
  }
  await sub.copyTo(tmp1);
  await tmp1.moveTo(tmp2);
  assert(!await tmp1.exists());
  let res2 = [] as string[];
  for await (let f of tmp2.recursive()) {
    res2.push(f.relPath(tmp2));
  }
  console.log("movetest", res1, res2);
  _assert.deepStrictEqual(res1, res2);
}

async function listFilesTest(romd: AFile) {
  eqa((await romd.listFiles()).map(f => f.name()), [
    "event/","graphics/","js/",
    "physics/", "sound/","t1/","thread/", "ui/",
    ".desktop", "Actor.tonyu", "BaseActor.tonyu",
    "Boot.tonyu", "MathMod.tonyu", "NoviceActor.tonyu",
    "options.json", "TObject.tonyu", "TQuery.tonyu"
  ]);
}

async function checkCopyFile(f: AFile) {
  let tmp = f.sibling("tmp_" + f.name());
  await f.copyTo(tmp);
  checkSame(f.sync(), tmp.sync());
  await tmp.text("DUMMY");

  let c = await f.getContent();
  await tmp.setContent(c);
  checkSame(f.sync(), tmp.sync());
  await tmp.text("DUMMY");

  if (f.isText()) {
    const t = await f.text();
    await tmp.text(t);
    checkSame(f.sync(), tmp.sync());
    await tmp.text("DUMMY");
  }

  const url = await f.dataURL();
  await tmp.dataURL(url);
  checkSame(f.sync(), tmp.sync());
  await tmp.text("DUMMY");

  let b = await f.getBytes();
  _console.log("f.getBytes", b);
  await tmp.setBytes(b);
  _console.log("tmp.getBytes", await tmp.getBytes());
  checkSame(f.sync(), tmp.sync());

  const c2 = Content.bin(b, f.contentType());
  const bins = c2.toArrayBuffer();
  _console.log("bins", b, c2, bins);
  await tmp.setBytes(bins);
  await tmp.text("DUMMY");

  if (f.isText()) {
    b = await f.getBytes();
    const ct = Content.bin(b, "text/plain");
    const t = ct.toPlainText();
    await tmp.setText(t);
    checkSame(f.sync(), tmp.sync());
    await tmp.text("DUMMY");
  }
  await retryRmdir(tmp.sync());
}

async function asyncTest(testd: AFile) {
  await checkWatch(testd);
}

async function checkWatch(testd: AFile) {
  const watchd = testd.rel("watch/");
  if (await watchd.exists()) await retryRmdir(watchd.sync());
  await watchd.mkdir();
  const buf = [] as string[];
  const w = watchd.watch((type, f) => {
    buf.push(type + ":" + f.relPath(watchd));
  });
  async function buildScrap(f: AFile, t = "aaa") {
    _console.log("buildScrap", f.path());
    await timeout(100);
    await f.text(t);
    await timeout(100);
    await f.text(t + "!");
    await timeout(100);
    await f.rm();
  }
  await buildScrap(watchd.rel("hogefuga.txt"));
  w.remove();
  await buildScrap(watchd.rel("hogefuga.txt"));
  await retryRmdir(watchd.sync());
  _console.log("checkWatch", buf);
  const uniq = (a: string[]) => {
    const has = new Set();
    const res = [] as string[];
    for (let e of a) {
      if (has.has(e)) continue;
      has.add(e);
      res.push(e);
    }
    return res;
  };
  _assert.deepStrictEqual(uniq(buf), uniq([
    'rename:hogefuga.txt',
    'change:hogefuga.txt',
  ]));
}

async function checkMtime(f: AFile) {
  const t = await f.lastUpdate();
  const nt = t - 30 * 60 * 1000;
  await f.setMetaInfo({lastUpdate: nt});
  _console.log("checkMtime", f.path(), t, nt);
  assert(Math.abs(await f.lastUpdate() - nt) < 2000);
}
