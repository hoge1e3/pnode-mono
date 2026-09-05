import { assign, pollute } from "./global.js";
import type { PNode } from "./types.js";
import pNode from "petit-node";
export async function init(env:{[key:string]:string}={}):Promise<PNode>{
    console.log("init");
    await pNode.boot();// 'process' is enabled here
    Object.assign(process.env, env);
    process.env.PNODE_VER=pNode.version;
    //process.env.boot=process.env.TMP_BOOT||"/tmp/boot/";
    pollute({pNode, FS:pNode.getFS()});
    return pNode;
}
export function getInstance():PNode{
    return pNode;
}
