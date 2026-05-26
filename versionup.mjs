import {create} from './shell.mjs';
import { shouldBeVerup } from './verup_check.mjs';
import { loadAsArray, load } from './workspaces.mjs';
const sh = await create();
const pkg = sh.rel("./package.json").obj();
console.log(pkg.workspaces);
const newver=pkg.version;
const workspaces=loadAsArray();
const n2ws=load();
const verupNeeds=new Set(); // of name
const dry=false;
const dryexec=async (...args)=>{
  if (dry) {
    console.log(process.cwd(),...args);
  } else {
    await sh.exec(...args);
  }
};
for (let workspace of workspaces) {
  console.log(workspace.dir); 
  try {
    sh.pushd(workspace.dir);
    if (!await shouldBeVerup(newver)) {
      for (let name in workspace.mixedDependencies){
        if (verupNeeds.has(name)) {
          verupNeeds.add(workspace.name);
        }
      }
      if (!verupNeeds.has(workspace.name)) {
        console.log(process.cwd(),"Skip verup");
        continue;
      }
    }
    verupNeeds.add(workspace.name);
    if (workspace.version===newver) {
      console.log(process.cwd(), "Already version up to ",newver ,"skip.");
      continue;
    }
    let needsCommit=false;
    if (workspace.dir==="petit-node") {
      await manipulateVer();
      needsCommit=true;
    }
    if (await fixDepVer(workspace)) needsCommit=true;
    if (needsCommit) await commit();
    await dryexec("npm", ["version", newver],{nostdout:true});
  } finally {
    sh.popd();
  }
}
async function commit(){
  await dryexec("git",["commit", "-a", "-m", "to_version_"+newver],{nostdout:true});
}
async function manipulateVer(){
  if (dry) {
    console.log(process.cwd(), "Manipluate version to ",newver);
    return ;
  }
  const files=[sh.rel("src/index.ts"),sh.rel("js/index.js"),sh.rel("dist/index.js")];
  for (let file of files) {
    file.text(file.text().replace(/__VER__[\d\.]+__SION__/, `__VER__${newver}__SION__`));
  }
}
async function fixDepVer(workspace) {
  let hasChange=false;
  for (let dw of workspace.depsInWs(n2ws)) {
    if (verupNeeds.has(dw.name)) {
      workspace.setVer(dw.name, "^"+newver);
      hasChange=true;
    }
  }
  if (!hasChange) {
    console.log(process.cwd(), workspace.name, " has no deps-change.");
    return false;
  }
  if (dry) {
    console.log(process.cwd(), "change deps ",workspace.pkg.dependencies);
    console.log(process.cwd(), "change devdeps ",workspace.pkg.devDependencies);
    return true;
  }
  workspace.save("./package.json");
  return true;
}