export type SFile={
    exists(): boolean;
    obj(): any;
    obj(o:object): any;
    mkdir():void;
    isDir():boolean;
    ls():string[];
    rel(path:string):SFile;
    clone(abspath:string):SFile;
    path():string;
    relPath(base:SFile):string;
    lastUpdate():number;
    dataURL(u:string):void;
    dataURL():string;
    rm():void;
    setBlob(b:Blob):Promise<void>;
    watch(h:(type:string, file:SFile)=>void):void;
};
export type WSFileInfo={
    content:string;
    mtime:number;
};
export type NodeLikeFs=typeof import("node:fs") & {
    mount(mountPoint:string,fsType:string,options?:any):Promise<FileSystem>;
    unmount(mountPoint:string):Promise<FileSystem>;
    fstab():FileSystem[];
    commitPromise():Promise<void>;
    promises:{
        readdir(path:string):Promise<string[]>
    };
    getRootFS():RootFS,
};
export type PNode={
    boot():Promise<void>;
    version:string;
    getFS():TFS;
    getNodeLikeFs():NodeLikeFs;
    getCore():{
        fs: NodeLikeFs
    }
    importModule(f:SFile|string):any;
    file(path:string):SFile;
    resolveEntry(wantModuleType:"ES"|"CJS",f:SFile):Entry;
    ESModuleCompiler:{
        create(handlers:PNodeCompileHandler):{
            compile(e:Entry):Promise<PNodeModule>;        
        };
    }
};
export type RootFS={
    hasUncommited():boolean;
    commitPromise():Promise<void>;
    fstab(): FileSystem[];
    hasUncommited():boolean;
    commitPromise():Promise<void>;
    unmount(mountedPoint:string):void;
};
export type TFS={
    get(path:string):SFile;
    getRootFS(): RootFS;
    mountAsync(mountPoint:string,fsType:string,options?:any):Promise<FileSystem>;
    zip:{
        unzip(zipfile:SFile, dest:SFile, options:any):Promise<void>;
        zip(src:SFile):Promise<void>;
    },
};
export interface MutablePromise<T> extends Promise<T>{
    resolve(value?:T):void;
    reject(e:Error):void;
}
export type ShowModal=(qs?:string|boolean)=>HTMLElement;
export type Splash=(mesg:string, dom:HTMLElement)=>Promise<void>;
export type WireUIDC={
    rmbtn: ()=>void,
    showModal: ShowModal,
    splash: Splash;
};
export type IDBSuccess={
    target: {
        result: IDBDatabase
    }
}
export type RootPackageJSON={
    prefetch?: string[],
    menus: Menus,
};
export type Menus={[key:string]:Menu};
export type Menu={
    icontext?:string,
    main:string,
    auto?:boolean, 
    submenus?:any,
    call?: [string,...any],
};
export type Entry={
    file:SFile;
};
export type PNodeModule={
    entry: Entry;
};
export type PNodeCompileHandler={
    oncompilestart(e:{entry:Entry}):void;
    oncachehit(e:{entry:Entry}):void;
    oncompiled(e:{module:PNodeModule}):void;
};
export type PrefetchScriptOptions={
    module?: boolean;
    global?: string;
};

export type FSTypeName=string;
export abstract class FileSystem {
    constructor(rootFS:RootFS, mountPoint:string);
    fstype():FSTypeName;
    abstract hasUncommited():boolean;
    abstract commitPromise():Promise<void>;
    abstract isReadOnly(path:string):boolean;
    //resolveFS(path:string):FileSystem;
    mountPoint: string;
    inMYFS(path:string):boolean;
    getRootFS():RootFS;
    /*abstract getContent(path:string):Content;
    abstract setContent(path:string, content:Content):void;
    abstract appendContent(path:string, content:Content):void;
    abstract lstat(path: string):Stats;*/
    abstract setMtime(path: string, time: number):void;
    getContentType(path:string):string;
    abstract mkdir(path:string):void;
    abstract touch(path:string):void;
    abstract exists(path:string):boolean;
    assertExist(path:string):void;
    assertWriteable(path:string):void;
    abstract opendir(path:string):string[];
    //abstract opendirent(path:string):Dirent[];
    //abstract direntOfMountPoint():Dirent;
    //copyFile(path:string, dst:string):void;
    abstract rm(path:string):void;
    link(path:string, to:string):void;
    abstract isLink(path:string):string|undefined;
    onAddObserver(path:string):void;
    //static addFSType(name:string, factory:FSFactory|AsyncFSFactory, asyncOptions?:AsyncOptions):void;
    inMyFS(path:string):boolean;
    storage?: MultiSyncIDBStorage;
}
export declare class MultiSyncIDBStorage /*implements IStorage*/ {
    private storage;
    private channel;
    channelName: string;
    //changeEventTrait: ChangeEventTrait;
    //addEventListener(type: "change", callback: (e: ChangeEvent) => void): void;
    //removeEventListener(callback: (e: ChangeEvent) => void): void;
    static create(dbName?: string, storeName?: string): Promise<MultiSyncIDBStorage>;
    waitForCommit(): Promise<void>;
    //constructor(storage: SyncIDBStorage);
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    itemExists(key: string): boolean;
    keys(): IterableIterator<string>;
    reload(key: string): Promise<string | null>;
}
