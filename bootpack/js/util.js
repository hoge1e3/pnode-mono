//@ts-check
/**
 * 
 * @param {string} key 
 * @param {string|undefined} default_ 
 * @returns {string|undefined}
 */
export function getQueryString(key, default_) {
    if (arguments.length === 1) default_ = "";
    key = key.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + key + "=([^&#]*)");
    var qs = regex.exec(location.href);
    if (qs == null) return default_;else return decodeURLComponentEx(qs[1]);
}
/**
 * 
 * @param {string} s 
 * @returns {string}
 */
export function decodeURLComponentEx(s) {
    return decodeURIComponent(s.replace(/\+/g, '%20'));
}
/**
 * @template {(...a:any[])=>Promise<void>} T 
 * @param {T} f 
 * @returns {(...a: Parameters<T>) => Promise<void>}
 */
export function wrapException(f) {
  return async (/** @type {any[]} */ ...a)=>{
    try {
      return await f(...a);
    } catch (/** @type {any} */e) {
      let buf="";
      if (e?.message) buf+=e.message;
      if (e?.stack) buf+=e.stack;
      if (!buf) buf+=e+""; 
      alert(buf);
      throw e;
    }
  };
}
/**
 * @param {(this:Window,e:Event)=>any} callback 
 */
export function onReady(callback) {
  callback=wrapException(callback);
  if (document.readyState==="complete") callback.call(window,new Event("load"));
  else addEventListener("load",callback);
}
/**
 * @param {any} o 
 * @param {string} n 
 */
export function can(o,n){
  return n in o && typeof o[n]==="function" && o[n];
}
/** @type (t:number)=>Promise<void> */
export const timeout=(t)=>new Promise(s=>setTimeout(s,t));
/**@type ()=>import("./types").MutablePromise<any> */
function mp(){
    const t=()=>{
        //@ts-ignore
        let v=t,f,c=()=>v!==t&&f&&f(v);
        // @ts-ignore
        return{v:(_)=>c(v=_),f:(_)=>c(f=_)};
    },s=t(),e=t();return Object.assign(
    new Promise((a,b)=>s.f(a)+e.f(b)),
    {resolve:s.v, reject:e.v});
}
export const mutablePromise=mp;
/**@type (o:any)=>boolean */
export function isPlainObject(o) {
    return o && o.__proto__===Object.prototype;
}
/** @type ((qs:string)=>HTMLElement)|((root:HTMLElement, qs:string)=>HTMLElement) */
/** @param {any[]} a */
export function qsExists(...a) {
    const [root, q]=a.length>=2?a:[document, a[0]];
    //@ts-ignore
    /** @type {HTMLElement} r */
    const r=root.querySelector(q);
    if (!r) throw new Error(`${q} does not exist`);
    return r;
}

/** @type (dbName:string)=>Promise<string> 
export function deleteAllTablesInDatabase(dbName) {
  return new Promise((resolve, reject) => {
    // データベースを開く
    const request = indexedDB.open(dbName);
    request.onsuccess = (event) => {
        //@ts-ignore
      const db = event.target.result;
      // トランザクションを開始（すべてのオブジェクトストアにアクセスする）
      console.log("db.objectStoreNames", db.objectStoreNames);
      if (db.objectStoreNames.length===0) return resolve("object store was Empty.");
      const transaction = db.transaction(db.objectStoreNames, 'readwrite');
      transaction.oncomplete = () => {
        // トランザクションが成功した場合、データベースを閉じてPromiseを解決
        db.close();
        resolve(`All tables in the database "${dbName}" have been deleted.`);
      };
    //@ts-ignore
      transaction.onerror = (event) => {
        // トランザクション中にエラーが発生した場合、データベースを閉じてPromiseを拒否
        db.close();
        reject(`Error deleting tables in the database "${dbName}": ${event.target.error}`);
      };

      // オブジェクトストアをすべて削除
      Object.keys(db.objectStoreNames).forEach(i => {
        console.log("Deleting", db.objectStoreNames[i]);
        const store = transaction.objectStore(db.objectStoreNames[i]);
        store.clear();  // 各オブジェクトストアを削除（clear()はストア内の全データを削除）
      });
    };
    request.onerror = (event) => {
      // データベースのオープンに失敗した場合
        //@ts-ignore
      reject(`Failed to open the database "${dbName}": ${event.target.error}`);
    };
  });
}*/
/**
 * 
 * @param {string} n 
 * @returns string
 */
export function getEnv(n){
  const r=process.env[n];
  if (!r) throw new Error(`No envvar for ${n}`);
  return r;
}
/**
 * 
 * @param {string} p 
 * @retuns string
 */
export function directorify(p) {
  if (!p.endsWith("/")) p+="/";
  return p;
}
/**
 * 
 * @param {Blob} blob
 * @returns {Promise<ArrayBuffer>} 
 */
export function blob2arrayBuffer(blob){
  const r=mutablePromise();
  const f=new FileReader();
  f.onload=()=>r.resolve(f.result);
  f.onerror=()=>f.error&&r.reject(f.error);
  f.readAsArrayBuffer(blob);
  return r;
}