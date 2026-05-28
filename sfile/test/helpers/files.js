import { assert, _assert } from "./assert.js";
import { _console } from "./logging.js";
import { timeout } from "./async.js";
export function checkSameDir(a, b) {
    let res1 = [];
    let res2 = [];
    a.recursive(function (f) {
        res1.push(f.relPath(a));
    });
    b.recursive(function (f) {
        res2.push(f.relPath(b));
    });
    _console.log("checkSameDir", a.path(), b.path(), res1, res2);
    _assert.deepStrictEqual(res1.sort(), res2.sort());
}
export function checkSame(a, b) {
    _console.log("check same", a.name(), b.name(), a.text().length, b.text().length);
    if (a.isText() && b.isText() && a.text() !== b.text()) {
        throw new Error("text is not match: " + a + "!=" + b + "\n" +
            "content ----\n" + a.text() + "\n----\n" + b.text());
    }
    let _a1 = a.getBytes({ binType: ArrayBuffer });
    let _b1 = b.getBytes({ binType: ArrayBuffer });
    let a1 = new Uint8Array(_a1);
    let b1 = new Uint8Array(_b1);
    _console.log("bin dump:", a1[0], a1[1], a1[2], a1[3]);
    assert(a1.length > 0, "shoule be longer than 0");
    assert(a1.length == b1.length, "length is not match: " + a + "," + b);
    for (let i = 0; i < a1.length; i++)
        assert(a1[i] == b1[i], "failed at [" + i + "]");
}
export function eqa(a, b) {
    _assert.deepStrictEqual(a.sort().join(","), b.sort().join(","));
}
export async function retryRmdir(dir) {
    for (let i = 0; i < 10; i++) {
        try {
            dir.rm({ r: true });
            return;
        }
        catch (e) {
            _console.log("retryRmdir", e.stack);
            await timeout(1000);
        }
    }
    throw new Error("retryRmdir " + dir + " failed");
}
//# sourceMappingURL=files.js.map