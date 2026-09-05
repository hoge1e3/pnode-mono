import MutablePromise from "mutable-promise";
export declare function getQueryString(key: string, default_?: string): string;
export declare function decodeURLComponentEx(s: string): string;
export declare function wrapException<T extends (...a: any[]) => Promise<void>>(f: T): (...a: Parameters<T>) => Promise<void>;
export declare function onReady(callback: (this: Window, e: Event) => any): void;
export declare function can(o: any, n: string): any;
export declare const timeout: (t: number) => Promise<void>;
export declare function mutablePromise<T = void>(): MutablePromise<T>;
export declare function isPlainObject(o: any): boolean;
export declare function qsExists(root: HTMLElement | Document, q: string): HTMLElement;
export declare function qsExists(q: string): HTMLElement;
export declare function _confirm(p: string): Promise<boolean>;
/**
 * @param {string} n
 * @returns string
 */
export declare function getEnv(n: string): string;
export declare function directorify(p: string): string;
export declare function blob2arrayBuffer(blob: Blob): Promise<ArrayBuffer>;
