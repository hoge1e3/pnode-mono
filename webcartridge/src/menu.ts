import type { Menus, Menu} from "./types.js";
import { insert, readPackagejson, wireUI } from "./cartridges.js";
import { getValue } from "./global.js";
import { btn, showModal, splash, rmbtn } from "./ui.js";
import { can } from "./util.js";


wireUI({ rmbtn, showModal, splash });

export async function showMenus(): Promise<void> {
    await showMainmenus();
    btn(["💾", "Add Cartridge"], () => insert());
    btn(["💻", "Console"], () => showConsole());
}

function showConsole(): void {
    const vConsole = getValue("vConsole");
    if (vConsole) vConsole.show();           
}

export function parseMenus(menus: Menus): Menus {
    for (let k in menus) {
        const main = menus[k];
        if (typeof main === "string") {
            menus[k] = { main };
        }
    }
    return menus;
}

export async function showMainmenus(): Promise<void> {
    const o = await readPackagejson();
    if (!o.menus) return;
    const menus = parseMenus(o.menus);
    let hasAuto: string | undefined;
    let cnt=0;
    for (let k of Object.keys(menus).sort((a,b)=>{
        const orda= menus[a].order||0;
        const ordb= menus[b].order||0;
        return orda-ordb;
    })) {
        const v = menus[k];
        if (v.secureAuto) hasAuto = k;
        let c: string | string[] = k;
        if (v.icontext) {
            c = [v.icontext, k];
        }
        cnt++;
        btn(c, () => runMenu(k, v));
    }
    if(cnt==1&&hasAuto){
      runMenu(hasAuto, menus[hasAuto]);
    }
}

export async function runMenu(k: string, v: Menu): Promise<void> {
    try {
        const sp = showModal(".splash");
        await splash("Launching " + k, sp);
        const { main,  submenus } = v;
        rmbtn();
        const mod = await import(/* webpackIgnore: true */main);
        await splash("impored " + k, sp);
        if (v.call) {
            const [n, ...a] = v.call;
            mod[n](...a);
        } else {
            if (can(mod, "onInitCartridge")) {
                await mod.onInitCartridge(v);
            }
        }
    } finally {
        showModal(false);
    }
}
