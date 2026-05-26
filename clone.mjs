
import * as fs from "fs";
import * as cp from 'child_process';
const user="hoge1e3";
const ssh=true;
const tourl=(name)=>ssh?`git@github.com:${user}/${name}.git`:`https://github.com/${user}/${name}.git`
const pkg =  JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log(pkg.workspaces);
for (let workspace of pkg.workspaces) {
  console.log(workspace); 
  const url=tourl(workspace);
  cp.execSync(`git clone ${url}`, {stdio: 'inherit'});
}