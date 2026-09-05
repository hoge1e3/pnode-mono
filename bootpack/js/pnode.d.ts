import type { PNode } from "./types.js";
export declare function init(env?: {
    [key: string]: string;
}): Promise<PNode>;
export declare function getInstance(): PNode;
