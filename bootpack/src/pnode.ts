//@ts-check
import { assign, pollute } from "./global.js";
import pNode from "petit-node";
/**
 * @typedef { import("./types").SFile } SFile
 * @typedef { import("./types").Menus } Menus
 * @typedef { import("./types").Menu } Menu
 * @typedef { import("./types").ShowModal } ShowModal
 * @typedef { import("./types").RootPackageJSON } RootPackageJSON
 * @typedef { import("./types").PNode } PNode
 */
export async function init(env={}){
    console.log("init");
    await pNode.boot();// 'process' is enabled here 
    Object.assign(process.env, env);
    process.env.PNODE_VER=pNode.version;
    //process.env.boot=process.env.TMP_BOOT||"/tmp/boot/";
    pollute({pNode, FS:pNode.getFS()});
    return pNode;
}
export function getInstance(){
    return pNode;
}
