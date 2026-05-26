import { Handler, isReadyRequest, isRequest, Message, Messagable, isMessegable, MessageHandler, ReadyResponse, Success, Fail } from "./types.js";

const debug=console.log.bind(console);
//const debug=((...args:any[])=>false);
export class Server {
    idhead="S"+Math.random();
    isReady=false;
    paths:{[key:string]:Handler}={};
    target: Messagable;
    channel:string;
    allowOrigin:string[];
    handler: MessageHandler;
    event= new EventTarget();
    doDebug=false;
    debug(...a:any[]) {
        if (this.doDebug) debug(`[${this.idhead}]`,...a);
    }
    constructor(target: Messagable, 
        channel:string,
        allowOrigin:string[]);
    constructor(
        channel:string,
        allowOrigin:string[]);
    constructor(...a:any[]) {
        this.target=(isMessegable(a[0])?
            a.shift():
            globalThis as unknown as Messagable
        );
        this.channel=(typeof a[0]==="string"?a.shift():"default");
        this.allowOrigin=a.shift();
        const channel=this.channel, allowOrigin=this.allowOrigin;
        this.handler=(e:MessageEvent<Message>|ErrorEvent)=>{
            const sendError=(_err:any)=>{
                let err:any=Object.assign({name:_err.name, message:_err.message, stack:_err.stack},_err||{});
                try {
                    const j=JSON.stringify(err);
                    err=JSON.parse(j);
                } catch(je) {
                    err=err ? err.message || e+"" : "unknown";
                    this.debug("rpc:service", je, err);
                }
                respond({
                    ...context, error:err as Error, status:"error", type:"fail",
                });
            }
            if (e instanceof ErrorEvent) {
                sendError(e.error);
                return;
            }
            const d=e.data;
            const id=d.id;
            const respond=(m:Success|Fail|ReadyResponse)=>{
                if (e.source) {
                    // Iframe
                    e.source.postMessage(m,{
                        targetOrigin: e.origin,
                    });    
                } else {
                    // Worker
                    this.debug("Worker respond", m );
                    this.target.postMessage(m);
                }
            };
            const context={id,channel};
            this.debug("SERVER RECV",e, d.channel, channel);
            if (d.channel!==channel) return; 
            if (e.origin && !allowOrigin.includes(e.origin)) {
                console.error("Invalid origin", e.origin);
                sendError(new Error(`Invalid origin: ${e.origin}`));
                return;
            }
            if (isReadyRequest(d)) {
                this.debug("Server READY",d);
                respond({id:"READY" ,channel, status:"ready", type:"readyResponse"});
                return;
            }
            if (d.type=="success"||d.type==="fail"||d.type==="readyResponse") {
                // Maybe from peer server. Ignore.
                return;
            }
            if (!isRequest(d)) {
                console.log("Invalid message",d);
                throw new Error("Invalid message: "+(d as any).type);
            }
            try {
                const f=this.paths[d.path];
                if (!f) return sendError(new Error("No such method: "+d.path));
                Promise.resolve( f(d.params,context) ).then((r)=>{
                    respond({
                        ...context, result:r, status:"ok", type:"success",
                    });
                },sendError);
            } catch (ex) {
                sendError(ex);
            }
        }
        this.target.addEventListener("message", this.handler);
        this.ready();
    }
    dispose(){
        this.target.removeEventListener("message",this.handler);
        this.event.dispatchEvent(new Event("dispose"));
    }
    addEventListener(type:"dispose", handler: (e:Event)=>void) {
        this.event.addEventListener(type, handler);
    }
    install(path:string, func:Handler) {
        this.paths[path]=func;
    }
    serv(path:string ,func:Handler) {
        this.install(path,func);
    }
    ready() {
        this.isReady=true;
    }
};