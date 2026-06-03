import {FileSystemFactory, SFile} from "../src/SFile.js";
import {_console, alert} from "./helpers/logging.js";
import {timeout} from "./helpers/async.js";
import {checkCopyDir, retryRmdir} from "./helpers/files.js";
import {checkPathMethods} from "./helpers/path.js";
import type {Pass1Context} from "./pass1.js";
import type {Pass2Context} from "./pass2.js";
declare const location:any;


export type SetupResult = {
  root?: SFile;
  fixture: SFile;
  romd: SFile;
  ramd: SFile;
  testf: SFile;
  testd: SFile;
  cleanups: (()=>Promise<any>)[];
  /** If true, skip retryRmdir(ramd) after tests (e.g. ramd is a mount point) */
  skipRamdCleanup?: boolean;
};

export type MainOptions = {
  runPass1: (ctx: Pass1Context) => Promise<void>;
  runPass2: (ctx: Pass2Context) => Promise<void>;
  /** Override fixture setup. Return SetupResult to skip default setup. */
  setup?: (FS: FileSystemFactory, cleanups: (()=>Promise<any>)[]) => Promise<SetupResult>;
  /** Provide a pre-built FileSystemFactory (e.g. in browser environments) */
  FS?: FileSystemFactory;
};

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

export async function defaultSetup(FS: FileSystemFactory, cleanups: (()=>Promise<any>)[]): Promise<SetupResult> {
  const here = FS.get(import.meta.url);
  const fixtureInSameDir = here.sibling("fixture/");
  const fixture = fixtureInSameDir.exists() ? fixtureInSameDir : here.sibling("../../test/fixture/");
  await checkCopyDir(fixture);
  const romd = fixture.rel("rom/");
  checkPathMethods(FS, fixture);
  let ramd = fixture.rel("ram/");
  if (ramd.exists()) await retryRmdir(ramd);
  ramd.mkdir();
  const testf = fixture.rel("testfn.txt");
  cleanups.push(async () => testf.exists() && testf.rm());
  const testd = fixture.rel(/*Math.random()*/"testdir" + "/");
  return {fixture, romd, ramd, testf, testd, cleanups};
}

export async function main(options: MainOptions) {
    const {runPass1, runPass2, setup = defaultSetup, FS: optFS} = options;

    let pass: number = 0;
    const cleanups = [] as (()=>Promise<any>)[];
    try {
        const FS = optFS ?? await getNodeFS();
        _console.log("metaurl", import.meta.url);
        console.log(FS.get("/"));
        console.log(FS.get("/").up());

        const {root, fixture, romd, ramd, testf, testd, skipRamdCleanup} = await setup(FS, cleanups);

        if (!testf.exists()) {
            pass = 1;
            _console.log("Test #", pass);
            await runPass1({root, fixture, romd, ramd, testd, testf, cleanups});
        } else {
            pass = 2;
            _console.log("Test #", pass);
            await runPass2({root, FS, fixture, romd, testf});
        }
        if (!skipRamdCleanup && ramd.exists()) await retryRmdir(ramd);
        console.log("passed", "#"+pass);
        if (pass == 1) {
            await timeout(1000);
            if (typeof location !== "undefined" && !location.href.match(/pass1only/)) location.reload();
        } else {
            console.log("All test passed.");
        }
    } catch (e) {
        if (typeof process!=="undefined")process.exitCode = 1;
        console.log((e as any).stack);
        alert("#"+pass+" test Failed. "+e);
        try {
            for (let c of cleanups) await c();
        } catch (e) {
            _console.error(e);
        }
        console.log("Unknown tags:", JSON.stringify(_console.unknownlist,null,2));
    }
}
