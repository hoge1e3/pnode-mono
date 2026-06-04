import {DirectoryOptions, FileSystemFactory, SFile} from "../src/SFile.js";
import {assert} from "./helpers/assert.js";
import {_console} from "./helpers/logging.js";
import {eqa, retryRmdir} from "./helpers/files.js";
import {ABCD} from "./helpers/constants.js";

export type Pass2Context={
  FS:FileSystemFactory,
  fixture:SFile,
  testf:SFile,
};

export async function runPass2({FS, fixture, testf}:Pass2Context) {
  const romd = fixture.rel("rom/");
  const testd = FS.get(testf.text());
  assert(testd.name().match(/^testdir/));
  assert(testd.exists());
  _console.log("Enter", testd);
  const tmp2=testd.rel("tmp2");
  assert(tmp2.exists());
  await retryRmdir(tmp2);
  assert(testd.rel("test.txt").text() === ABCD);
  assert(testd.rel("sub/").exists());
  assert(testd.rel("sub/test2.txt").text() === romd.rel("Actor.tonyu").text());
  chkRecur(testd, {}, ["test.txt","sub/test2.txt"]);
  eqa(testd.ls(), ["test.txt","sub/"]);
  chkRecur(testd, { excludes: ["sub/"] }, ["test.txt"]);
  testd.rel("test.txt").rm();
  chkRecur(testd, {}, ["sub/test2.txt"]);
  _console.log("FULLL", testd.path());
  await retryRmdir(testd);
  assert(!testd.exists());
  testf.rm({ r: true });
  assert(!testf.exists());
  assert(!testd.rel("test.txt").exists());
  assert.eq(fixture.rel("sub/test2.txt").text(), romd.rel("Actor.tonyu").text());
  assert.eq(fixture.rel("test.txt").text(), ABCD);
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
