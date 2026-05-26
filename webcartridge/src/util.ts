import { getValue } from "./global.js";
import MutablePromise from "mutable-promise";

export function getQueryString(key: string, default_?: string): string | undefined {
    if (arguments.length === 1) default_ = "";
    key = key.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + key + "=([^&#]*)");
    var qs = regex.exec(location.href);
    if (qs == null) return default_;
    else return decodeURLComponentEx(qs[1]);
}

export function decodeURLComponentEx(s: string): string {
    return decodeURIComponent(s.replace(/\+/g, '%20'));
}

export function wrapException<T extends (...a: any[]) => Promise<void>>(f: T): (...a: Parameters<T>) => Promise<void> {
  return async (...a: Parameters<T>): Promise<void> => {
    try {
      return await f(...a);
    } catch (e: any) {
      let buf = "";
      if (e?.message) buf += e.message;
      if (e?.stack) buf += e.stack;
      if (!buf) buf += e + ""; 
      alert(buf);
      throw e;
    }
  };
}

export function onReady(callback: (this: Window, e: Event) => any): void {
  const wrappedCallback = wrapException(callback);
  if (document.readyState === "complete") wrappedCallback.call(window, new Event("load"));
  else addEventListener("load", wrappedCallback);
}

export function can(o: any, n: string): boolean {
  return n in o && typeof o[n] === "function" && o[n];
}

export const timeout = (t: number): Promise<void> => new Promise(s => setTimeout(s, t));
export function isPlainObject(o: any): boolean {
    return o && o.__proto__ === Object.prototype;
}

export function qsExists(root: HTMLElement | Document, q: string): HTMLElement;
export function qsExists(q: string): HTMLElement;
export function qsExists(...a: any[]): HTMLElement {
    const [root, q] = a.length >= 2 ? a : [document, a[0]];
    const r = root.querySelector(q) as HTMLElement;
    if (!r) throw new Error(`${q} does not exist`);
    return r;
}

export function getEnv(n: string, def?: any): string {
  const r = getValue("env")[n];
  if (!r) {
    if (def !== undefined) return def;
    throw new Error(`No envvar for ${n}`);
  }
  return r;
}

export function directorify(p: string): string {
  if (!p.endsWith("/")) p += "/";
  return p;
}

export function blob2arrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  const r = new MutablePromise<ArrayBuffer>();
  const f = new FileReader();
  f.onload = () => r.resolve(f.result as ArrayBuffer);
  f.onerror = () => f.error && r.reject(f.error);
  f.readAsArrayBuffer(blob);
  return r;
}
