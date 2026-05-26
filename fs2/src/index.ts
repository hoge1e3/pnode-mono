import {PathUtil, fs, dev, path, os, process, Buffer} from "petit-fs";
export {PathUtil, getRootFS, fs, dev, path, os, process, Buffer, LSFS} from "petit-fs";
import {FileSystemFactory, Policy, SFile} from "@hoge1e3/sfile";
export {zip} from "./zip.js";
import _JSZip from "jszip";
import { FSTypeName, IFileSystem } from "petit-fs/src/fs/types.js";
export const JSZip = _JSZip;
//import * as exp from "node:constants";
export {SFile} from "@hoge1e3/sfile"
export const nodePolyfill={fs,dev,path,os,process,Buffer};
export const FS = new FileSystemFactory({
    fs:fs as unknown as (typeof import("node:fs")), 
    path: path as unknown as (typeof import("node:path")),
    Buffer
});
export function get(path:string){return FS.get(path);}
export function setDefaultPolicy(policy?:Policy) {return FS.setDefaultPolicy(policy);}
export function mount(mountPoint:string, fs:FSTypeName, options:any={}):IFileSystem{
    return nodePolyfill.dev.mountSync(mountPoint, fs, options);
}
export async function mountAsync(mountPoint:string, fs:FSTypeName, options:any={}):Promise<IFileSystem>{
    return await nodePolyfill.dev.mount(mountPoint, fs, options);
}

export function unmount(mountPoint:string){
  nodePolyfill.dev.unmount(mountPoint)
}
export function getEnv(name:string):string;
export function getEnv():typeof process.env;
export function getEnv(name?:string){
    return name==null? process.env : process.env[name];
}
export function setEnv(name:string, value:string){
    process.env[name]=value;
}
export function init(){

}
/*
o FS.get
o FS.setEnv
o FS.PathUtil
o FS.getEnv
o FS.getRootFS
o FS.getRootFS.availFSTypes
o FS.LSFS
o FS.mount
o FS.mountSync
* FS.unmount
o FS.SFile.is
o FS.resolve
* FS.zip.zip.apply
* FS.zip
* FS.zip.unzip.apply
*/

export function expand(str:string) {
    return str.replace(/\$\{([a-zA-Z0-9_]+)\}/g, function (a, key) {
        return getEnv(key);
    });
}
export function expandPath(path:string) {
    path = expand(path);
    path = path.replace(/\/+/g, "/");
    path = path.replace(/^[a-z][a-z]+:\//, (r)=>`${r}/`);
    return path;
}
export const Env={expand,expandPath,get:getEnv, set:setEnv};
export function resolve(path:SFile|string, base?:SFile|string){ 
    init();
    if (SFile.is(path)) return path;
    path = expandPath(path);
    if (base && !PathUtil.isAbsolutePath(path)) {
        if (typeof base==="string"){
            base = expandPath(base);
            return FS.get(base).rel(path);    
        } else {
            return base.rel(path);
        }
    }
    return FS.get(path);
}