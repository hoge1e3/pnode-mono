//@ts-check
import { getInstance } from "./pnode.js";
import { mutablePromise, directorify} from "./util.js";
import { assign } from "./global.js";
let mountPromise=mutablePromise();
const defaultFSTab=[
    {mountPoint:"/tmp", fsType:"ram", options:{}},
    {mountPoint:"/idb", fsType:"idb", options:{dbName: "petit-fs", storeName: "kvStore"}},
];
export function getMountPromise() {
    return mountPromise;
}
assign({getMountPromise});
export function readFstab(path="/fstab.json") {
    const pNode=getInstance();
    return pNode.getDeviceManager().readFstab(path,defaultFSTab);
}
export async function reload(path="/fstab.json") {
    await unmountExceptRoot();
    // fstab.json does NOT contains root
    await mount();
}
export async function unmountExceptRoot(){
    const pNode=getInstance();
    const dev=pNode.getDeviceManager();
    const fst=dev.df();
    const mounted=fst.filter((f)=>f.mountPoint!=="/").map((f)=>f.mountPoint);
    for (let m of mounted){
        await dev.unmount(m);
    }
}
export async function wakeLazies(){
    const pNode=getInstance();
    const dev=pNode.getDeviceManager();
    const fs=pNode.getNodeLikeFs();
    const mounted=dev.df();
    for (let m of mounted) {
        await fs.promises.readdir(m.mountPoint);
    }
}
export async function mount(path="/fstab.json") {
    const pNode=getInstance();
    const dev=pNode.getDeviceManager();
    const tab=readFstab(path);
    for (let {mountPoint,fsType,options} of tab) {
        // FS.mountAsync does not clear _fs.linkCache
        await dev.mount(mountPoint,fsType,options);
    }
    mountPromise.resolve();
}