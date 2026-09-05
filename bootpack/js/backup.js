import { showModal, splash } from "./boot.js";
import { mount, readFstab, unmountExceptRoot, wakeLazies } from "./fstab.js";
import { getInstance } from "./pnode.js";
import { Idb } from "./idb.js";
export async function factoryReset() {
    const sp = showModal(".splash");
    await splash("Factory reset...", sp);
    const pNode = getInstance();
    const dev = pNode.getDeviceManager();
    await wakeLazies();
    await dev.commitPromise();
    /*for (let fs of dev.df()) {
        if(fs.fstype()==="idb") {
            const __fs=fs as typeof fs & {storage?:MultiSyncIDBStorage};
            const storage=__fs.storage;
            if (storage) await removeAllFromIDB(storage, fs.mountPoint);
        }
    }*/
    for (let tab of readFstab()) {
        if (tab.fsType === "idb") {
            // fsType:"idb", options:{dbName: "petit-fs", storeName: "kvStore"}},
            await removeAllFromIDB(tab.options.dbName);
        }
    }
    for (let k in localStorage) {
        delete localStorage[k];
    }
    localStorage["/"] = "{}";
    //await dev.commitPromise();
    //const idb=new Idb();
    showModal();
}
export async function fullBackup() {
    const pNode = getInstance();
    const FS = pNode.getFS();
    const sp = showModal(".splash");
    await splash("Activate all fs...", sp);
    await wakeLazies();
    await splash("zipping...", sp);
    await FS.zip.zip(FS.get("/"));
    showModal();
}
export async function removeAllFromIDB(dbName /*, mountPoint: string*/) {
    const idb = await Idb.open(dbName, ["kvStore"]);
    const kvs = idb.table("kvStore");
    for await (let k of kvs.keys()) {
        await kvs.delete(k);
    }
}
export async function fullRestore(arrayBuf) {
    const sp = showModal(".splash");
    const pNode = getInstance();
    const _JSZip = await pNode.importModule("pnode:jszip");
    const JSZip = _JSZip;
    const jszip = new JSZip();
    await jszip.loadAsync(arrayBuf);
    const dev = pNode.getDeviceManager();
    const fs = pNode.getNodeLikeFs();
    const _path = await pNode.importModule("path");
    const path = _path;
    const fstabName = "fstab.json";
    const fstabPath = "/" + fstabName;
    const zipEntry = jszip.files[fstabName];
    if (zipEntry) {
        const fstab_str = await zipEntry.async("string");
        if (!fs.existsSync(fstabPath) ||
            fs.readFileSync(fstabPath, { encoding: "utf8" }) !== fstab_str) {
            splash("Unmounting existing fs", sp);
            await unmountExceptRoot();
            fs.writeFileSync(fstabPath, fstab_str);
            splash("Mounting new fs", sp);
            await mount();
            await factoryReset();
            showModal(".splash");
        }
    }
    splash("Activating all fs", sp);
    await wakeLazies();
    splash("Unzipping files ", sp);
    for (let key of Object.keys(jszip.files)) {
        const zipEntry = jszip.files[key];
        const filePath = "/" + key;
        console.log("Unzip", filePath);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        if (!zipEntry.dir) {
            const buf = await zipEntry.async("arraybuffer");
            await fs.promises.writeFile(filePath, new Uint8Array(buf));
        }
    }
    splash("Waiting for commit...", sp);
    await dev.commitPromise();
    showModal();
}
//# sourceMappingURL=backup.js.map