export type Methods={[key:string]:Function};
export type MessageHandler=(e:MessageEvent<Message>|ErrorEvent,...a:any[])=>void;
export type Messagable={
    addEventListener:(type:"message", handler:MessageHandler)=>void,
    removeEventListener:(type:"message", handler:MessageHandler)=>void,
    postMessage:(data:Message, o?:{
      targetOrigin?:string,
      transfer?:any[]
    })=>void,
}|Worker;
export function isMessegable(m:any): m is Messagable{
    return m && 
    typeof m.addEventListener==="function" &&
    typeof m.removeEventListener==="function" &&
    typeof m.postMessage==="function";
}
export type Message=(Request|Success|Fail|ReadyRequest|ReadyResponse);
export type Request=Context&{
    type: "request",
    path: string,
    params: any,
};
export function isRequest(m:Message):m is Request{
    return m.type==="request";
}
export type Fail=Context&{
    type: "fail",
    status:"error",
    error: Error,
};
export function isFail(m:Message):m is Fail{
    return m.type==="fail";
}
export type Success=Context&{
    type: "success",
    result:any,
    status:"ok",
};
export function isSuccess(m:Message):m is Success{
    return m.type==="success";
}
export type Handler=(params:any, context:Context)=>any;
type Context={id:string, channel:string};

export type ReadyRequest=Context&{
    type:"readyRequest",
    id:"READY",
};
export function isReadyRequest(m:Message):m is ReadyRequest{
    return m.type==="readyRequest";
}
export const readyRequest=(channel:string):ReadyRequest=>({id:"READY",channel,type:"readyRequest"});
export type ReadyResponse=Context&{
    type: "readyResponse",
    id:"READY",
    status:"ready",
};
export function isReadyResponse(m:Message):m is ReadyResponse{
    return m.type==="readyResponse";
}