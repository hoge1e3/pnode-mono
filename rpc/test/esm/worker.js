import * as rpc from "../../dist/index.js";
const wserv=new rpc.Server("wserv");
const revw=new rpc.Client(self, "revw");
wserv.serv("test",({x})=>{
    return x*100;
});
wserv.serv("kickRev",({x})=>{
    revw.run("rtest",{args:["Hello, I am worker. Received: ",x]});
});
const wprox=rpc.worker.proxy.server("wprox",{
    test(x){
        return x*200;
    },
    channel(ch) {
        ch.postMessage("returned message");
    }
});
