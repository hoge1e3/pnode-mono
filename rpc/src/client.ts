import MutablePromise from "mutable-promise";
import { Fail, isFail, isReadyResponse, isSuccess, Messagable, Message, Success, Request, readyRequest, MessageHandler } from "./types.js";

const debug=console.log.bind(console);
//const debug=((...args:any[])=>false);
export class Client {
    idhead="C"+Math.random();
    idseq=1;
    queue:{[key:string]:MutablePromise<any>}={};
    readyPromise=new MutablePromise<any>();
    handler: MessageHandler;
    receiver: Messagable;
    event=new EventTarget();
    doDebug=false;
    debug(...a:any[]) {
        if (this.doDebug) debug(`[${this.idhead}]`,...a);
    }
    get isReady() {
        return this.readyPromise.isFulfilled;
    }
    constructor(
        public target: Messagable, 
        public channel="default",
        public origin:string|undefined=undefined,
        public manualProbe=false,
    ) {
        const t=this;
        t.idseq=1;
        const isWorker=target instanceof Worker;
        this.receiver=(isWorker?
            target:
            globalThis as unknown as Messagable);
        if (!origin && isCrossOrigin(this.target)){
            /*!(this.receiver instanceof Worker) && 
            typeof (this.receiver as any).importScripts!=="function" ) {*/
            throw new Error(this.channel+": Origin must be specfied");
        }
        this.handler=(e:MessageEvent<Message>|ErrorEvent)=>{
            if (e instanceof ErrorEvent) {
                throw e.error;
            }
            this.debug("RECV",e);
            const d=e.data;
            if (d.channel!==channel) return;
            if (isReadyResponse(d)) {
                if (this.isReady) return;
                this.debug("readyResponse is received from server!");
                this.readyPromise.resolve(true);
                return;
            }
            if (d.type=="request"||d.type==="readyRequest") {
                // Maybe from peer client. Ignore.
                return;
            }
            const q=t.queue[d.id];
            if (!q) {
                throw new Error("Missing id "+d.id+" in "+this.idhead);
            }
            this.debug("ID delete", d.id,t.queue );
            delete t.queue[d.id];
            if (isSuccess(d)){
                q.resolve(d.result);
            } else if(isFail(d)) {
                q.reject(d.error);
            } else { 
                this.debug("Invalid",d);
                throw new Error("Invalid response code");
            }
        };
        this.receiver.addEventListener("message",this.handler);
        if (!manualProbe) this.waitReady();
    }
    dispose(){
        this.receiver.removeEventListener("message",this.handler);
        this.event.dispatchEvent(new Event("dispose"));
    }
    addEventListener(type:"dispose", handler: (e:Event)=>void) {
        this.event.addEventListener(type, handler);
    }
    async requestReady() {
        this.target.postMessage(readyRequest(this.channel), {
          targetOrigin:this.origin
        });
    }
    async waitReady(times=Number.POSITIVE_INFINITY, duration=50, durationMax=1000, durationIncrement=1) {
        // Why pooling? -> because server cannot always respond to "creator", especially it is iframe or "Reverse" main window. 
        for (let i=0;i<times;i++) {
            if (this.isReady) break;
            this.debug("times", i);
            this.requestReady();
            await new Promise((s)=>setTimeout(s,duration));
            if (duration<durationMax) duration+=durationIncrement;
        }
        if (!this.isReady) {
            throw new Error("Timeout to connect '"+this.channel+"'");
        }
    }
    async run(path:string, params={}, transfer:Transferable[]=[]) {
        const t=this;
        await t.readyPromise;
        const id=t.idhead+(t.idseq++);
        t.queue[id]=new MutablePromise<any>();
        this.debug("ADD id", id ,t.queue);
        const req:Request={
            type: "request",
            id, path, params, 
            channel:t.channel,
        };
        //const isWorker=t.target instanceof Worker;
        
        t.target.postMessage(req, {
          targetOrigin:t.origin,
          transfer
        });
        return t.queue[id];
    }
}
function isCrossOrigin(target:Messagable) {
    const m:any=target;
    try {
        void (m?.location?.href);
        return false;
    } catch(e){
        return true;
    }
}