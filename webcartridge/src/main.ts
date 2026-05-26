import "../css/file-icon.css";
import "../css/style.css";

import { onReady, timeout} from "./util.js";
import { showMenus } from "./menu.js";
import { prefetchScript } from "./prefetcher.js";
import { installPWA } from "./pwa.js";
import { getValue, assignDefault, assign, pollute } from "./global.js";
import { showModal, splash } from "./ui.js";
import MutablePromise from "mutable-promise";
import { startSerivceWorker } from "./sw.js";
if (typeof window!=="undefined") {
    onReady(onload);
    pollute({ prefetchScript });
    assign({
        readyPromises: {
            vConsole: new MutablePromise(),
        }
    });
} else {
    startSerivceWorker();
}

async function onload(): Promise<void> {
    const sp = showModal(".splash");
    await splash("Loading petit-node", sp);    
    await installPWA("./webcartridge.js");
    if (!localStorage["/"] ) {
        localStorage["/"] = "{}";
    }
    prefetch().then(() => {
        console.log("Scripts prefetched.");
    });
    getValue("readyPromises").vConsole.then(() => {
        // console.log("petit-node ver.", pNode.version);
    });
    showModal();
    showMenus();
    console.log("Prefetching scripts");
    await timeout(1);
}

function initVConsole(): void {
    const VConsole = getValue("VConsole");
    const vConsole = new VConsole();
    assignDefault({ vConsole });
    vConsole.hideSwitch();
    getValue("readyPromises").vConsole.resolve(vConsole);
}

function prefetch(): Promise<any[]> {
    const cdn = "https://cdn.jsdelivr.net/npm/";
    
    const to_p = (u: string | Promise<any>): Promise<any> =>
        typeof u === "string" ? prefetchScript(cdn + u) : u;
    
    const para = (...a: (string | Promise<any>)[]): Promise<any[]> => 
        Promise.all(a.map(to_p));
    
    const seq = async (...a: (string | Promise<any>)[]): Promise<any[]> => {
        const r: any[] = [];
        for (let u of a) r.push(await to_p(u));
        return r;
    };
    
    const post = (p: string | Promise<any>, f: (r: any) => any): Promise<any> => 
        to_p(p).then(f);
    /*
    Why only these libraries? (Why white-listed?)
    Because some library may destroy DOM on just loaded, It may be unrecoverable service worker state.
    */
    return para(
        "stacktrace-js/dist/stacktrace.js",
        "jquery@1.12.1/dist/jquery.min.js",
        post("vconsole@latest/dist/vconsole.min.js", initVConsole),
        seq(
            "ace-builds@1.39.0/src-noconflict/ace.js",
            "ace-builds@1.39.0/src-noconflict/ext-language_tools.js"
        )
    );
}
