import {FS, urlToPath as url2path} from "petit-node";
//import Maybe from "maybe-monada";
import {match} from "textmatcher";
import * as hist from "./hist.js";
import isPlainObject from "@hoge1e3/is-plain-object";
import {glob, hasWildcard} from "./glob.js";
import {getRoot, getMetaRoot} from "./root.js";
export {getRoot, getMetaRoot} from "./root.js";

/*global globalThis*/
export var sh=(function () {   
    var root=globalThis;
    const phandler={
        get(sh,n,rcv){
            if (typeof n==="symbol"){
                return Reflect.get(sh,n,rcv);
            }
            if(n==="__unproxy__")return ()=>sh;
            let m;
            m=/^\$(.*)/.exec(n);
            if (m) return sh.get(m[1]);
            m=/^_(.*)/.exec(n);
            let r=Reflect.get(sh,n,rcv);
            if (r || m)return r;
            r=sh.hasCmd(n);
            if(r)return r;
            throw new Error(n+": command not found.");
        },
        set(sh,n,v) {
            if (typeof n==="symbol"){
                return Reflect.set(sh,n,v);
            }
            let m;
            m=/^\$(.*)/.exec(n);
            if (m) return sh.set(m[1],v);
            return Reflect.set(sh,n,v);
        },
    };
    function proxy(sh){
        return new Proxy(sh,phandler);
    }
    var Shell=root.sh||{};    
    Shell._hist=hist;
    Shell.addHist=function (cmd) {
        return this._hist.add(this.getcwd(),cmd);  
    };
    Shell.history=function (dir) {
        if (!dir) dir=this.getcwd();
        return this._hist.list(dir);
    };
    Shell.glob=glob;
    Shell.proxy=function (){return proxy(this);};
    Shell.__unproxy__=function (){return this;};
    var sh;
    var PathUtil=(FS.PathUtil);
    Shell.collectOptions=function (args){
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
    };
    Shell.pickOptions=function (args){
        const r=[],o={};
        for(let a of args){
            if(isPlainObject(a)){
                Object.assign(o,a);
            }else{
                r.push(a);
            }
        }
        r.unshift(o);
        return r;
    };
    Shell.newCommand=function (name,func) {
        this[name]=func;
    };
    Shell.mcd=function (dir){
        dir=this.directorify(dir);
        if(!dir.exists()){
            dir.mkdir();
        }
        return this.cd(dir);
    };
    Shell.cd=function (dir) {
        dir=this.directorify(dir);
        if(!dir.exists()){
            throw new Error(dir+" no such dir");
        }
        this._cwd=dir;
        return this.getcwd();
    };
    Shell.getcwd=function (){
        return this._cwd;
    };
    Shell.cwd=function (){
        return this._cwd;
    };
    Shell.vars=Object.create(FS.getEnv());
    // why commented out?
    Shell.getenv=(k)=>FS.getEnv(k);
    Shell.setenv=(k,v)=>FS.setEnv(k,v);
    
    Shell.mount=async function (options, path) {
        if (!options || !options.t) {
            var fst=[];
            for (var k in FS.getRootFS().availFSTypes()) {
                fst.push(k);
            }
            sh.err("-t=("+fst.join("|")+") should be specified.");
            return;
        }
        await FS.mountAsync(path,options.t, options);
    };
    Shell.unmount=function (path) {
        FS.unmount(path);
    };
    Shell.fstab=function () {
        var rfs=FS.getRootFS();
        var t=rfs.fstab();
        var sh=this;
        //sh.echo(rfs.fstype()+"\t"+"<Root>");
        t.forEach(function (fs) {
            sh.echo(fs.fstype()+"\t"+(fs.mountPoint||"<Default>"));
        });
    };
    Shell.isOpt=(v)=>{
        return (v&&typeof v=="object"&&
        !FS.SFile.is(v));
    };
    Shell.popOpt=function (a){
        if(this.isOpt(a[a.length-1])){
            return a.pop();
        }
        return {};
    };
    
    Shell.pwd=function () {
        this.echo(this.getcwd()+"");
        return this.getcwd()+"";
    };
    Shell.mkdir=function (file) {
        file=this.directorify(file);
        if (file.exists()) throw new Error(file+" : exists");
        return file.mkdir();
    };
    Shell.cat = function (...files /*, options */) {
        // Fix: Show multiple files
        this.echo(
            files.map(file => this.resolve(file, true).text()).join("\n"));
    };
    Shell.getRoot=function (){
        return getRoot(this.resolve("."));
    };
    Shell.directorify=function (dir){
        dir=this.resolve(dir);
        return this.resolve(
            FS.PathUtil.directorify(dir.path()));
    };
    Shell.resolve=function (file,mustExist) {
        if (!file) file=".";
        var r=resolve2.call(this,file);
        if (!FS.SFile.is(r)) {console.log(r," is not file");}
        if (!r.name().endsWith("/")){
            // Fails if policy is set and r is topDir
            // const d=r.sibling(r.name()+"/");
            const d=FS.resolve(r.path()+"/");
            if(d.exists() && d.isDir())r=d;
        }
        if (mustExist && !r.exists()) throw new Error(r+": no such file or directory");
        return r;
    };
    function resolve2(v) {
        if (typeof v!="string") return v;
        if(v.match(/^blob:/)){
          const p=url2path(v);
          if(p.match(/^blob:/)){
            throw new Error(`This blob URL may be revoked: ${p}`);
          }
          return resolve2.call(this, p);
        }
        var c=this.getcwd();
        if (PathUtil.isAbsolutePath(v)) return FS.resolve(v,c);
        return c.rel(v);
    }

    Shell.getPath=function (){
        const sh=this;
        let pa=sh.get("path");
        if(!pa)return [];
        pa=pa.split(this.pathsep());
        return pa.map(e=>sh.resolve(e));
    };
    Shell.pathsep=()=>process.env.pathsep||":";
    Shell.addPath=function (p){
        //let p=args.shift();
        p=this.resolve(p);
        let pa=this.getPath();
        if (!pa.some((e)=>e.equals(p))) pa.push(p);
        this.set("path",pa.map(e=>e.path()).join(this.pathsep()));
    };
    Shell.builtinCommandList=function (){
        const res=(this.__parent__?
        this.__parent__.builtinCommandList():[]);
        return res.concat(Object.keys(this).filter(
            k=>typeof this[k]==="function"));
    };
    Shell.commandFileList=function (){
        let res=[];
        for (let p of this.getPath()) {
            if(!p.exists())continue;
            res=res.concat(
                p.listFiles().
                filter(f=>this.isExecutable(f))
            );
        }
        return res;
    };
    Shell.which=function (cmd){
        const r=this.commandFileList().
        filter(
            (f)=>f.name()===cmd);
        if(r.length==0)throw new Error(`${cmd}: not found.`);
        return r[0];
    };
    Shell.commandList=function (){
        let res=this.builtinCommandList();
        return [...res,
        ...this.commandFileList().map(f=>f.name())
        ];
    };
    Shell.hasCmd=function (c){
        if(typeof this.__unproxy__()[c]==="function")return this[c];
        if(FS.PathUtil.isAbsolutePath(c)||
        c.match(/^\.\.?\//)){
            return this.isExecutable(this.resolve(c));
        }
        return anyof(this.getPath(),(p)=>
            letin(p.rel(c),f=>
                this.isExecutable(f)));
    };
    function letin(...args){
        let f=args.pop();
        return f(...args);
    }
    function anyof(a,f){
        for(let e of a){
            let r=f(e);
            if(r)return r;
        }
    }
    Shell.isExecutable=function (f){
        const cmd=this.hasExecutableCommand(f);
        return cmd &&
            ((...a)=>this.enterCommand(cmd,a));
    };
    Shell.hasExecutableCommand=function (f){
        f=this.resolve(f);
        /*
        it is very slow
        if(f.ext()===".html"&&this.hasCmd("webpage")){
            return `webpage ${f.path()}`;
        }*/
        return f.exists()&&!f.isDir()&&
          match(f.text(),
            /^(?:\/\/|#)!([^\n\r]+)/,
            m=>`${m[1]} ${f.path()}`);
    };

    Shell.grep=function (pattern, file, options) {
        file=this.resolve(file, true);
        if (!options) options={};
        if (!options.res) options.res=[];
        if (file.isDir()) {
            file.each(function (e) {
                Shell.grep(pattern, e, options);
            });
        } else {
            if (typeof pattern=="string") {
                file.lines().forEach(function (line, i) {
                    if (line.indexOf(pattern)>=0) {
                        report(file, i+1, line);
                    }
                });
            }
        }
        return options.res;
        function report(file, lineNo, line) {
            if (options.res) {
                options.res.push({file:file, lineNo:lineNo,line:line});
            }
            Shell.echo(file+"("+lineNo+"): "+line);

        }
    };
    Shell.touch=function (f) {
    	f=this.resolve(f);
    	f.text(f.exists() ? f.text() : "");
    	return 1;
    };
    Shell.setout=function (ui) {
        this._outUI=ui;
    };
    Shell.echo=function (...a) {
        const Shell=this;
        return Promise.all(a).then( (a)=> {
            console.log(...a);
            let o=Shell.popOpt(a);
            if (Shell._outUI && Shell._outUI.log) {
                Shell._outUI.log(...a);
                if(!o.n){
                    Shell._outUI.log("\n");
                }
            }
        });
    };
    Shell.err=function (e) {
        console.log.apply(console,arguments);
        if (e && e.stack) console.log(e.stack);
        if (Shell._outUI && Shell._outUI.err) Shell._outUI.err.apply(Shell.outUI,arguments);
    };
    Shell.clone= function () {
        let u=this.__unproxy__();
        var r=Object.create(u);
        r.vars=Object.create(this.vars);
        r.__parent__=u;
        return proxy(r);
    };
    Shell.getvar=function (k) {
        return this.vars[k] ;//|| (process && process.env[k]);
    };
    Shell.get=Shell.getvar;
    Shell.set=function (k,v) {
        this.vars[k]=v;
        return v;
    };
    Shell.strcat=function () {
        if (arguments.length==1) return arguments[0];
        var s="";
        for (var i=0;i<arguments.length;i++) s+=arguments[i];
        return s;
    };
    Shell.exists=function (f) {
        f=this.resolve(f);
        return f.exists();
    };
    Shell._e=function (f){
        f=this.resolve(f);
        return f.exists();
    };
    Shell._f=function (f){
        f=this.resolve(f);
        return f.exists()&&!f.isDir();
    };
    Shell._s=function (f){
        f=this.resolve(f);
        return f.exists()&&!f.isDir()&&f.size();
    };
    Shell._d=function (f){
        f=this.resolve(f);
        return f.exists()&&f.isDir();
    };
    
    
    /*Shell.dl=function (f) {
        f=this.resolve(f||".");
        return f.download();
    };*/
    Shell.zip=function () {
        var t=this;
        var a=Array.prototype.slice.call(arguments).map(function (e) {
            if (typeof e==="string") return t.resolve(e);
            return e;
        });
        return FS.zip.zip.apply(FS.zip,a);
    };
    Shell.unzip=function () {
        var t=this;
        var a=Array.prototype.slice.call(arguments).map(function (e) {
            if (typeof e==="string") return t.resolve(e);
            return e;
        });
        return FS.zip.unzip.apply(FS.zip,a);
    };

    Shell.prompt=function () {
        //const home=this.get("home");
        //sh.echo(`[${this.getcwd().relPath(home)}]$ `,{n:1});
    };
    Shell.ASYNC={r:"SH_ASYNC"};
    Shell.help=function () {
        for (var k in Shell) {
            var c=Shell[k];
            if (typeof c=="function") {
                Shell.echo(k+(c.description?" - "+c.description:""));
            }
        }
    };
    if (!root.sh) root.sh=Shell;
    sh=Shell;
    if (typeof process=="object") {
        sh.devtool=function () { require('nw.gui').Window.get().showDevTools();};
        sh.cd(FS.PathUtil.directorify(process.cwd().replace(/\\/g,"/")));
    } else {
        sh.cd("/");
    }
    //var envSingle=/^\$\{([^\}]*)\}$/;

    sh.enterCommand=function (s,a) {
        a=a||[];
        //this.addHist(s);
        /*if (!this._history) this._history=[];
        this._history.push(s);*/
        var args=this.parseCommand(s);
        if (this._skipto) {
            throw new Error("noooo");
            if (args[0]=="label") {
                this.label(args[1]);
            } else {
                this.echo("Skipping command: "+s);
            }
        } else {
            return this.evalCommand(args.concat(a));
        }
    };
    sh.exec=sh.enterCommand;
    sh.sleep=function (t) {
        return new Promise(s=>{
            t=parseFloat(t);
            setTimeout(s,t*1000);
        });
    };
    sh.include=async function (f) {
        f=this.resolve(f,true);
        var t=this;
        for(let l of f.lines()){
            await t.enterCommand(l);
        }
    };
    /*
    set a 1
    label loop
    echo ${a}
    calc add ${a} 1
    set a ${_}
    goto loop ( calc lt ${a} 10 )
    */
    sh.parseCommand=function (s) {
        var space=/^\s*/;
        var nospace=/^([^\s]*(\\.)*)*/;
        var dq=/^"([^"]*(\\.)*)*"/;
        var sq=/^'([^']*(\\.)*)*'/;
        var lpar=/^\(/;
        var rpar=/^\)/;
        const self=this;
        const parse=()=>{
            var a=[];
            while(s.length) {
                s=s.replace(space,"");
                if (s.length===0) break;
                var r;
                if (r=dq.exec(s)) {
                    a.push(expand( unesc(r[1]) ));
                    s=s.substring(r[0].length);
                } else if (r=sq.exec(s)) {
                    a.push(unesc(r[1]));
                    s=s.substring(r[0].length);
                } else if (r=lpar.exec(s)) {
                    s=s.substring(r[0].length);
                    a.push( parse() );
                } else if (r=rpar.exec(s)) {
                    s=s.substring(r[0].length);
                    break;
                } else if (r=nospace.exec(s)) {
                    //a.push(expand(unesc(r[0])));
                    //try{
                        const files=glob.call(this, expand(unesc(r[0])));
                        for (let file of files){
                            //console.log(file);
                            a.push(file);
                        }
                    /*}catch(e){
                        console.error(e);
                    }*/
                    s=s.substring(r[0].length);
                } else {
                    break;
                }
            }
            var options,args=[];
            a.forEach(function (ce) {
                var opt=/^-([A-Za-z_0-9]+)(=(.*))?/.exec(ce);
                if (opt) {
                    if (!options) options={};
                    options[opt[1]]=opt[3]!=null ? opt[3] : true;
                } else {
                    if (options) args.push(options);
                    options=null;
                    args.push(ce);
                }
            });
            if (options) args.push(options);
            return args;
        };
        var args=parse();
        return args;
        /*console.log("parsed:",JSON.stringify(args));
        var res=this.evalCommand(args);
        return res;*/
        function expand(s) {
            const envMulti=/\$\{([^\}]*)\}/;
            let r;
            let res="";
            while(s.length) {
                r=envMulti.exec(s);
                if (!r) {
                    res+=s;
                    break;
                }
                res+=s.substring(0, r.index);
                res+=self.get(r[1]);
                s=s.substring(r.index+r[0].length);
            }
            return res;
        }
        function unesc(s) {
            return s.replace(/\\(.)/g,function (_,b){
                return b;
            });
        }
    };
    sh.evalCommand=function (expr) {
        if (expr instanceof Array) {
            if (expr.length==0) {
                try{
                    throw new Error("empty command");
                }catch(e){
                    console.error(e);
                }
                return;
            }
            const c=expr.shift();
            const f=this.hasCmd(c);
            if (typeof f!="function") throw new Error(c+": Command not found");
            return f.apply(this, expr.map(e=>this.evalCommand(e)));
        } else {
            return expr;
        }
    };
    sh.calc=function (op) {
        var i=1;
        var r=parseFloat(arguments[i]);
        for(i=2;i<arguments.length;i++) {
            var b=arguments[i];
            switch(op) {
                case "add":r+=parseFloat(b);break;
                case "sub":r-=parseFloat(b);break;
                case "mul":r*=parseFloat(b);break;
                case "div":r/=parseFloat(b);break;
                case "lt":r=(r<b);break;
            }
        }
        this.set("_",r);
        return r;
    };
    /*sh.history=function () {
        var t=this;
        this._history.forEach(function (e) {
            t.echo(e);
        });
    };*/
    function readFile(file) {
        return new Promise(function (succ) {
            var reader = new FileReader();
            reader.onload = function(e) {
                succ(reader.result);
            };
            reader.readAsArrayBuffer(file);
        });
    }
    function mapArg(args,spec=""){
        let sh=this;
        return args.map((a,i)=>
            spec[i]==="f"?
                sh.resolve(a):a);
    }
    sh.mapArg=mapArg;
    sh.addCmd=function (name,f,spec){
        this[name]=function (...args){
            return f.apply(this,this.mapArg(args,spec));
        };
    };
    root.sh=proxy(sh);
    return root.sh;
})();
