import {create} from './shell.mjs';
const sh = await create();
const pkg = sh.rel("./package.json").obj();
//console.log(pkg.workspaces);
const paths=[ ...pkg.workspaces,"."];
const unsyncs=[];
for (let path of paths){
    if (await sh.exec("node",["gitsync.mjs",path],{nostdout:true})) { 
        unsyncs.push(path);
    }
}
if(unsyncs.length>0){
    console.log("Unsynced changes: ",unsyncs);
    process.exit(1);
} else {
    console.log("All synced.");
}
