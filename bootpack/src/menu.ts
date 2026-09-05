import { /*prefetchAuto ,*/ prefetchModule, doQuick } from "./prefetcher.js";
import { getInstance } from "./pnode.js";

import {networkBoot,insertBootDisk,
fixrun,wireUI} from "./boot.js";
import {getMountPromise} from "./fstab.js";
import { getValue } from "./global.js";
import { btn, showModal, splash, rmbtn as rmbtnWithoutQuick, uploadFile } from "./ui.js";
import { fullBackup, factoryReset, fullRestore } from "./backup.js";
import { _confirm, blob2arrayBuffer } from "./util.js";
import type { SFile } from "@hoge1e3/sfile";
import type { Menu, MenuButton, Menus, RootPackageJSON } from "./types.js";

export function rmbtn():void {
    rmbtnWithoutQuick();
    doQuick();
}
wireUI({rmbtn,showModal,splash});
export function showMenus(rootPkgJson: SFile): MenuButton[] {
    //const pNode=getInstance();
    //const FS=pNode.getFS();
    let res: MenuButton[]=[];

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
        if (await _confirm("Factory reset complete. reload?")) location.reload();
    });
    btn(["📦","Full backup"],()=>fullBackup());
    btn(["📤","Full restore"],async ()=>{
        const blob=await uploadFile();
        const arrayBuffer=await blob2arrayBuffer(blob);
        await fullRestore(arrayBuffer);
        if (await _confirm("Full restore complete. reload?")) location.reload();
    });
    btn(["💻","Console"],()=>showConsole());
    return res;
    //console.log("rp",rp.exists());
}
function showConsole():void {
    const vConsole=getValue("vConsole");
    if (vConsole) vConsole.show();
}
export function parseMenus(menus: Menus): Menus {
    for(let k in menus){
        const main:any=menus[k];
        if(typeof main==="string"){
            menus[k]={main};
        }
    }
    return menus;
}
export function scanPrefetchModule(rp: SFile):void {
    const pNode=getInstance();
    const FS=pNode.getFS();
    if (!rp.exists()) return;
    const o=rp.obj() as RootPackageJSON;
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
export function showMainmenus(rp: SFile): MenuButton[] {
    const o=rp.obj() as RootPackageJSON;
    //console.log("rp.obj",o);
    if(!o.menus)return[];
    const menus=parseMenus(o.menus);
    let hasAuto: boolean=false;
    const res: MenuButton[]=[];
    for(let k in menus){
      const v=menus[k];
        if (v.auto) hasAuto=true;
        let c: string|string[]=k;
        if(v.icontext){
          c=[v.icontext,k];
        }
        res.push(btn(c, ()=>runMenu(k,v)));//,v.auto);
    }
    //if (hasAuto) stopBtn();
    return res;
}
export async function runMenu(k: string, v: Menu): Promise<void> {
    try {
        const sp=showModal(".splash");
        await splash("Launching "+k,sp);
        const pNode=getInstance();
        const FS=pNode.getFS();
        const {main}=v;
        rmbtn();
        await splash("Waiting for disk ready",sp);
        await getMountPromise();
        await splash("disk ready",sp);
        const mainF=fixrun(FS.get(main));
        process.env.boot=mainF.path();
        await splash("start "+process.env.boot,sp);
        const mod:any=await pNode.importModule(mainF);
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
