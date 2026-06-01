import { fs, dev, path, process } from "../src/index.js";
import * as jszip from "jszip";
import { FileSystemFactory } from "@hoge1e3/sfile/js/src/SFile.js";
import { main } from "@hoge1e3/sfile/js/test/test.js";
import { runPass1 } from "@hoge1e3/sfile/js/test/pass1.js";
import { runPass2 } from "@hoge1e3/sfile/js/test/pass2.js";
import { Buffer } from "buffer";
const FS = new FileSystemFactory({
    fs: fs,
    path: path,
    Buffer,
});
globalThis.process = process;
async function extractFixture(to) {
    const resp = await fetch("fixture.zip");
    const buf = await resp.arrayBuffer();
    const zipf = await jszip.loadAsync(buf);
    for (const key of Object.keys(zipf.files)) {
        const obj = zipf.files[key];
        const f = to.rel(obj.name);
        if (obj.dir) {
            f.mkdir();
        }
        else {
            const b = await obj.async("arraybuffer");
            f.setBytes(b);
            if (b.byteLength > 0 && f.size() == 0) {
                throw new Error("Size mismatch after write: " + f.path() + " buf=" + b.byteLength);
            }
        }
    }
}
async function setup(FS, cleanups) {
    fs.mkdirSync("/zip/", { recursive: true });
    dev.mountSync("/zip/", "ram");
    const root = FS.get("/");
    const zipDir = root.rel("zip/");
    await extractFixture(zipDir);
    const fixture = zipDir.rel("fixture/");
    const romd = fixture.rel("rom/");
    let ramd = root.rel("ram/");
    fs.mkdirSync("/ram/", { recursive: true });
    dev.mountSync("/ram/", "ram");
    //if (ramd.exists()) ramd.rm({r: true});
    //ramd.mkdir();
    const testf = fixture.rel("testfn.txt");
    cleanups.push(async () => testf.exists() && testf.rm());
    return { fixture, romd, ramd, testf, cleanups, skipRamdCleanup: true };
}
main({
    runPass1,
    runPass2,
    FS,
    setup: (_FS, cleanups) => setup(_FS, cleanups),
});
//# sourceMappingURL=new-test.js.map