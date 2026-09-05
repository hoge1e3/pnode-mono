import MutablePromise from "mutable-promise";
export function getQueryString(key, default_ = "") {
    key = key.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + key + "=([^&#]*)");
    var qs = regex.exec(location.href);
    if (qs == null)
        return default_;
    else
        return decodeURLComponentEx(qs[1]);
}
export function decodeURLComponentEx(s) {
    return decodeURIComponent(s.replace(/\+/g, '%20'));
}
export function wrapException(f) {
    return async (...a) => {
        try {
            return await f(...a);
        }
        catch (e) {
            let buf = "";
            if (e?.message)
                buf += e.message;
            if (e?.stack)
                buf += e.stack;
            if (!buf)
                buf += e + "";
            alert(buf);
            throw e;
        }
    };
}
export function onReady(callback) {
    callback = wrapException(callback);
    if (document.readyState === "complete")
        callback.call(window, new Event("load"));
    else
        addEventListener("load", callback);
}
export function can(o, n) {
    return n in o && typeof o[n] === "function" && o[n];
}
export const timeout = (t) => new Promise(s => setTimeout(s, t));
export function mutablePromise() {
    return new MutablePromise();
}
export function isPlainObject(o) {
    return o && o.__proto__ === Object.prototype;
}
export function qsExists(...a) {
    const [root, q] = a.length >= 2 ? a : [document, a[0]];
    const r = root.querySelector(q);
    if (!r)
        throw new Error(`${q} does not exist`);
    return r;
}
export async function _confirm(p) {
    if (getQueryString("autostart")) {
        console.log("Confirm auto true", p);
        await timeout(1000);
        return true;
    }
    return confirm(p);
}
/**
 * @param {string} n
 * @returns string
 */
export function getEnv(n) {
    const r = process.env[n];
    if (!r)
        throw new Error(`No envvar for ${n}`);
    return r;
}
export function directorify(p) {
    if (!p.endsWith("/"))
        p += "/";
    return p;
}
export function blob2arrayBuffer(blob) {
    const r = mutablePromise();
    const f = new FileReader();
    f.onload = () => r.resolve(f.result);
    f.onerror = () => f.error && r.reject(f.error);
    f.readAsArrayBuffer(blob);
    return r;
}
//# sourceMappingURL=util.js.map