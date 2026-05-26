//@ts-check
/** 
 * @typedef { import("@hoge1e3/sfile").SFile } SFile
 * @typedef { import("./types").Menus } Menus
 * @typedef { import("./types").Menu } Menu
 * @typedef { import("./types").ShowModal } ShowModal
 * @typedef { import("./types").Splash } Splash
 * @typedef { import("./types").WireUIDC } WireUIDC
 * @typedef { import("./types").RootPackageJSON } RootPackageJSON
 * @typedef { import("./types.js").WSFileInfo } WSFileInfo
 */
import { getValue } from "./global.js";
import { getInstance } from "./pnode.js";
import { qsExists, timeout,can, getEnv } from "./util.js";
import { getMountPromise,readFstab, } from "./fstab.js";

let rmbtn=()=>{};
/**@type ShowModal */
export let showModal=(show)=>document.body;
/**@type Splash */
export let splash=async (mesg, dom)=>{};
/**@type (dc:WireUIDC)=>void*/
export function wireUI(dc){
  rmbtn=dc.rmbtn;
  showModal=dc.showModal;
  splash=dc.splash;
}
/**@type (...a:any[])=>void */
function status(...a){
    console.log(...a);
}
/**@type (url:string, dest:SFile)=>Promise<void> */
export async function unzipURL(url, dest) {
    status("Fetching: "+url);
    const response = await fetch(url);
    console.log("Downloading...");
    let blob=await response.blob();
    console.log("Unpacking");
    return await unzipBlob(blob,dest);
}
/**@type (blob:Blob, dest:SFile)=>Promise<void> */
export async function unzipBlob(blob, dest) {
    const pNode=getInstance();
    const FS=pNode.getFS();
    status("unzipping blob ");
    let zip=FS.get("/tmp/boot.zip");
    await zip.setBlob(blob);
    dest.mkdir();
    await FS.zip.unzip(zip,dest,{v:true});
}
/**@type (run:SFile)=>SFile */
export function fixrun(run){
    try{
        if(run.isDir())return run;
        const ls=run.ls();
        if(!ls.includes("package.json")&&
        ls.length==1){
            run=run.rel(ls[0]);
        }
    }catch(e){
        console.error(e);
    }
    return run;
}
/**@type (url:string)=>Promise<void> */
export async function networkBoot(url){
    await getMountPromise();
    const pNode=getInstance();
    let boot=pNode.file(getEnv("INSTALL_DIR"));
    let rescue=false;
    if (boot.exists()) {
        if (!confirm(`Found installation in '${process.env.INSTALL_DIR}'. Boot with Rescue mode in '${process.env.RESCUE_DIR}'.`)) return;
        boot=pNode.file(getEnv("RESCUE_DIR"));
        rescue=true;
    }
    process.env.boot=boot.path();
    process.env.installation=rescue?"rescue":"install";
    const c=await getValue("readyPromises").vConsole;
    if (c) c.show();
    await unzipURL(url, boot);
    status("Boot start!");
    rmbtn();
    await timeout(1);
    if (c) c.hide();
    const mod=await pNode.importModule(fixrun(boot));
    if(can(mod,"install")){
        /**@type {any} */
        const m=mod;
        m.install();
    }
}
export function insertBootDisk() {
    const pNode=getInstance();
    const cas=showModal(".upload");
    if (process.env.BOOT_DISK_URL) {
        const a=qsExists(cas, "a");
        a.innerHTML="Download Sample Boot Disk";
        a.setAttribute("href",process.env.BOOT_DISK_URL);
    }
    const file=qsExists(cas, ".file");
    file.addEventListener("input",async function () {
        const run=pNode.file(getEnv("RESCUE_DIR"));
        //@ts-ignore
        const file=this.files && this.files[0];
        if (!file) throw new Error("File is not selected.");
        const c=await getValue("readyPromises").vConsole;
        c?.show();
        await unzipBlob(file,run);
        c?.hide();
        rmbtn();
        showModal(false);
        const mod=await pNode.importModule(fixrun(run));
        if(can(mod,"install")){
            /**@type {any} */
            const m=mod;
            m.install();
        }
    });
}