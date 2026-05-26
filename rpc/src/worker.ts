import {Server} from "./server.js";
import {Client} from "./client.js";
import * as proxy from "./proxy.js";
import { Methods } from "./types.js";
export const worker={
  server(channel="default"){
   const w:any=globalThis;
   return new Server(w,channel,[]) 
  },
  client(w:Worker,channel="default"){
   return new Client(w,channel)     
  },
  proxy:{
    withChannel,
    defaultChannel:withChannel("default"),
    server(channel:string, methods:Methods){
      return proxy.server(channel,[],methods); 
    },
    client(target:Worker, channel:string, manualProbe=false) {
      return proxy.client(target, channel, undefined, manualProbe);
    }
  }
};
function withChannel(channel:string) {
  return {
    server(methods:Methods) {
      return worker.proxy.server(channel, methods);
    },
    client(target: Worker, manualProbe=false){
      return worker.proxy.client(target, channel, manualProbe);
    }
  }
}