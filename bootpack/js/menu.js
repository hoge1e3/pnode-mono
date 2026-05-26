//@ts-check
/** 
 * @typedef { import("./types").Menus } Menus
 * @typedef { import("./types").Menu } Menu
 * @typedef { import("./types").ShowModal } ShowModal
 * @typedef { import("./types").RootPackageJSON } RootPackageJSON
 */

import { /*prefetchAuto ,*/ prefetchModule, doQuick } from "./prefetcher.js";
import { getInstance } from "./pnode.js";

import {networkBoot,insertBootDisk,
fixrun,wireUI} from "./boot.js";
import {getMountPromise} from "./fstab.js";
import { getValue } from "./global.js";
import { btn, showModal, splash, rmbtn as rmbtnWithoutQuick, uploadFile } from "./ui.js";
import { fullBackup, factoryReset, fullRestore } from "./backup.js";
import { blob2arrayBuffer } from "./util.js";
import { SFile } from "@hoge1e3/sfile";

export function rmbtn(){
    rmbtnWithoutQuick();
    doQuick();
}
wireUI({rmbtn,showModal,splash});
/** @type (rp:SFile)=>any[] */
export function showMenus(rootPkgJson){
    //const pNode=getInstance();
    //const FS=pNode.getFS();
    /**@type any[] */
    let res=[];
    
    if(rootPkgJson.exists()){
        // ensure factory reset, evan if failed by file system inconsistency. 
        // (for example, /package.json entry is in / but not in localStorage)
        try{
            res=showMainmenus(rootPkgJson);
        }catch(e) {
            console.error(e);
            alert(e);
        }
    }
    const su=process.env.SETUP_URL;
    if (su) {
        btn(["💿","Install/Rescue"],()=>networkBoot(su));
    }
    btn(["💾","Insert Boot Disk"],()=>insertBootDisk());
    btn(["💣","Factory Reset"],async ()=>{
        if(prompt("type 'really' to clear all data")!=="really")return;
        await factoryReset();
        if (confirm("Factory reset complete. reload?")) location.reload();
    });
    btn(["📦","Full backup"],()=>fullBackup());
    btn(["📤","Full restore"],async ()=>{
        const blob=await uploadFile();
        const arrayBuffer=await blob2arrayBuffer(blob);
        await fullRestore(arrayBuffer);
        if (confirm("Full restore complete. reload?")) location.reload();
    });
    btn(["💻","Console"],()=>showConsole());
    return res;
    //console.log("rp",rp.exists());
}
function showConsole(){
    const vConsole=getValue("vConsole");
    if (vConsole) vConsole.show();           
}
/**@param {Menus} menus */
export function parseMenus(menus){
    for(let k in menus){
        const main=menus[k];
        if(typeof main==="string"){
            menus[k]={main};
        }
    }
    return menus;
}
/**@param {SFile} rp */
export function scanPrefetchModule(rp) {
    const pNode=getInstance();
    const FS=pNode.getFS();
    if (!rp.exists()) return;
    /**@type {any} */
    const _o=rp.obj();
    /**@type {RootPackageJSON} */
    const o=_o;
    if(!o.menus) return;
    if (o.prefetch) {
        try {
            for (let m of o.prefetch) {
                prefetchModule(FS.get(m));
            }
        } catch(e){
            console.error(e);
        }
    }
}
/** @param {SFile} rp */
export function showMainmenus(rp) {
    /**@type {any} */
    const _o=rp.obj();
    /**@type {RootPackageJSON} */
    const o=_o;
    //console.log("rp.obj",o);
    if(!o.menus)return[];
    const menus=parseMenus(o.menus);
    let hasAuto;
    const res=[];
    for(let k in menus){
      const v=menus[k];
        if (v.auto) hasAuto=true;
        /**@type string|string[] */
        let c=k;
        if(v.icontext){
          c=[v.icontext,k];
        }
        res.push(btn(c, ()=>runMenu(k,v)));//,v.auto);
    }
    //if (hasAuto) stopBtn();
    return res;
}
/**
 * @param {string} k 
 * @param {Menu} v 
*/
export async function runMenu(k,v){
    try {
        const sp=showModal(".splash");
        await splash("Launching "+k,sp);
        const pNode=getInstance();
        const FS=pNode.getFS();
        const {main,auto, submenus}=v;
        rmbtn();
        await splash("Waiting for disk ready",sp);
        await getMountPromise();
        await splash("disk ready",sp);
        const mainF=fixrun(FS.get(main));
        process.env.boot=mainF.path();
        await splash("start "+process.env.boot,sp);
        /**@type{any} */
        const mod=await pNode.importModule(mainF);
        await splash("impored "+mainF,sp);
        if(v.call){
          const [n,...a]=v.call;
          mod[n](...a);
        }
        //}  
    } finally {
        showModal(false);
    }
}