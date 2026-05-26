
import * as fs from "fs";
import * as process from 'process';
import * as cp from 'child_process';
const user="hoge1e3";
const ssh=true;
const tourl=(name)=>ssh?`git@github.com:${user}/${name}.git`:`https://github.com/${user}/${name}.git`
for (let workspace of ["pnode-bootloader","gsync","hoge1e3.github.io"]) {
  console.log(workspace); 
  const url=tourl(workspace);
  cp.execSync(`git clone ${url}`, {stdio: 'inherit'});
}
{
  fs.mkdirSync("./idb/run",{recursive:true});
  process.chdir("./idb/run/");
  const name="acepad-dev";
  const url=tourl(name);
  cp.execSync(`git clone ${url} .`, {stdio: 'inherit'});
}
