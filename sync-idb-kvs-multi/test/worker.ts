import { MultiSyncIDBStorage } from '../src/index.js';
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const storage = await MultiSyncIDBStorage.create(
  "test",{});
const theValue=storage.getItem("key");
console.log("worker-theValue",theValue);
storage.setItem("key",theValue+"!");
await sleep(1000);
storage.removeItem("key");