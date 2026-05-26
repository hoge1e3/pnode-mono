//@ts-check
/** 
 * @typedef { import("./types").SFile } SFile
 * @typedef { import("./types").Menus } Menus
 * @typedef { import("./types").Menu } Menu
 * @typedef { import("./types").ShowModal } ShowModal
 * @typedef { import("./types").RootPackageJSON } RootPackageJSON
 * @typedef { import("./types.js").WSFileInfo } WSFileInfo
 */
import { mutablePromise } from "./util.js";
/**
 * 
 * @param {SFile} home 
 * @returns 
 */
export function init(home) {
    /**
     * @param {string} path 
     * @returns {SFile}
     */
    function resolve(path) {
        path=path.replace(/\\/g,"/");
        //console.log("resolving",path,path.startsWith("/"));
        if (path.startsWith("/")) {
            return home.clone(path);
        } else {
            return home.rel(path);
        }
    }
    const mp=mutablePromise();
    const ws = new WebSocket("ws://localhost:8080");
    //const files = {}; // path -> {mtime, content}
    /**@type (...a:any[])=>void */
    const log=(...a)=>console.log("websocket",...a);
    ws.addEventListener("open", () => {
        log("connected");
    });
    ws.addEventListener("close", () => {
        alert("Websocket disconnect");
    });
    ws.addEventListener("error", (e) => {
        alert("Websocket Error");
        console.error(e);
    });
    ws.addEventListener("message", e => {
        const _data = JSON.parse(e.data);
        if (_data.type === "init") {
            let st=performance.now();
            console.log("Start sync init");
            /*for (let f of home.listFiles()) f.rm({r:true});
            console.log("Rm taken "+(performance.now()-st)+"msec");*/
            st=performance.now();
            //console.log("init", _data);
            for (let {path, info} of _data.files) {
                writeFile(path, info, true);
            }
            log("initialized: " + (_data.files).length + "Files. Taken "+(performance.now()-st)+"msec.");
            /*startWatch();
            mp.resolve();*/
        } else if (_data.type === "update") {
            const { path, info } = _data;
            const cur = readFile(path);
            if (!cur || info.mtime > cur.mtime) {
                writeFile(path, info, true);
                log("updated from server: " + path);
            }
        } else if (_data.type === "delete") {
            const { path } = _data;
            deleteFile(path, true);
            log("deleted from server: " + path);
        }
    });
    startWatch();
    mp.resolve();
    function startWatch(){
        home.watch((type, file)=>{
            const path=file.path();//relPath(home);
            //console.log(type,path, home.path(), file.path());
            if (file.isDir()) return;
            setTimeout(()=>{
                try {
                    if (file.exists()) {
                        ws.send(JSON.stringify({
                            type: "update",
                            path,
                            info: readFile(path),
                        }));
                    } else {
                        if (path.match(/\b\.gsync\b/)) {
                            alert("Suspicious file deletion! "+path);
                            return;
                        }
                        ws.send(JSON.stringify({
                            type: "delete",
                            path
                        }));
                    }
                }catch(e) {
                    alert(e);
                }
            },100);
        });
    }

    /**
     * 
     * @param {string} path 
     * @returns 
     */
    function readFile(path) {
        const f=resolve(path);
        return f.exists() ? {mtime: f.lastUpdate(), content:f.dataURL()} : null ;// files[path] || null;
    }
    /**
     * 
     * @param {string} path 
     * @param {WSFileInfo} info 
     * @param {boolean} nosend 
     * @returns 
     */
    function writeFile(path, info, nosend) {
        const f=resolve(path);
        //console.log("path-info",path, info);
        f.dataURL(info.content);
        //files[path] = info;
        if (nosend) return;
        ws.send(JSON.stringify({
            type: "update",
            path,
            info
        }));
    }
    /**
     * 
     * @param {string} path 
     * @param {boolean} nosend 
     * @returns {WSFileInfo|undefined}
     */
    function deleteFile(path, nosend) {
        const f=resolve(path);
        if (!f.exists()) return;
        f.rm();//    delete files[path];
        if (nosend) return;
        ws.send(JSON.stringify({
            type: "delete",
            path
        }));
    }
    return mp;
}