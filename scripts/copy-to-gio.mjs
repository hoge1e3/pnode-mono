import * as shell from "../shell.mjs";

const sh=await shell.create();
const ap=sh.resolve("hoge1e3.github.io/acepad");
sh.cp(
sh.resolve("bootpack/dist/index.js"),
ap.rel("preinstalled/petit-node.js")
);
sh.cp(
sh.resolve("webcartridge/dist/webcartridge.js"),
ap.rel("webcartridge.js")
);
const zipfile=ap.rel("setup.zip");
sh.cd("idb/run");
await sh.exec("zip",["-r", zipfile.path(), ".",  "-x", ".gsync/*"]);


