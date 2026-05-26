import { MultiSyncIDBStorage } from '../src/index.js';
const assert={
    equal(a:any,b:any){
        if(a!==b){
            throw new Error(`${a}!==${b}`);
        }
    }
};
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const storage = await MultiSyncIDBStorage.create<string>(
  "test",{});
(globalThis as any).storage = storage;
let theValue;
const reg=/value\d+\.\d+/;
const m=reg.exec(location.href);
if(m){
    theValue=m[0];
    assert.equal(storage.getItem('key'), theValue);
    storage.addEventListener("change",(e)=>{
        console.log("Event", e);
    });
    console.log("theValue",theValue);
    const w=new Worker("./worker.webpack.js",{type:"module"});
    const nextValue=theValue+"!";
    let i=0;
    while (storage.getItem("key")!==nextValue) {
        console.log("next1",storage.getItem("key"));
        await sleep(100);
        i++;
        if (i>=100) throw new Error("Value is not changed");
    }    
    console.log("next2",storage.getItem("key"));
    i=0;
    while (storage.itemExists("key")) {
        await sleep(100);
        i++;
        if (i>=100) throw new Error("Value is not removed");
    }
    console.log("Item removed!");
}else{
    theValue="value"+Math.random();
    storage.setItem('key', theValue);
    assert.equal(storage.getItem('key'), theValue);
    await storage.waitForCommit();
    await sleep(1000);
    location.href+="?"+theValue;
}