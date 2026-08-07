
import * as process from "node:process";
import * as path from "node:path";
import * as fs from "node:fs";
import FS from "@hoge1e3/sfile-node";

import { getHome, Shell } from "./shell.mjs";
//console.log(process.argv);
const script=process.argv[2];
if(!script) {
    console.error("Usage: apsh script args...");
    process.exit(1);
}
let scriptFull=path.join(process.cwd(),script);
if (!fs.existsSync(scriptFull)) {
    if (process.env.APSH_PATH) {
        for (let p of process.env.APSH_PATH.split(path.delimiter)) {
            scriptFull=path.join(p,script);
            if (fs.existsSync(scriptFull)) break;
        }
    }
    if (!fs.existsSync(scriptFull)) {
        console.error(`${scriptFull}: No such file.`);
        process.exit(1);
    }
}
const scriptURL="file://"+scriptFull.replace(/\\/g,"/");
//console.log(scriptURL);
const {main}=await import(scriptURL);
//const wd=path.dirname(scriptFull);
//process.chdir(wd);
const shell=new Shell(await getHome());
const args=shell.parseArgs(process.argv.slice(3));
//console.log(args);
await main.call(shell,...args);
