// Type declarations for @hoge1e3/rpc (the package ships no .d.ts)
declare module "@hoge1e3/rpc" {
    export const proxy:{
        client(target:any, channel?:string, origin?:string, manualProbe?:boolean):any;
        server(...args:any[]):any;
    };
}
