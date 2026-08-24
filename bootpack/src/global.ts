//@ts-check
import { isPlainObject } from "./util.js";

/** @type any */
const g=globalThis;
const NAME="pNodeBootLoader";
/** @type any */
const pNodeBootLoader=g[NAME]||{};
g[NAME]=pNodeBootLoader;
export function getGlobal() {
    return pNodeBootLoader;
}
/**
 * @param {string} k 
 * @returns any
 */
export function getValue(k) {
    return pNodeBootLoader[k] || g[k];
}
/**
 * @param {object} o 
 */
export function pollute(o) {
    assign(o, pNodeBootLoader);
    assign(o, globalThis);
}
/**
 * @param {any} o 
 */
export function assign(o, dst=pNodeBootLoader) {
    for (let k in o) {
        if (isPlainObject(o[k]) && isPlainObject(dst[k])) {
            assign(o[k], dst[k]);
        } else {
            dst[k]=o[k];
        }
    }
}
/**
 * @param {any} o 
 */
export function assignDefault(o, dst=pNodeBootLoader) {
    for (let k in o) {
        if (isPlainObject(o[k]) && isPlainObject(dst[k])) {
            assignDefault(o[k], dst[k]);
        } else {
            dst[k]=dst[k]||o[k];
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