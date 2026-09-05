import * as rpc from "@hoge1e3/rpc";
import * as pNode from "petit-node";
import type { FstabEntry } from "./types.js";
/*global self */
export async function boot({
  fstab,main,id
}:{fstab:FstabEntry[], main:string, id:string}):Promise<void>{
  try{
    /*(function hackTimeouts(){
      for(let k of ["setTimeout","setInterval",
      "clearTimeout","clearInterval",]){
          globalThis[k]=globalThis[k].bind(globalThis);
      }
    })();*/
    await pNode.boot();
    (globalThis as any).pNode=pNode;
    const dev=pNode.getDeviceManager();
    await dev.loadFstab(fstab);
    const FS=pNode.getFS();
    //await FS.mountAsync("/idb/","idb");
    if(process.env.POLICY_TOPDIR){
      FS.setDefaultPolicy({topDir:process.env.POLICY_TOPDIR as any});
    }

    Error.stackTraceLimit=100;
    console_client();
    const mod:any=await pNode.importModule(FS.get(main));
    const srv:{[key:string]:(...a:any[])=>any}={};
    const rev_cli=rpc.proxy.client(self, id);
    for(let k in mod){
        let v=mod[k];
        if(typeof v==="function"){
            srv[k]=v.bind(rev_cli);
        }
    }
    rpc.proxy.server("default",[],srv);

  }catch(e: any) {
    self.postMessage({stack:e.stack});
    console.error(e);
  }
}


export function console_server(w: MessageEventSource):void {
    rpc.proxy.server(w,"console",[],{
        log:(...a:any[])=>console.log(...a),
        error:(...a:any[])=>console.error(...a),
    });
}
export function console_client(){
    const c=rpc.proxy.client(self,"console");
    //console.log("test124");
    const old={
        log:console.log,
        error:console.error,
    };
    console.log=(...a)=>{
        c.log(...a);
        old.log.apply(console,a);
    };
    console.error=(...a)=>{
        c.log(...a);
        old.error.apply(console,a);
    };

    return c;
}
export function startWorker():void {
  rpc.proxy.server("boot",[], {boot});
}
