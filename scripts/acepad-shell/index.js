
import * as process from "node:process";
import * as path from "node:path";
import FS from "@hoge1e3/sfile-node";

import { getHome, Shell } from "./shell.mjs";
//console.log(process.argv);
const script=process.argv[2];
const scriptFull=path.join(process.cwd(),script);
const scriptURL="file://"+scriptFull.replace(/\\/g,"/");
//console.log(scriptURL);
const {main}=await import(scriptURL);
//const wd=path.dirname(scriptFull);
//process.chdir(wd);
const shell=new Shell(await getHome());
const args=shell.parseArgs(process.argv.slice(3));
//console.log(args);
await main.call(shell,...args);
