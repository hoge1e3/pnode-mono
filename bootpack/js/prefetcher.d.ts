import type { SFile } from "@hoge1e3/sfile";
import type { PrefetchScriptOptions } from "./types.js";
import type { ICompiledESModule } from "petit-node/types/index.js";
export declare function doQuick(): void;
export declare function prefetchModule(file: SFile): Promise<ICompiledESModule>;
export declare function loadScriptTag(url: string, attr?: Record<string, string>): Promise<any>;
/** {[key:url]:{value}} */
export declare const prefetched: {
    [key: string]: {
        value: any;
    };
};
export declare function prefetchScript(url: string, options?: PrefetchScriptOptions): Promise<{
    value: any;
}>;
