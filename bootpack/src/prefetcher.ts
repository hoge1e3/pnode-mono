const g: any = globalThis;

import {mutablePromise,timeout} from "./util.js";
import { getInstance } from "./pnode.js";
import type { SFile } from "@hoge1e3/sfile";
import type {PrefetchScriptOptions} from "./types.js";
import type {ESModuleCompilerHandlers, IFileBasedModuleEntry, ICompiledESModule} from "petit-node/types/index.js";
let quick:boolean|undefined;
const handlers: ESModuleCompilerHandlers={
    async oncompilestart({entry}) {
        if(quick)return;
        await timeout(0);
        //console.log("Compile start ",entry.file.path());
    },
    async oncompiled({module}) {
        if(quick)return;
        await timeout(0);
        //console.log("Compile complete ",module.entry.file.path());
    },
    async oncachehit({entry}) {
        if(quick)return;
        await timeout(0);
        //if (entry) console.log("In cache ",entry.file.path());
    }
};
export function doQuick():void {
  quick=true;
}
export async function prefetchModule(file: SFile): Promise<ICompiledESModule> {
    const pNode=getInstance();
    const e=pNode.resolveEntry("import",file);
    const compiler=pNode.createESModuleCompiler(handlers);
    const r=await compiler.compile(e as IFileBasedModuleEntry);
    return r;
}
export function loadScriptTag(url: string, attr: Record<string,string> = {}): Promise<any> {
    if (attr.type!=="module" &&
    typeof (g as any).define==="function" && (g as any).define.amd &&
    typeof (g as any).requirejs==="function") {
        return new Promise(
        (s)=>(g as any).requirejs([url],(r:any)=>s(r)));
    }
    const script = document.createElement('script');
    script.src = url;
    for(let k in attr){
        script.setAttribute(k,attr[k]);
    }
    return new Promise<void>(
    function (resolve,reject){
        script.addEventListener("load",()=>resolve());
        script.addEventListener("error",reject);
        document.head.appendChild(script);
    });
}
/** {[key:url]:{value}} */
export const prefetched:{[key:string]:{value:any}}={};
export async function prefetchScript(url: string, options?: PrefetchScriptOptions): Promise<{value:any}> {
    const {module, global, }=options||{};
    if (prefetched[url]) {
        console.log("Using prefeteched",url);
        return prefetched[url];
    }
    /*if (dependencies) {
        await Promise.all(dependencies.map(url=>prefetchScript(url)));
    }*/
    if (module) {
        const value=await import(/* webpackIgnore: true */url);
        prefetched[url]={value};
        return prefetched[url];
    } else {
        await loadScriptTag(url);
        const value=(global?g[global]:null);
        prefetched[url]={value};
        return prefetched[url];
    }
}
