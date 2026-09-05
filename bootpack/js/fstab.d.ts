export declare function getMountPromise(): import("mutable-promise").default<void>;
export declare function readFstab(path?: string): any;
export declare function reload(path?: string): Promise<void>;
export declare function unmountExceptRoot(): Promise<void>;
export declare function wakeLazies(): Promise<void>;
export declare function mount(path?: string): Promise<void>;
