import { isPlainObject } from "./util.js";

const g: any = globalThis;
const NAME = "pNodeBootLoader";
const pNodeBootLoader: any = g[NAME] || {};
g[NAME] = pNodeBootLoader;
export function getGlobal(): any {
    return pNodeBootLoader;
}
export function getValue(k: string): any {
    return pNodeBootLoader[k] || g[k];
}
export function pollute(o: object): void {
    assign(o, pNodeBootLoader);
    assign(o, globalThis);
}
export function assign(o: any, dst: any = pNodeBootLoader): void {
    for (let k in o) {
        if (isPlainObject(o[k]) && isPlainObject(dst[k])) {
            assign(o[k], dst[k]);
        } else {
            dst[k] = o[k];
        }
    }
}
export function assignDefault(o: any, dst: any = pNodeBootLoader): void {
    for (let k in o) {
        if (isPlainObject(o[k]) && isPlainObject(dst[k])) {
            assignDefault(o[k], dst[k]);
        } else {
            dst[k] = dst[k] || o[k];
        }
    }
}
assignDefault({
    version:"1.0.0",
    getValue,
    assign,
    assignDefault,
    pollute,
    env:{},
    readyPromises:{},
});
