import * as fs from "fs";
export async function shouldBeVerup(newver) {
    // return false if not have .git dir at current dir
    if (!fs.existsSync(".git")) {
        console.log(process.cwd(), "No .git directory, skip verup check");
        return false;
    }

    // run git command and check uncommit stuffs, if exists, throw with exception
    const cp = await import('child_process');
    const status = cp.execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (status) {
        throw new Error(`${process.cwd()} has uncommit stuffs:\n${status}`);
    }
    // run git command and get last commit message(strip heading-trailing spaces)
    const lastmsg = cp.execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
    console.log("lastmsg:", lastmsg);
    if (lastmsg === newver) return true;
    if (lastmsg.match(/^\d+\.\d+\.\d+$/)) return false;
    return true;
    // if the message is equal to `newver` -> true
    // if the message is looks like version string \d+\.\d+\.\d+  -> false
    // otherwise -> true

}
async function test(){
    const {create}= await import('./shell.mjs');
    const sh = await create();
    const pkg = sh.rel("./package.json").obj();
    console.log(pkg.workspaces);
    const newver=pkg.version;
    const subpkgNames=new Set();
    
    for (let workspace of pkg.workspaces) {
        // go to `dir`
        sh.pushd(workspace);
        //sh.cwd2process();
        const r=await shouldBeVerup(newver);
        console.log(workspace, r);
        sh.popd();
        //sh.cwd2process();
    }
}
//test();