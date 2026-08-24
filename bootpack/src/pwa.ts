//@ts-check
import {assign, pollute} from "./global.js";
export async function installPWA(swurl="./sw.js"){
    try {
        const registration=await navigator.serviceWorker.register(swurl);
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        console.log("registration",registration);
        const sw=registration.active;
        if (!sw) {
            throw new Error("sw is not found");
        }
        pollute({__serviceWorker__:sw});
        navigator.serviceWorker.addEventListener("message",({data})=>{
            console.log("CACHE_NAME",data.CACHE_NAME);
            pollute({__CACHE_NAME__:data.CACHE_NAME});
        });
        sw.postMessage("");
    }catch(err) {
        console.error(err);
        console.log('ServiceWorker registration failed: ', err);
    }
}
