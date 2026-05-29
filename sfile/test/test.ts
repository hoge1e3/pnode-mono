import {FileSystemFactory} from "../src/SFile.js";
import {_console, alert} from "./helpers/logging.js";
import {timeout} from "./helpers/async.js";
import {checkCopyDir, retryRmdir} from "./helpers/files.js";
import {checkPathMethods} from "./helpers/path.js";
import {runPass1} from "./pass1.js";
import {runPass2} from "./pass2.js";
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
        await checkCopyDir(fixture);
        const r=fixture.rel.bind(fixture);
        const romd=r("rom/");
        checkPathMethods(FS, fixture);
        let ABCD = "abcd\nefg";
        let CDEF = "defg\nてすと";
        let ramd = fixture.rel("ram/");
        if(ramd.exists()) await retryRmdir(ramd);
        ramd.mkdir();
        const testf = fixture.rel("testfn.txt");
        cleanups.push(async ()=>testf.exists() && testf.rm());  
        if (!testf.exists()) {
            pass=1;
            _console.log("Test #", pass);
            await runPass1({fixture, romd, ramd, testf, ABCD, CDEF, cleanups});
        } else {
            pass=2;
            _console.log("Test #", pass);
            await runPass2({FS, fixture, romd, testf, ABCD});
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
}
// of main()
//(globalThis as any).main=main;
main();
