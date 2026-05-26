# rpc
Send to/from worker/iframe via postmessage.

## Sample Code
See `test/` folder.

## API Reference
- `new rpc.Server(channel:string, allowOrigin:string[])`
  - Create server in iframe or Worker context.
  - `serv(name:string, (params:any)=>any)`
    - set service with specified name and function.
- `new rpc.Server(target: Window|Worker, channel:string, allowOrigin:string[])`
  - Create "reverse" server in browser context to process request from target
  - use `serv` method as well
- `new rpc.Client(target: Window|Worker, channel:string, origin:string|undefined)`
  - Create client connect to target
  - `run(name, params:any)`
    - send request to service with name. 
    - Return value is a Promise of the result value processed in service.
- `rpc.proxy.server(channel:string, allowOrigin:string[], methods:{[key:string]:Function})`
  - Create proxy-styled server. 
  - `methods` are list of service that can call from client. 
- `rpc.proxy.server(target: Window|Worker, channel:string, allowOrigin:string[], methods:{[key:string]:Function})`
  - Create proxy-styled "reverse" server that receives request from target. 
- `rpc.proxy.client(target: Window|Worker, channel:string, origin:string|undefined)`
  - Create proxy-styled client.
  - This client can call service on server with regular method invocation style. 
- `rpc.proxy.transfer(o, trans?)`
  - Mark a transferable object to be transferred (not copied) when passed to a proxy-styled client call.
  - `o`: The object to transfer (e.g. `ArrayBuffer`, `MessagePort`).
  - `trans`: Optional explicit list of transferables. They should be highly related with `o`(ex. property of `o`). Defaults to `[o]`. `
  - Example: `proxyClient.myMethod(rpc.proxy.transfer(buffer))`

## Worker Utilities

`rpc.worker` provides shorthand helpers for Worker contexts, omitting origin-related arguments that are only needed for cross-origin iframe communication.

- `rpc.worker.server(channel:string)`
  - Create a server inside a Worker. Equivalent to `new rpc.Server(globalThis, channel, [])`.
- `rpc.worker.client(target:Worker, channel:string)`
  - Create a client that connects to a Worker. Equivalent to `new rpc.Client(target, channel)`.
- `rpc.worker.proxy.server(channel:string, methods:{[key:string]:Function})`
  - Create a proxy-styled server inside a Worker.
- `rpc.worker.proxy.client(target:Worker, channel:string, manualProbe?:boolean)`
  - Create a proxy-styled client that connects to a Worker.
- `rpc.worker.proxy.withChannel(channel:string)`
  - Returns a `{ server(methods), client(target, manualProbe?) }` factory with the channel name fixed.
  - Useful when the same channel is referenced in multiple places.
- `rpc.worker.proxy.defaultChannel`
  - A pre-built factory equivalent to `rpc.worker.proxy.withChannel("default")`.
