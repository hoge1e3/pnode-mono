import {DirectoryOptions, AFile} from "../src/SFile.js";
import {assert} from "./helpers/assert.js";
import {_console} from "./helpers/logging.js";
import {eqa, retryRmdir} from "./helpers/files.js";
import {ABCD} from "./helpers/constants.js";
import {Pass2Context} from "./pass2.js";

export async function runPass2(ctx: Pass2Context) {
  const {FS} = ctx;
  const fixture = ctx.fixture.async();
  const romd = fixture.rel("rom/").async();
  const testf   = ctx.testf.async();

  const testd = FS.afile(await testf.text());
  assert(testd.name().match(/^testdir/));
  assert(await testd.exists());
  _console.log("Enter", testd);
  const tmp2 = testd.rel("tmp2");
  assert(await tmp2.exists());
  await retryRmdir(tmp2.sync());
  assert(await testd.rel("test.txt").text() === ABCD);
  assert(await testd.rel("sub/").exists());
  assert(await testd.rel("sub/test2.txt").text() === await romd.rel("Actor.tonyu").text());
  await chkRecur(testd, {}, ["test.txt","sub/test2.txt"]);
  eqa(await testd.ls(), ["test.txt","sub/"]);
  await chkRecur(testd, { excludes: ["sub/"] }, ["test.txt"]);
  await testd.rel("test.txt").rm();
  await chkRecur(testd, {}, ["sub/test2.txt"]);
  _console.log("FULLL", testd.path());
  await retryRmdir(testd.sync());
  assert(!await testd.exists());
  await testf.rm({ r: true });
  assert(!await testf.exists());
  assert(!await testd.rel("test.txt").exists());
  assert.eq(await fixture.rel("sub/test2.txt").text(), await romd.rel("Actor.tonyu").text());
  assert.eq(await fixture.rel("test.txt").text(), ABCD);
}

async function chkRecur(dir: AFile, options: DirectoryOptions, result: string[]) {
  const di = [] as string[];
  for await (const f of dir.recursive(options)) {
    di.push(f.relPath(dir));
  }
  eqa(di, result);
}
