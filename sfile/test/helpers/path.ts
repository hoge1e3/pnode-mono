import {FileSystemFactory, SFile} from "../../src/SFile.js";
import {assert} from "./assert.js";
import {_console} from "./logging.js";

export function checkPathMethods(FS:FileSystemFactory, fixture:SFile) {
  assert(!FS.get("/").up());
  const r=fixture.rel.bind(fixture);

  assert.eq(r("a/b/c").relPath(r("a/b/")) , "c");
  assert.eq(r("a/b/c").relPath(fixture.rel("a/b/")) , "c");
  assert(r("a/b/c/").path().endsWith("/"), "endsWith/ "+r("a/b/c/").path());
  assert(r("a/b/c/").isDirPath(), "dirpath");
  assert.eq(r("a/b/c/").relPath(r("a/b/")) ,"c/");
  assert.eq(r("a/b/c/").relPath(r("a/b/c/d")) , "../");
  assert.eq(r("a/b/c/").relPath(r("a/b/e/f")) , "../../c/");

  assert.eq(fixture.rel("test.txt").ext(), ".txt");

  _console.log("isChildOf", r("hoge/fuga\\"),(r("hoge\\fuga/piyo//")));
  assert(r("hoge/fuga\\").contains(r("hoge\\fuga/piyo//")), "isChildOf");
  assert(!r("hoge/fugo\\").contains(r("hoge\\fuga/piyo//")), "!isChildOf");

  checkTruncSep(FS);
}

function checkTruncSep(FS:FileSystemFactory) {
  assert.eq(FS.get("/tmp/test/").name(), "test/");
  assert.eq(FS.get("/tmp/test/").truncSep(), "test");
  assert.eq(FS.get("/tmp/test").name(), "test");
  assert.eq(FS.get("/tmp/test").truncSep(), "test");
}
