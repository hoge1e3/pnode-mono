
import { Content } from "@hoge1e3/content";
export { Content } from "@hoge1e3/content";
import {MIMETypes,defaultMIMETYpes} from "./MIMETypes.js";
export type DependencyContainer={
  fs: typeof import("node:fs"),
  path: typeof import("node:path"),
  Buffer: typeof Buffer,
  //process: typeof import("node:process"),
}
type BinTypeOption={binType:typeof Buffer|typeof ArrayBuffer};
type Stats=import("node:fs").Stats& {linkPath?:string, hasFineMtime?:boolean};;
export type MetaInfo={
  lastUpdate:number,
  link?: string,
  hasFineMtime?: boolean,
  // if this is a link, indicates whether the destination is a directory
  //isDirPath?: boolean, // undefined=unknown, true=dir, false=regular file
  //stat?: Stats,  // if this is a link, the stats of the destination
  //lstat?: Stats, // if this is a link, the stats of the link itself
};

export type ExcludeFunction=(f:SFile)=>boolean;
export type ExcludeHash={[key:string]: any};
export type ExcludeOption=(ExcludeFunction | string[] | ExcludeHash);
export type DirectoryOptions={excludes?: ExcludeOption, excludesF?:ExcludeFunction, includeDir?:boolean};
export type ListFilesOptions=DirectoryOptions&{cache?:number|boolean};
export type RecursiveOptions=ListFilesOptions&{followlink?:boolean};
//export type GetDirTreeExcludeFunction=(f:SFile, options:GetDirTreeExcludeFunctionArgs)=>boolean;
export type GetDirStyle = "flat-absolute" | "flat-relative" | "hierarchical" | "no-recursive";
export type GetDirTreeOptions={excludes: ExcludeOption/*|GetDirTreeExcludeFunction*/ , style:GetDirStyle, base:SFile};
//export type GetDirTreeExcludeFunctionArgs={fullPath?:string, relPath?:string, style?:GetDirStyle};
export type FileCallback=(f:SFile)=>any;
/**
 * @deprecated use @hoge1e3/sfile-node instead
 */
export async function getNodeFS():Promise<FileSystemFactory> {
  try {
    const fs = await import(/* webpackIgnore: true */"node:fs");
    const path = await import(/* webpackIgnore: true */"node:path");
    return new FileSystemFactory({fs, path, Buffer});
  } catch(e) {
    const p=(globalThis as any)?.FS;
    if (p && typeof p.getRootFS==="function") return p;
    const p2=(globalThis as any)?.pNode?.FS;
    if (p2 && typeof p2.getRootFS==="function") return p2; 
    throw e; 
  }
}
 
