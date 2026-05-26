import FS from "@hoge1e3/sfile-node";
import {spawn} from "child_process";
import readline from "readline";
import {glob} from "./glob.js";
import isPlainObject from "@hoge1e3/is-plain-object";

export async function create() {
    return new Shell(await getHome());
}
export class Shell {
    constructor(home) {
        this.cwd = home;
        this.cds=[];
        this.auto_cwd2process=true;
    }
    input(prompt = "") {
        return new Promise((resolve) => {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
          });
        });
    }
    resolve(path) {
        if (typeof path==="object") return path;
        if (path.startsWith("/")) return FS.get(path);
        return this.rel(path);
    }
    rel(path) {
        return this.cwd.rel(path);
    }
    pushd(path) {
        this.cds.push(this.cwd);
        this.cwd = this.cwd.rel(path);
        if (this.auto_cwd2process) this.cwd2process();
    }
    popd() {
        this.cwd = this.cds.pop();
        if (this.auto_cwd2process) this.cwd2process();
    }
    cd(path) {
        this.cwd = this.cwd.rel(path);
        if (this.auto_cwd2process) this.cwd2process();
    }
    cwd2process() {
        process.chdir(this.cwd.path());
    }
    getcwd(){//SFile
        return this.cwd;
    }
    exec(cmd, args, options={}) {
        return exec(cmd, args, {cwd: this.cwd.path(), ...options});
    }
    cp(src,dst) {
        this.resolve(dst).setContent(
            this.resolve(src).getContent()
        );
    }
    glob(...a){
        return glob.call(this,...a);
    }
    parseArgs(a){
        let options,args=[];
        for (let ce of a) {
            const opt=/^-([A-Za-z_0-9]+)(=(.*))?/.exec(ce);
            if (opt) {
                if (!options) options={};
                options[opt[1]]=opt[3]!=null ? opt[3] : true;
            } else {
                if (options) args.push(options);
                options=null;
                args.push(ce);
            }
        }
        if (options) args.push(options);
        return args;
    }
    echo(...a){
        console.log(...a);
    }
    collectOptions (args){
        const r=[],o={};
        for(let a of args){
            if(isPlainObject(a)){
                Object.assign(o,a);
            }else{
                r.push(a);
            }
        }
        r.push(o);
        return r;
    }
}
export function exec(cmd, args, options={}) {
    if (options.nostdout) {
        return new Promise((resolve, reject) => {
            const p = spawn(cmd, args, {shell:true,...options});
            process.stdin.pipe(p.stdin);
            p.stdout.pipe(process.stdout);
            p.stderr.pipe(process.stderr);
            p.on("exit", code => resolve(code));
        });
    }
    return new Promise((resolve, reject) => {
      const p = spawn(cmd, args, {shell:true,...options});
      let stdoutData = '';
      p.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      p.stderr.pipe(process.stderr);
      p.on("exit", code => code ? reject(code) : resolve(stdoutData));
    });
  }   
export async function getHome() {
    const home = FS.get(".");
    return home;
}
