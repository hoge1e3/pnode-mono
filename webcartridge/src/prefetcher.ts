import type { PrefetchScriptOptions } from "./types.js";

const g: any = globalThis;

export function loadScriptTag(url: string, attr: Record<string, string> = {}): Promise<void> {
    if (attr.type !== "module" && 
        typeof (g as any).define === "function" && 
        (g as any).define.amd && 
        typeof (g as any).requirejs === "function") {
        return new Promise((s) => (g as any).requirejs([url], (r: any) => s(r)));
    }
    const script = document.createElement('script');
    script.src = url;
    for (let k in attr) {
        script.setAttribute(k, attr[k]);
    }
    return new Promise<void>((resolve, reject) => {
        script.addEventListener("load", () => resolve());
        script.addEventListener("error", reject);
        document.head.appendChild(script);
    });
}

export interface PrefetchedValue {
    value: any;
}

export const prefetched: { [key: string]: PrefetchedValue } = {};

export async function prefetchScript(url: string, options?: PrefetchScriptOptions): Promise<PrefetchedValue> {
    const { module, global } = options || {};
    if (prefetched[url]) {
        console.log("Using prefeteched", url);
        return prefetched[url];
    }
    
    if (module) {
        const value = await import(/* webpackIgnore: true */url);
        prefetched[url] = { value };
        return prefetched[url];
    } else {
        await loadScriptTag(url);
        const value = (global ? g[global] : null);
        prefetched[url] = { value };
        return prefetched[url];
    }
}
