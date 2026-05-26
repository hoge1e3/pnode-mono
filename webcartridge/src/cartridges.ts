import type { Menus, Menu, ShowModal, Splash, WireUIDC, RootPackageJSON, WSFileInfo } from "./types.js";
import { getValue } from "./global.js";
import { fetchServed, serveBlob } from "./pwa.js";
import { qsExists, timeout, can, getEnv } from "./util.js";

let rmbtn = (): void => {};
const preinstalledPath="./preinstalled/package.json";
const rootPackageJsonPath = "boot/package.json";
export let showModal: ShowModal = (show?: string | boolean): HTMLElement => document.body;

export let splash: Splash = async (mesg: string, dom: HTMLElement): Promise<void> => {};

export function wireUI(dc: WireUIDC): void {
  rmbtn = dc.rmbtn;
  showModal = dc.showModal;
  splash = dc.splash;
}

export async function readPackagejsonRaw(): Promise<RootPackageJSON> {
    try {
        const resp = await fetchServed(rootPackageJsonPath);
        return (await resp.json()) as RootPackageJSON;
    } catch(e) {
        console.error(e);
        return { menus: {} };
    }
}
export async function readPackagejson(): Promise<RootPackageJSON> {
    const p=await readPackagejsonRaw();
    const preinstalledURL=new URL(preinstalledPath, location.href);
    try {
        const prep:RootPackageJSON=await (await fetch(preinstalledURL)).json();
        for (let k in prep.menus) {
            if (!p.menus[k]) {
                p.menus[k]=prep.menus[k];
                p.menus[k].main=new URL(p.menus[k].main, preinstalledURL).toString();
            }
        }
        return p;
    } catch(e){
        console.error(e);
        return p;
    }

}
export async function writePackageJson(p:RootPackageJSON) {
    return await serveBlob(rootPackageJsonPath, new Blob([JSON.stringify(p,null,2)],
        { type: "text/json;charset=utf8" }));
}

export function insert(): void {
    const cas = showModal(".upload");
    if (getEnv("BOOT_DISK_URL", null)) {
        const a = qsExists(cas, "a");
        a.innerHTML = "Download Sample Boot Disk";
        a.setAttribute("href", getEnv("BOOT_DISK_URL"));
    }
    const file = qsExists(cas, ".file");
    file.addEventListener("input", async function (this: HTMLInputElement) {
        const _file = this.files && this.files[0];
        const file: File = _file as File;
        if (!file) throw new Error("File is not selected.");
        const c = await getValue("readyPromises").vConsole;
        c?.show();
        splash("Serving " + file.name, cas);
        const url = await serveBlob("boot/" + file.name, file);
        const p = await readPackagejson();
        p.menus[file.name] = {
            main: url,
        };
        splash("Serving package.json", cas);
        await writePackageJson(p);
        
        c?.hide();
        showModal(false);
        location.reload();
    });
}
