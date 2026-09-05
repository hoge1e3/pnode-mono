import type pNode from "petit-node";
export type PNode=typeof pNode;
export type WSFileInfo={
    content:string;
    mtime:number;
};
export type ShowModal=(qs?:string|boolean)=>HTMLElement;
export type Splash=(mesg:string, dom:HTMLElement)=>Promise<void>;
export type WireUIDC={
    rmbtn: ()=>void,
    showModal: ShowModal,
    splash: Splash;
};
/** return value of ui.btn */
export type MenuButton={
    action:()=>Promise<void>,
    label:string,
    dom:HTMLDivElement,
};
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
export type PrefetchScriptOptions={
    module?: boolean;
    global?: string;
};
export type FstabEntry={
    mountPoint:string,
    fsType:string,
    options?:object
};
export type MultiSyncIDBStorage={
    getItem(key:string): string|null;
    setItem(key:string, value:string): void;
    removeItem(key:string): void;
    keys(): IterableIterator<string>;
    waitForCommit(): Promise<void>;
};
