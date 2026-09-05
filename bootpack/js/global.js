import { isPlainObject } from "./util.js";
const g = globalThis;
const NAME = "pNodeBootLoader";
const pNodeBootLoader = g[NAME] || {};
g[NAME] = pNodeBootLoader;
export function getGlobal() {
    return pNodeBootLoader;
}
export function getValue(k) {
    return pNodeBootLoader[k] || g[k];
}
export function pollute(o) {
    assign(o, pNodeBootLoader);
    assign(o, globalThis);
}
export function assign(o, dst = pNodeBootLoader) {
    for (let k in o) {
        if (isPlainObject(o[k]) && isPlainObject(dst[k])) {
            assign(o[k], dst[k]);
        }
        else {
            dst[k] = o[k];
        }
    }
}
export function assignDefault(o, dst = pNodeBootLoader) {
    for (let k in o) {
        if (isPlainObject(o[k]) && isPlainObject(dst[k])) {
            assignDefault(o[k], dst[k]);
        }
        else {
            dst[k] = dst[k] || o[k];
        }
    }
}
assignDefault({
    version: "1.0.0",
    getValue,
    assign,
    assignDefault,
    pollute,
    env: {},
    readyPromises: {},
});
//# sourceMappingURL=global.js.map