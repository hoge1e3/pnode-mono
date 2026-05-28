import * as _assert from "assert";
export const assert = Object.assign((b, m) => _assert.ok(b, m), {
    eq: _assert.equal,
    ensureError: _assert.throws,
    func(f) {
        return ((...args) => {
            try {
                return f(...args);
            }
            catch (e) {
                console.log(f.name + " failed. args:", ...args);
                throw e;
            }
        });
    },
    deepStrictEqual: _assert.deepStrictEqual,
});
export { _assert };
//# sourceMappingURL=assert.js.map