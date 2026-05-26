import { Client } from "./client.js";
import { Server } from "./server.js";
import { isMessegable, Messagable, Methods } from "./types.js";

export function server(
    target: Messagable, 
    channel:string,
    allowOrigin:string[],
    methods:Methods,
):Server;
export function server(
    channel:string,
    allowOrigin:string[],
    methods:Methods,
):Server;
export function server(...a:any[]):Server {
    const target:Messagable=(isMessegable(a[0])?
        a.shift():
        globalThis as unknown as Messagable
    );
    const channel:string=a.shift();
    const allowOrigin:string[]=a.shift();
    const methods:Methods=a.shift();
    const s=new Server(target, channel, allowOrigin);
    for (let k in methods) {
        s.serv(k,(params)=>methods[k](...params.args));
    }
    return s;
}
export function client(     
    target: Messagable, 
    channel="default",
    origin=undefined as (string|undefined),
    manualProbe=false, 
) {
    const c=new Client(target, channel, origin, manualProbe);
    return new Proxy(c,{
        get(target,p) {
            if (p==="__unproxy__") {
                return c;
            }
            if (typeof p==="symbol" || p==="then" || p==="toString") {
                return Reflect.get(target, p);
            }
            //const t=args.map((a:any)=>transfers.get(a))
            return (...args:any[])=>{
              const transfer=args.reduce(
                ((tr:any[],a:any)=>
                [...(tr||[]),
                ...transfers.get(a)??[]]),
                []);
              return c.run(p,{args},transfer);
            }
        }
    })
}
const transfers=new WeakMap<any,Transferable[]>();
export function transfer<T extends Transferable>(o: T):T;
export function transfer<T>(o: T, trans:any[]):T;
export function transfer<T>(o: T, trans = [o] as any[]){
  transfers.set(o,trans);
  return o;
}

type PeerParamBase={
    channel: string, 
    service:{[key:string]: Function},      
};
type PeerParam=WorkerPeerParam|XOriginPeerParam;
type WorkerPeerParam=PeerParamBase&{
    target: Worker,
};
function isWorkerPeerParam(p:PeerParam):p is WorkerPeerParam {
    return p.target instanceof Worker;
}
type XOriginPeerParam=PeerParamBase&{
    target: Messagable,
    targetOrigin: string,
    allowOrigin?: string[],
};
export function peer(param:PeerParam) {
    const [targetOrigin, allowOrigin]=isWorkerPeerParam(param)?
    [undefined, [] as string[]]:
    [param.targetOrigin, param.allowOrigin?? [param.targetOrigin]];
    const {target, service, channel}=param;
    const cli=client(target, channel, targetOrigin, false);
    const srv=server(globalThis as Messagable, channel, allowOrigin, service);
    (cli as any).__unproxy__.addEventListener("dispose", ()=>srv.dispose());
    return cli;
}