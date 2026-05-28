import * as _assert from "assert";
export declare const assert: ((b: any, m?: string) => void) & {
    eq: typeof _assert.equal;
    ensureError: typeof _assert.throws;
    func<T extends (...args: any[]) => any>(f: T): T;
    deepStrictEqual: typeof _assert.deepStrictEqual;
};
export { _assert };
