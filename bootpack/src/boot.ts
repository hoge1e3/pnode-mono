import type { SFile } from "@hoge1e3/sfile";
import type { Splash, ShowModal, WireUIDC } from "./types.js";
import { getValue } from "./global.js";
import { getInstance } from "./pnode.js";
import { qsExists, timeout,can, getEnv, _confirm } from "./util.js";
import { getMountPromise } from "./fstab.js";

let rmbtn:()=>void=()=>{};
export let showModal:ShowModal=(show)=>document.body;
export let splash:Splash=async (mesg, dom)=>{};
export function wireUI(dc: WireUIDC):void {
  rmbtn=dc.rmbtn;
  showModal=dc.showModal;
  splash=dc.splash;
}
function status(...a: any[]):void {
    console.log(...a);
}
export async function unzipURL(url: string, dest: SFile): Promise<void> {
    status("Fetching: "+url);
    const response = await fetch(url);
    console.log("Downloading...");
    let blob=await response.blob();
    console.log("Unpacking");
    return await unzipBlob(blob,dest);
}
export async function unzipBlob(blob: Blob, dest: SFile): Promise<void> {
    const pNode=getInstance();
    const FS=pNode.getFS();
    status("unzipping blob ");
    let zip=FS.get("/tmp/boot.zip");
    await zip.setBlob(blob);
    dest.mkdir();
    await FS.zip.unzip(zip,dest,{v:false});
}
export function fixrun(run: SFile): SFile {
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
export async function networkBoot(url: string): Promise<void> {
    await getMountPromise();
    const pNode=getInstance();
    let boot=pNode.file(getEnv("INSTALL_DIR"));
    let rescue=false;
    if (boot.exists()) {
        if (!await _confirm(`Found installation in '${process.env.INSTALL_DIR}'. Boot with Rescue mode in '${process.env.RESCUE_DIR}'.`)) return;
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
    const mod:any = await pNode.importModule(fixrun(boot));
    if(can(mod,"install")){
        mod.install();
    }
}
export function insertBootDisk():void {
    const pNode=getInstance();
    const cas=showModal(".upload");
    if (process.env.BOOT_DISK_URL) {
        const a=qsExists(cas, "a");
        a.innerHTML="Download Sample Boot Disk";
        a.setAttribute("href",process.env.BOOT_DISK_URL);
    }
    const file=qsExists(cas, ".file");
    file.addEventListener("input",async function (this: HTMLInputElement) {
        const run=pNode.file(getEnv("RESCUE_DIR"));
        const f=this.files && this.files[0];
        if (!f) throw new Error("File is not selected.");
        const c=await getValue("readyPromises").vConsole;
        c?.show();
        await unzipBlob(f,run);
        c?.hide();
        rmbtn();
        showModal(false);
        const mod:any = await pNode.importModule(fixrun(run));
        if(can(mod,"install")){
            mod.install();
        }
    });
}
