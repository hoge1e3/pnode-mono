import * as _assert from "assert";

export const assert = Object.assign(
  (b:any, m?:string)=>_assert.ok(b,m),{
  eq:_assert.equal,
  ensureError: _assert.throws,
  func<T extends (...args: any[]) => any>(f:T) {
    return ((...args:Parameters<T>):ReturnType<T>=>{
      try {
        return f(...args);
      } catch(e) {
        console.log(f.name+" failed. args:",...args);
        throw e;
      }
    }) as T;
  },
  deepStrictEqual: _assert.deepStrictEqual,
});

export { _assert };
