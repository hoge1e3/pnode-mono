import { assign, pollute } from "./global.js";
import MutablePromise from "mutable-promise";
export async function installPWA(swurl: string): Promise<void> {
    try {
        const registration = await navigator.serviceWorker.register(swurl, { type: 'module' });
        await navigator.serviceWorker.ready;
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        console.log("registration", registration);
        const sw = registration.active;
        if (!sw) {
            throw new Error("sw is not found");
        }
        pollute({ __serviceWorker__: sw });
        navigator.serviceWorker.addEventListener("message", ({ data }) => {
            console.log("CACHE_NAME", data.CACHE_NAME);
            pollute({ __CACHE_NAME__: data.CACHE_NAME });
        }, { once: true });
        sw.postMessage({ type: "CACHE_NAME" });
        if (!navigator.serviceWorker.controller) {
            if(confirm("Service worker installed. reload?")) location.reload();
        }
    } catch(err) {
        console.error(err);
        console.log('ServiceWorker registration failed: ', err);
    }
}

export async function postToSw(data: object): Promise<void> {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage(data);
}

export async function serveBlob(path: string, blob: Blob): Promise<string> {
    const mp = new MutablePromise<string>();
    const url = await path2url(path);
    navigator.serviceWorker.addEventListener("message", respHandler);
    
    function respHandler(event: MessageEvent): void {
        const data = event.data;
        if (!data) return;
        if (data.type !== "response") return;
        if (data.for !== "serve_blob") return;
        if (data.url !== url) return;
        navigator.serviceWorker.removeEventListener("message", respHandler);
        mp.resolve(url);
    }
    
    postToSw({ type: "serve_blob", url, blob });
    return mp;
}

export async function path2url(path: string): Promise<string> {
    const reg = await navigator.serviceWorker.ready;
    let base = reg.scope;
    if (!base.endsWith("/")) base += "/";
    if (path.startsWith("/")) path = path.substring(1);
    return base + "gen/" + path;
}

export async function fetchServed(path: string): Promise<Response> {
    const resp = await fetch(await path2url(path));
    return resp;
}
