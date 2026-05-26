import {create} from './shell.mjs';
import {Workspace} from "./workspaces.mjs";
async function main(){
const sh = await create();
const pkg = sh.rel("./package.json").obj();
const newver=pkg.version;
console.log(pkg.workspaces);
//await sh.exec("npm",["login"],{nostdout:true});
let otp;
if (process.argv[2]) {
  //https://chatgpt.com/share/695b1c8a-d250-800b-a19a-04802ff95d7f
  otp = process.argv[2];
} else {
// if otp is not provided, read from stdin
  otp = await sh.input("Enter OTP: ");
}
if (!otp) throw new Error("Please specify otp from Authenticater App.");
for (let workspace of pkg.workspaces) {
  console.log(workspace);
  const ws=new Workspace(workspace);
  if (ws.version!==newver) {
    console.log(workspace, "is version ", ws.version ,". Skip. ")
    continue;
  }
  //sh.pushd(workspace);
  await sh.exec("npm", ["publish", "--access=public", "--workspace", workspace, "--otp", otp]);
  //sh.popd();
}
}/*of*/main();