export class FileSystemFactory {
  mimeTypes: MIMETypes=defaultMIMETYpes;
  #defaultPolicy?: Policy;
  constructor(public deps: DependencyContainer) {
    Content.setBufferPolyfill(deps.Buffer);
  }
  addMIMEType(extension:string, contentType:string) {
    this.mimeTypes[extension]=contentType;
  }
  _normalizePath(inputPath:string) {
    // Normalize path to use forward slashes and resolve to absolute path
    if (inputPath.startsWith("file://")) {
      /*
       Windows:  file:///C:/folder/file.txt  -> C:/folder/file.txt
       Unix/Linux: file:///home/user/file.txt -> /home/user/file.txt
      */
      inputPath=inputPath.substring("file://".length);
      if (inputPath.match(/^\/[a-zA-Z]:/)) {
        inputPath=inputPath.substring(1);
      }
    }
    return (
      this.deps.path.
        resolve(inputPath).
        replace(/\\/g,"/")
	  +(inputPath.match(/[\/\\]$/)?
	      "/":"")
	).replace(/\/+/g,"/");
  }
  get(inputPath:string) {
    //const normalizedPath = this._normalizePath(inputPath);
    return new SFile(this, inputPath, this.#defaultPolicy);//normalizedPath);
  }
  sfile(inputPath:string) {
    return new SFile(this, inputPath, this.#defaultPolicy);//normalizedPath);
  }
  afile(inputPath:string) {
    return new AFile(this, inputPath, this.#defaultPolicy);//normalizedPath);
  }
  setDefaultPolicy(policy?:Policy) {
    this.#defaultPolicy=policy;
  }
}
export type Policy={
  topDir: SFile;
}
export type DirTree = { [key: string]: MetaInfo | DirTree };
function truncSep(path:string) {
  return path.replace(/[\/\\]+$/,"");
}
function addSep(path:string){
  return truncSep(path)+"/";
}
export class Cache<T> {
  private value:Partial<T>={};
  public timestamp:number=0;
  constructor(public duration:number=1000){}
  public set(v:Partial<T>) {
    this.poke(v);
    this.timestamp=Date.now();
  }
  public poke(v:Partial<T>) {
    this.value=v;
  }
  public get():Partial<T> {
    return this.valid() ? this.value :{};
  }
  public valid() {
    return ( this.timestamp>=0 && (this.duration==0 || Date.now()-this.timestamp<this.duration) );
  }
  public clear(){
    this.value={};
  }
  public setDuration(d:number){this.duration=d;}
}
export type CachedInfo={
  //meta: MetaInfo,
  lstat: Stats,
  //content: Content;
};
export class SFile {
  static is(obj:any):obj is SFile {
    return obj instanceof SFile;
  }
  #path:string;
  readonly _path:string;// Just debug info
  #fs:FileSystemFactory;
  #policy: Policy|undefined;
  public cache = new Cache<CachedInfo>();
  constructor(__fs:FileSystemFactory, filePath:string, policy?: Policy) {
    this.#fs=__fs;
    this.#path = __fs._normalizePath(filePath); 
    this.#policy=policy;
    if (policy && !policy.topDir.contains(this)) {
      throw new Error(`Creating '${filePath}' is prohibited by policy. It is outside of '${policy.topDir}'.`);
    }
    this._path=this.#path;
  }
  setPolicy(p:Policy) {
    if (this.#policy) throw new Error("policy already set");
    return new SFile(this.#fs, this.#path, p);
  }
  clone(_path?:string) {
    const path=_path||this.#path;
    return new SFile(this.#fs, path, this.#policy);
  }
  async(){
    return new AFile(this.#fs,this.#path,this.#policy);
  }
  sync(){
    return this;
  }

  // File content methods
  text(str:string):this;
  text():string;
  text(str?:string) {
    if (str === undefined) {
      return this.getText();
    }
    return this.setText(str);
  }
  lines():string[] {
    return this.getText().split(/\r?\n/);
  }
  getText():string{
    const {fs,path}=this.#fs.deps;
    return fs.readFileSync(this.#path, 'utf8');
  }
  setText(str:string):this {
    const {fs,path}=this.#fs.deps;
    this.prepareDir();
    fs.writeFileSync(this.#path, str, 'utf8');
    this.cache.clear();
    return this;
  }
  appendText(str:string) {
    const {fs,path}=this.#fs.deps;
    this.prepareDir();
    fs.appendFileSync(this.#path, str);
    this.cache.clear();
  }
  getBlob():Blob {
    return new Blob([this.bytes()],{type:this.contentType()});
  }
  async setBlob(blob:Blob):Promise<ArrayBuffer> {
    return new Promise(
      (succ:(a:ArrayBuffer)=>void)=>
        blob.arrayBuffer().then((a:ArrayBuffer)=>succ(this.setBytes(a))));
  }
  obj(o:object):this;
  obj():object;
  obj(o?:object) {
    if (o === undefined) {
      return JSON.parse(this.text());
    }
    this.text(JSON.stringify(o, null, 2));
    return this;
  }
  bytes(b:ArrayBuffer):this;
  bytes(b:Uint8Array<ArrayBuffer>):this;
  bytes():ArrayBuffer|Uint8Array<ArrayBuffer>;
  bytes(b?: ArrayBuffer|Uint8Array<ArrayBuffer>):this|ArrayBuffer|Uint8Array<ArrayBuffer> {
    if (b === undefined) {
      return this.getBytes();
    }
    this.setBytes(b);
    return this;
  }
  setBytes<T extends ArrayBuffer|Uint8Array<ArrayBuffer>>(b: T) {
    const {fs,path,Buffer}=this.#fs.deps;
    this.prepareDir();
    if (Content.isArrayBuffer(b)) {
      const bb=new Uint8Array(b);// Buffer.from(b);
      fs.writeFileSync(this.#path, bb);
    } else {
      fs.writeFileSync(this.#path, b);
    }
    this.cache.clear();
    return b;
  }
  getBytes(options?:BinTypeOption):Uint8Array<ArrayBuffer>|ArrayBuffer {
    const {fs,path,Buffer}=this.#fs.deps;
    const binType=options?.binType||Buffer;
    const buffer = fs.readFileSync(this.#path);
    return binType === ArrayBuffer ? Content.buffer2ArrayBuffer(buffer) : buffer;
  }
  dataURL(url:string):this;
  dataURL():string;
  dataURL(url?:string):this|string{
    if (!url) {
      return this.getContent().toURL();
    }
    return this.setContent(Content.url(url));
  }
  stat():Stats {
    const {fs,path}=this.#fs.deps;
    return fs.statSync(this.#path);
  }
  lstat():Stats {
    const {fs,path}=this.#fs.deps;
    const cached=this.cache.get().lstat;
    if (cached) return cached;
    return fs.lstatSync(this.#path);
  }
  getMetaInfo({nofollow}={nofollow:false}):MetaInfo{
    const {fs,path}=this.#fs.deps;
    if (nofollow) {
      const lstat = this.lstat();
      return {
        lastUpdate: lstat.mtimeMs,
        link: lstat.isSymbolicLink() ? fs.readlinkSync(this.#path) : undefined,
        ...(lstat.hasFineMtime?{hasFineMtime:true}:{}),
      };
    } else {
      const stat = this.stat();
      return {
        lastUpdate: stat.mtimeMs,
        ...(stat.hasFineMtime?{hasFineMtime:true}:{}),
        // link is undefined because the link is resolved by statSync
      };  
    }
  }
  setMetaInfo(m:{lastUpdate:number}):this{
    const {fs,path}=this.#fs.deps;
    const stats = this.stat();
    fs.utimesSync(this.#path, stats.atime, new Date(m.lastUpdate));
    this.cache.clear();
    return this;
  }
  size(){
    const stats = this.stat();
    return stats.size;
  }
  // File metadata and operations
  lastUpdate():number {
    // Spec change: use lstat not stat
    const lstat = this.lstat();
    return lstat.mtimeMs;
  }
  rm(options:{r?:boolean, recursive?:boolean} = {}) {
    const {fs,path}=this.#fs.deps;
    if (this.isDir({nofollow:true})) {
      if (options.r || options.recursive) {
        fs.rmSync(this.#path, { recursive: true, force: true });
      } else {
        fs.rmdirSync(this.#path);
      }
    } else {
      fs.unlinkSync(this.#path);
    }
    this.cache.clear();
    return this;
  }
  

  exists() {
    const {fs,path}=this.#fs.deps;
    if (this.cache.get().lstat) {
      return true;
    }
    return fs.existsSync(this.#path);
  }

  isDir({nofollow}={nofollow:false}):boolean {
    // nofollow: if true and this is a link, returns false.
    if (nofollow) {
      const lstat=this.cache.get().lstat;
      if (lstat) return lstat.isDirectory();
    }
    if (!this.exists()) return false;
    if (nofollow) {
      return this.lstat().isDirectory();
    } else {
      // this.stat().isDirectory(); fails if it is missing link
      return this.resolveLink().isDir({nofollow:true});
    }
  }
  isDirPath(){
    return this.#path.endsWith("/");
  }
  endsWith(postfix:string){return this.name().endsWith(postfix);}
  startsWith(prefix:string){return this.name().startsWith(prefix);}
  // Path and naming methods
  path() {
    return this.#path;
  }
  equals(s:string|SFile):boolean{
    if (typeof s=="string") {
      return this.path()===s;
    } else {
      return this.path()===s.path();
    }
  }

  name() {
    return this.truncSep()+(this.#path.endsWith("/")?"/":"");
  }
  truncSep(){
    const {fs,path}=this.#fs.deps;
    return path.basename(this.#path);
  }

  ext() {
    const {fs,path}=this.#fs.deps;
    return path.extname(this.#path);
  }

  truncExt(e?:string) {
    const name = this.name();
    if (e === undefined) {
      e = this.ext();
    }
    return name.substring(0, name.length-e.length);
  }

  // Relative and navigation methods
  up() {
    const {fs,path}=this.#fs.deps;
    if (this.#path==="/" || this.#path==="\\") {
      return null;
    }
    const dirn=path.dirname(this.#path);
    if (dirn===this.#path) return null;
    if (this.#policy) {
      if (!SFile.containsPath( this.#policy.topDir.path(), dirn)) {
        return null;
      }
    }
    return this.clone(dirn);
  }
  parent(){return this.up();}
  sibling(name:string) {
    const p=this.up();
    if (!p) throw new Error(`Cannot get sibling of '${this.path()}'`);
    return p.rel(name);
  }
  closest(name:string|((f:SFile)=>any)):SFile|undefined {
    if (typeof name==="string"){
      return this.closest((f:SFile)=>f.rel(name).exists());
    } else {
      const f=(f:SFile):SFile|undefined=>{
        const res=name(f);
        if (SFile.is(res))return res;
        if (res) return f;
        return undefined;
      }
      for(let p:SFile|null=this;p;p=p.up()) {
        const r=f(p);
        if (r) return r;
      }
      return undefined;
    }
  }

  relPath(base:SFile) {
    const {fs,path}=this.#fs.deps;
    const body=path.relative(base.path(), this.#path).replace(/\\/g,"/");
    return (
      body+(body.length && this.isDirPath()?"/":"")
    ).replace(/\/+$/,"/");
  }

  rel(relPath:string) {
    const {fs,path}=this.#fs.deps;
    if(path.isAbsolute(relPath)) throw new Error(`rel: ${relPath} should be relative`);
    return this.clone(path.join(this.#path, relPath));
  }
  _directorify() {
    if (!this.isDirPath()) this.#path+="/";
  }

  // Copy and move methods
  copyFrom(src:SFile) {
    return src.copyTo(this);
  }
  toString(){return this.#path;}
  /**
   * src.copyTo(dst) is equivalent to cp -r src/* dst/ , not cp -r src dst
   * @param dst 
   * @param options 
   * @returns 
   */
  copyTo(dst:SFile, options={followlink:false as boolean}):SFile{
    let src:SFile=this;
    const followlink=options.followlink;
    if (followlink) {
      src=src.resolveLink();
      dst=dst.resolveLink();
    }
    const nofollow=!followlink;
    const srcIsDir=src.isDir({nofollow});
    if (srcIsDir && !dst.exists()) {
      dst.mkdir();
    }
    let dstIsDir=dst.isDir({nofollow});
    if (!srcIsDir && dstIsDir) {
      dst=dst.rel(src.name());
      dst.assertRegularFile();
      dstIsDir=false;
    }
    if (srcIsDir && !dstIsDir) {
      throw new Error("Cannot move dir "+src.path()+" to file "+dst.path());
    } else if (!srcIsDir && !dstIsDir) {
      if (src.isLink()) src=src.resolveLink();
      if (dst.isLink()) dst=dst.resolveLink();
      const c=src.getContent();
      dst.setContent(c);
    } else {
      if (!srcIsDir || !dstIsDir) throw new Error(src+" to "+dst+" should both dirs");
      for (let e of src.listFiles({cache:1000})) {
        e.copyTo(dst.rel(e.relPath(src)),options);
      }
    }
    dst.cache.clear();
    return dst;
  }

  moveFrom(src:SFile) {
    return src.moveTo(this);
  }

  moveTo(dst:SFile) {
    /*if (dst.exists()) {
      throw new Error(`${dst.path()} already exists`);
    }*/
    const {fs,path}=this.#fs.deps;
    fs.renameSync(this.#path, dst.#path);
    this.cache.clear();
    /*this.copyTo(dst);
    this.rm({recursive:true});*/
    return dst;
  }
  contentType() {
    return addEncoding(this.#fs.mimeTypes[this.ext()]||"application/octet-stream");
  }
  isText(){
    return this.contentType().match(/^text\//);
  }
  getContent():Content{
    const {fs,path}=this.#fs.deps;
    /*if (this.isText()) {
      const text=fs.readFileSync(this.#path, "utf-8");
      if (Content.looksLikeDataURL(text)) {
        return Content.url(text);
      } else {
        return Content.plainText(text);
      }
    } else {*/
      return Content.fromNodeBuffer(fs.readFileSync(this.#path),this.contentType());
    //}
  }
  setContent(c:Content):this{
    const {fs,path,Buffer}=this.#fs.deps;
    this.prepareDir();
    if (c.hasPlainText()) {
      fs.writeFileSync(this.#path, c.toPlainText());
    } else{
      fs.writeFileSync(this.#path, c.toBin(Buffer));
    }
    this.cache.clear();
    return this;
  }
  appendContent(c:Content):this {
    const {fs,path,Buffer}=this.#fs.deps;
    this.prepareDir();
    if (c.hasPlainText()) {
      fs.appendFileSync(this.#path, c.toPlainText());
    } else{
      fs.appendFileSync(this.#path, c.toBin(Buffer));
    }
    this.cache.clear();
    return this;    
  }
  assertDir(options={nofollow:false as boolean}) {
    if (!this.isDir(options)) {
      throw new Error(`${this.path()} is not a directory`);
    }
  }
  assertRegularFile(options={nofollow:false as boolean}) {
    if (this.isDir(options)) {
      throw new Error(`${this.path()} is a directory`);
    }
  }
  // Directory methods
  parseExcludeOption(options:DirectoryOptions={}):{excludesF:ExcludeFunction} {
    this.assertDir();
    const excludes=options.excludes;
    if (typeof excludes==="function") {
        return {excludesF:excludes as ExcludeFunction};
    } else if (typeof excludes==="object") {
      const pathR=this.path();
      let nex:ExcludeHash={};
      const cpath=(e:string)=>{
        e=truncSep(e);
        if (e.startsWith("/")) {
          nex[e]=1;
        } else {
          nex[pathR+e]=1;
        }
      };
      if (Array.isArray(excludes)) {
        for (let e of excludes) cpath(e);
      } else {
        for (let e in excludes) cpath(e);
      }
      return {excludesF:(f)=>nex[truncSep(f.path())]};
    } else {
      return {excludesF:()=>false};
    }
  }
  each(callback:(file:SFile)=>void, options?:DirectoryOptions) {
    const {fs,path}=this.#fs.deps;
    this.assertDir();
    const files = fs.readdirSync(this.#path);
    const {excludesF}=this.parseExcludeOption(options);
    files.forEach(file => {
      const fileObj = this.rel(file);
      if (!excludesF(fileObj)) callback(fileObj);
    });
    return this;
  }
  recursive():Generator<SFile>;
  recursive(options:RecursiveOptions):Generator<SFile>;
  recursive(callback:FileCallback, options:RecursiveOptions):this;
  recursive(callback:FileCallback):this;
  recursive(a1?:FileCallback|RecursiveOptions, a2?:RecursiveOptions) {
    const options:RecursiveOptions=a2 ?? ((a1 && typeof a1==="object") ? a1 : {});
    const callback:FileCallback|undefined=(a1 && typeof a1==="function" ? a1 : undefined); 
    this.assertDir();
    if (callback) {
      for (let file of this.recursive(options)) {
        callback(file);
      }
      return this;
    } else {
      const includeDir=options.includeDir;
      //const {excludesF}=this.parseExcludeOption(options);
      const self=this;
      return {
        *[Symbol.iterator](){
          function* walk(dir: SFile):Generator<SFile> {
            //console.log("walk", dir.path(),includeDir);
            if (includeDir) {
              yield dir;
            }
            for (const file of dir.listFiles(options)) {
              if (file.isLink()){
                const r=file.resolveLink();
                const isd=r.isDir({nofollow:true});
                if (options.followlink && isd) {
                  yield* walk(r);
                } else if (!isd || includeDir) {
                  if (options.followlink) yield r;
                  else yield file;
                }
              } else if (file.isDir({nofollow:true})) {
                yield* walk(file);
              } else {
                yield file;
              }             
            }
          }
          yield* walk(self);
        }
      };
    }
  }
  
  getDirTree(_options:Partial<GetDirTreeOptions>={}):DirTree {
    let dest = {} as DirTree;
    //const options:GetDirTreeOptions={
    const style= _options.style || "flat-absolute";
    const excludes= _options.excludes || [];
    const base= _options.base || this;
    let excludesFunc:ExcludeFunction;
    if (typeof excludes==="function") {
        excludesFunc=excludes as ExcludeFunction;
    } else {
        const excludesAry = (excludes || []).map(truncSep);
        const defaultExcludes=(file:SFile)=>{
          const fullPath = file.path();
          const relPath = file.relPath(base);
            switch (style) {
              case "flat-relative":
              case "hierarchical":
                  if (excludesAry.indexOf(truncSep(relPath)) >= 0) {
                      return true;
                  }
                  break;
              case "flat-absolute":
                  if (excludesAry.indexOf(truncSep(fullPath)) >= 0) {
                      return true;
                  }
                  break;
          }
          return false;
        };
        excludesFunc=defaultExcludes;
    }
    const newoptions:GetDirTreeOptions = {style, base, excludes:excludesFunc};
    const files = this.listFiles({...newoptions, cache:true});
    if (style == "no-recursive") {
      for (let file of files) {
        dest[file.name()] = file.getMetaInfo({nofollow:true});
      }
      return dest;
    }
    for (let file of files) {
        const meta = file.getMetaInfo({nofollow:true});
        if (file.isDir({nofollow:true})) {
            switch (style) {
                case "flat-absolute":
                case "flat-relative":
                    Object.assign(dest, file.getDirTree(newoptions));
                    break;
                case "hierarchical":
                    dest[addSep(file.name())] = file.getDirTree(newoptions);
                    break;
            }
        } else {
          const fullPath = file.path();
          const relPath = file.relPath(base);
            switch (style) {
                case "flat-absolute":
                    dest[fullPath] = meta;
                    break;
                case "flat-relative":
                    dest[relPath] = meta;
                    break;
                case "hierarchical":
                    dest[file.name()] = meta;
                    break;
            }
        }
    }
    return dest;
  }

  /**
   * 
   * @param options cache: 
   *          If true, the metaInfo(result of .getMetaInfo()) of each file object is cached in the file object. 
   *          If false, the metaInfo is retrieved each time from the file system when .getMetaInfo is called.
   *          true is more efficient but the metainfo is NOT changed even if the file is modified by other processes.
   *          If number is specified, the cached info kept within duration in ms
   * @returns 
   */
  listFiles(options:ListFilesOptions={cache:1000}) {
    const {fs,path}=this.#fs.deps;
    const {excludesF}=this.parseExcludeOption(options);
    if (options.cache || options.cache===0) {
      // cache implicitly sets nofollow: true
      if (!this.isDir({nofollow:true}) && !this.isLink()) {
        throw new Error(this+' is not a directory');
      }
      const res=[] as SFile[];
      for (let dirent of fs.readdirSync(this.#path, {withFileTypes: true})) {
        const file=this.rel(dirent.name);
        if (excludesF(file)) continue;
        const extra=(dirent as any).extra;
        const lstat=(extra && extra.lstat? extra.lstat : file.lstat()) as Stats;
        file.cache.set({lstat});
        file.cache.setDuration(typeof options.cache==="boolean"?0:options.cache);
        if (lstat.isDirectory()) {
          file._directorify();
        }
        res.push(file);      
      }
      return res;
    }
    if (!this.isDir()) {
      throw new Error(this+' is not a directory');
    }
    return fs.readdirSync(this.#path).map(file => this.rel(file)).filter(f=>!excludesF(f));
  }

  ls(options?:DirectoryOptions) {
    const {fs,path}=this.#fs.deps;
    //if (!options) return fs.readdirSync(this.#path);
    return this.listFiles(options).map(f=>f.fixSep().name());
  }
  fixSep(){
    const lstat=this.lstat();
    if (lstat.isSymbolicLink()) {
      const link=this.resolveLink();
      if (link.isDir()) {
        this._directorify();
      }
    } else if (lstat.isDirectory()) {
      this._directorify();
    }
    return this;
  }

  mkdir() {
    const {fs,path}=this.#fs.deps;
    fs.mkdirSync(this.#path, { recursive: true });
    this.cache.clear();
    return this;
  }
  prepareDir(){
    const p=this.up();
    if (!p) throw new Error(`Cannot prepare dir for '/'`);
    return p.exists() || p.mkdir();
  }
  contains(child:SFile|string) {
    return SFile.containsPath(this.path(), typeof child==="string"? child:child.path());
    // truncSep(child.path()).startsWith(truncSep(this.path()));
  }
  static containsPath(parent:string, child:string){
    return truncSep(child).startsWith(truncSep(parent));
  }
  isLink():string|undefined {
    const {fs,path}=this.#fs.deps;
    if (!this.exists()) return undefined;
    const stat=fs.lstatSync(this.#path);
    if(!stat.isSymbolicLink())return undefined;
    return fs.realpathSync(this.#path);
  }
  link(to:SFile|string) {
    //to: existent this: non-existent
    //`this` points to `to`
    // string for relative link
    const {fs,path}=this.#fs.deps;
    fs.symlinkSync(typeof to==="string"?to:to.path(), this.#path, "junction");
    this.cache.clear();
  }
  resolveLink() {
    const {fs,path}=this.#fs.deps;
    return this.clone(fs.realpathSync(this.#path));
  }
  watch(listener:(eventType:string, file:SFile, meta:MetaInfo)=>void):{remove:()=>void};
  watch(options:any, listener:(eventType:string, file:SFile, meta:MetaInfo)=>void):{remove:()=>void};
  watch(_1?:any, _2?:any) {
    let options={},listener:(eventType:string, file:SFile, meta:MetaInfo|undefined)=>void=function(){};
    if (typeof _1==="object") options=_1;
    if (typeof _2==="object") options=_2;
    if (typeof _1==="function") listener=_1;
    if (typeof _2==="function") listener=_2;
    const {fs,path}=this.#fs.deps;
    const watcher=fs.watch(this.#path, options,(eventType:string, filename:string|null) => {
      const file=filename? (
        this.#fs.deps.path.isAbsolute(filename) ? 
          this.clone(filename) : 
          this.rel(filename)
      ):this;
      listener(eventType, file,  file.exists() ? file.getMetaInfo() : undefined);
    });
    return {
      remove:()=>{
        watcher.close();
      }
    };
  }
  isReadOnly() {
    const {fs}=this.#fs.deps;
    try {
      fs.accessSync(this.path(), fs.constants.R_OK); // 読み取り可能か
    } catch (err) {
      return false; // 読み取りできなければ読み取り専用ではない
    }

    try {
      fs.accessSync(this.path(), fs.constants.W_OK); // 書き込み可能か
      return false; // 書き込みもできる → 読み取り専用ではない
    } catch (err) {
      return true; // 書き込みできない → 読み取り専用
    }

  }

}
function addEncoding(ctype:string){
  return ctype+
  (ctype.startsWith("text/")?
  ";charset=utf8":"");
}
//--- async
export class AFile {
  #path:string;
  #fs:FileSystemFactory;
  #policy: Policy|undefined;
  public cache = new Cache<CachedInfo>();
  constructor(__fs:FileSystemFactory, filePath:string, policy?: Policy) {
    this.#fs=__fs;
    this.#path = __fs._normalizePath(filePath); 
    this.#policy=policy;
    if (policy && !policy.topDir.contains(this.#path)) {
      throw new Error(`Creating '${filePath}' is prohibited by policy. It is outside of '${policy.topDir}'.`);
    }
  }
  sync(){
    return new SFile(this.#fs,this.#path,this.#policy);
  }
  async(){
    return this;
  }
  async getContent():Promise<Content> {
    const {fs,path}=this.#fs.deps;
    const buf=await fs.promises.readFile(this.#path);
    return Content.fromUint8Array(buf);
  }
  async setContent(c:Content):Promise<void> {
    const {fs,path}=this.#fs.deps;
    await fs.promises.writeFile(this.#path, c.toUint8Array());
  }
  async text(text?:string):Promise<string> {
    if (typeof text==="string") {
      await this.setContent(Content.fromMixedText(text));
      return text;
    }
    return (await this.getContent()).toMixedText();
  }
  //WIP
}