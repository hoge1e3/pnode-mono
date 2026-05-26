//@ts-check
/**
 * @typedef { import("./types").Menus } Menus
 * @typedef { import("./types").Menu } Menu
 * @typedef { import("./types").ShowModal } ShowModal
 * @typedef { import("./types").RootPackageJSON } RootPackageJSON
 * @typedef { import("./types").PNode } PNode
 * @typedef { import("./types").PNodeCompileHandler } PNodeCompileHandler
 */
/** @type any */
const g=globalThis;

import {mutablePromise,timeout} from "./util.js";
import { getInstance } from "./pnode.js";
import { SFile } from "@hoge1e3/sfile";
import { ESModuleCompiler } from "petit-node/js/ESModule.js";
/**@type boolean */
let quick;
/**@type Partial<ESModuleCompiler> */
const handlers={
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
export function doQuick() {
  quick=true;
}
/**
 * 
 * @param {SFile} file 
 * @returns Promise<PNodeModule>
 */
export async function prefetchModule(file) {
    const pNode=getInstance();
    const e=pNode.resolveEntry("import",file);
    const compiler=pNode.createESModuleCompiler(handlers);
    const r=await compiler.compile(e);
    return r;
}
/**
 * 
 * @param {string} url 
 * @param {any} attr 
 * @returns 
 */
export function loadScriptTag(url,attr={}){
    if (attr.type!=="module" && 
    // @ts-ignore
    typeof define==="function" && define.amd && typeof requirejs==="function") {
        return new Promise(
        // @ts-ignore
        (s)=>requirejs([url],(r)=>s(r)));
    }
    const script = document.createElement('script');
    script.src = url;
    for(let k in attr){
        script.setAttribute(k,attr[k]);
    }
    return new Promise(
    function (resolve,reject){
        script.addEventListener("load",resolve);
        script.addEventListener("error",reject);
        document.head.appendChild(script);
    });
}
/**@type {{[key:string]:{value:any}}} */
export const prefetched={};// {[key:url]:{value}}
/**
 * 
 * @param {string} url 
 * @param {import("./types").PrefetchScriptOptions} [options]
 * @returns 
 */
export async function prefetchScript(url, options) {
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
