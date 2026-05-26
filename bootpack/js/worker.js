import * as rpc from "@hoge1e3/rpc";
import * as pNode from "petit-node";
/*global self */
export async function boot({
  fstab,main,id
}){
  try{
    /*(function hackTimeouts(){
      for(let k of ["setTimeout","setInterval",
      "clearTimeout","clearInterval",]){
          globalThis[k]=globalThis[k].bind(globalThis);
      }
    })();*/
    await pNode.boot();
    globalThis.pNode=pNode;
    const dev=pNode.getDeviceManager();
    await dev.loadFstab(fstab);
    const FS=pNode.getFS();
    //await FS.mountAsync("/idb/","idb");
    if(process.env.POLICY_TOPDIR){
      FS.setDefaultPolicy({topDir:process.env.POLICY_TOPDIR});  
    }

    Error.stackTraceLimit=100;
    console_client();
    const mod=await pNode.importModule(FS.get(main));
    const srv={};
    const rev_cli=rpc.proxy.client(self, id);
    for(let k in mod){
        let v=mod[k];
        if(typeof v==="function"){
            srv[k]=v.bind(rev_cli);
        }
    }
    rpc.proxy.server("default",[],srv);

  }catch(e) {
    self.postMessage({stack:e.stack});
    console.error(e);
  }
}


export function console_server(w){
    rpc.proxy.server(w,"console",[],{
        log:(...a)=>console.log(...a),
        error:(...a)=>console.error(...a),
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
export function startWorker(){
  rpc.proxy.server("boot",[], {boot});
}
