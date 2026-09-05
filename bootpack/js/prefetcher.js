const g = globalThis;
import { timeout } from "./util.js";
import { getInstance } from "./pnode.js";
let quick;
const handlers = {
    async oncompilestart({ entry }) {
        if (quick)
            return;
        await timeout(0);
        //console.log("Compile start ",entry.file.path());
    },
    async oncompiled({ module }) {
        if (quick)
            return;
        await timeout(0);
        //console.log("Compile complete ",module.entry.file.path());
    },
    async oncachehit({ entry }) {
        if (quick)
            return;
        await timeout(0);
        //if (entry) console.log("In cache ",entry.file.path());
    }
};
export function doQuick() {
    quick = true;
}
export async function prefetchModule(file) {
    const pNode = getInstance();
    const e = pNode.resolveEntry("import", file);
    const compiler = pNode.createESModuleCompiler(handlers);
    const r = await compiler.compile(e);
    return r;
}
export function loadScriptTag(url, attr = {}) {
    if (attr.type !== "module" &&
        typeof g.define === "function" && g.define.amd &&
        typeof g.requirejs === "function") {
        return new Promise((s) => g.requirejs([url], (r) => s(r)));
    }
    const script = document.createElement('script');
    script.src = url;
    for (let k in attr) {
        script.setAttribute(k, attr[k]);
    }
    return new Promise(function (resolve, reject) {
        script.addEventListener("load", () => resolve());
        script.addEventListener("error", reject);
        document.head.appendChild(script);
    });
}
/** {[key:url]:{value}} */
export const prefetched = {};
export async function prefetchScript(url, options) {
    const { module, global, } = options || {};
    if (prefetched[url]) {
        console.log("Using prefeteched", url);
        return prefetched[url];
    }
    /*if (dependencies) {
        await Promise.all(dependencies.map(url=>prefetchScript(url)));
    }*/
    if (module) {
        const value = await import(/* webpackIgnore: true */ url);
        prefetched[url] = { value };
        return prefetched[url];
    }
    else {
        await loadScriptTag(url);
        const value = (global ? g[global] : null);
        prefetched[url] = { value };
        return prefetched[url];
    }
}
//# sourceMappingURL=prefetcher.js.map