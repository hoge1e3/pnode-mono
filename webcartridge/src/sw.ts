import { ExtendableEvent, ExtendableMessageEvent, FetchEvent, ServiceWorkerGlobalScope } from "./types";

declare const self:ServiceWorkerGlobalScope;
export function startSerivceWorker(){
  const NAME = 'webcartridge';
  const VERSION = '035';
  const CACHE_NAME = NAME + VERSION;
  const urlsToCache: string[] = [];
  const global=globalThis as any;
  let cache: Cache;


  const origLog = console.log.bind(console);
  const origError = console.error.bind(console);
  
  async function forward(type: string, args: any[]) {
    try {
      for (let cl of await self.clients.matchAll()) {
        cl.postMessage({
          type: 'console',
          level: type,
          args: args.map(a => {
            try {
              return typeof a === 'string' ? a : JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
        });
      }
    } catch(e) {
      origError(e);
    }
  }
  
  console.log = (...args: any[]) => {
    forward('log', args);
    origLog(...args);
  };
  
  console.error = (...args: any[]) => {
    forward('error', args);
    origError(...args);
  };

  addEventListener("error", (e: ErrorEvent) => console.error("err", e.error + ""));
  addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => console.error("unh", e.reason + ""));

  const fh = <T extends (...args: any[]) => any>(f: T) =>
    async (...a: Parameters<T>): Promise<void> => {
      try {
        return await f(...a);
      } catch(e) {
        console.error(e);
      }
    };

  async function installEvent(event: ExtendableEvent): Promise<void> {
      self.skipWaiting();
      cache = await caches.open(CACHE_NAME);
      console.log('Opened cache', cache, CACHE_NAME);
      return cache.addAll(urlsToCache);
  }

  global.getCache = getCache;

  async function getCache(): Promise<Cache> {
    if (cache) return cache;
    cache = await caches.open(CACHE_NAME);
    return cache;
  }

  global.CACHE_NAME = CACHE_NAME;
  self.addEventListener('install', 
    (event: ExtendableEvent) => event.waitUntil(installEvent(event)));

  const messageHandlers = new Map<string, Function>();

  function addMessageHandler(type: string, handler: Function): void {
      messageHandlers.set(type, handler);
      console.log("message handler added", type);
  }

  function removeMessageHandler(type: string): void {
      messageHandlers.delete(type);
      console.log("messaged handler removed", type);
  }

  (self as any).addMessageHandler = addMessageHandler;
  (self as any).removeMessageHandler = removeMessageHandler;

  addMessageHandler("EVAL", async (event: ExtendableMessageEvent) => {
    const { script } = event.data || {};
    try {
      const r = await (global.eval(script));
      event.source?.postMessage(r);
    } catch(e) {
      console.error(e);
      event.source?.postMessage({
        type: "error",
        error: e + ""
      });
    } 
  });

  addMessageHandler("serve_blob", async (event: ExtendableMessageEvent) => {
    const { url, blob } = event.data || {};
    const cache = await getCache();
    cache.put(
      url,
      new Response(blob, {
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "Content-Length": blob.size
        }
      }));
    event.source?.postMessage({ type: "response", for: "serve_blob", url });
  });

  addMessageHandler("unserve_blob", async (event: ExtendableMessageEvent) => {
    const { url } = event.data || {};
    const cache = await getCache();
    await cache.delete(url);
    event.source?.postMessage({ type: "response", for: "unserve_blob", url });
  });

  addMessageHandler("list_blob", async (event: ExtendableMessageEvent) => {
    const cache = await getCache();
    const requests = await cache.keys();
    const urls = requests.map(req => req.url);
    event.source?.postMessage({
      type: "response",
      for: "list_blob",
      urls
    });
  });

  addMessageHandler("CACHE_NAME", (event: ExtendableMessageEvent) => {
      event.source?.postMessage({ CACHE_NAME });
  });

  addMessageHandler("serve", (event: ExtendableMessageEvent) => {
    const { path } = event.data;
    const client = event.source;
    
    addUrlHandler(path, async (event: FetchEvent) => {
      event.respondWith(handle(event));
      
      async function handle(event: FetchEvent): Promise<Response> {
        return new Promise((resolve) => {
          const type = crypto.randomUUID();
          addMessageHandler(type, (e: ExtendableMessageEvent) => {
            const { response } = e.data;
            resolve(new Response(response.body, response));
            (self as any).removeMessageHandler(type);
          });
          client?.postMessage({
            type,
            request: {
              url: event.request.url,
              method: event.request.method
            }
          });
        });
      }
    });
  });

  self.addEventListener("message", fh((event: MessageEvent) => {
      const { type } = event.data || {};
      if (!messageHandlers.has(type)) {
          event.source?.postMessage({ type: "error", message: `sw: message type '${type}' is not found` });
          return;
      }
      messageHandlers.get(type)?.(event);
  }));

  function useCacheOnlyIfOffline({ url }: { url: string }): boolean {
      if (!(self as any).registration.scope) return true;
      if (url.includes("?")) return true;
      if (url.match(/\blatest\b/)) return true;
      if (!url.startsWith((self as any).registration.scope)) return false;
      return !url.includes("/gen/");
  }

  const doNotRetryOpaque = new Set<string>();
  const urlHandlers = new Map<string, Function>();

  function addUrlHandler(path: string, handler: Function): void {
      urlHandlers.set(path, handler);
      console.log("urlHandler added", path);
  }

  function removeUrlHandler(path: string): void {
      urlHandlers.delete(path);
      console.log("urlHandler removed", path);
  }

  (self as any).addUrlHandler = addUrlHandler;
  (self as any).removeUrlHandler = removeUrlHandler;

  (self as any).addEventListener('fetch', fh((event: FetchEvent) => {
      async function respond(event: FetchEvent): Promise<Response> {
          const { request } = event;
          const { url } = request;
          let path = url.substring((self as any).registration.scope.length).replace(/^\//, "");
          let paths = path.split("/");
          
          if (urlHandlers.has(paths[0])) {
            const r = urlHandlers.get(paths[0])?.(event);
            if (r) return r;
          }
          
          if (request.method !== "GET") {
              return await fetch(request);
          }
          
          if (!cache) {
              try {
                  cache = await caches.open(CACHE_NAME);
              } catch(e) {
                  console.log(e);
              }
              if (!cache) return await fetch(request);
          }
          
          if (useCacheOnlyIfOffline(request)) {
              try {
                  const response = await fetch(request);
                  if (response.ok) cache.put(request, response.clone());
                  return response;
              } catch (e) {
                console.log("fetch useCache Fail",request.url);
                  console.error(e);
              }
          }
          
          let response = await cache.match(request);
          if (response) {
              return response;
          }
          
          response = await fetch(event.request);
          if (response.type === "opaque" && !doNotRetryOpaque.has(url)) {
              try {
                  response = await fetch(url);
              } catch(e) {
                  doNotRetryOpaque.add(url);
              }
          }
          
          if (response.ok) cache.put(request, response.clone());
          return response;
      }
      
      return event.respondWith(respond(event));
  }));

  async function activateEvent(event: ExtendableEvent): Promise<void> {
      console.log("activate", event, CACHE_NAME);
      const keys = await caches.keys();
      console.log("keys", keys);
      await Promise.all(keys.map((key) => {
          console.log("keys-delete?", key, CACHE_NAME);
          if (!key.includes(CACHE_NAME)) {
              return caches.delete(key);
          }
      }));
      console.log(CACHE_NAME + " activated");
      event.waitUntil(self.clients.claim());
  }

  (self as any).addEventListener('activate', 
    (event: ExtendableEvent) => event.waitUntil(activateEvent(event)));
  self.addEventListener("install", () => {
    self.skipWaiting();
  });

  self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
  });
}