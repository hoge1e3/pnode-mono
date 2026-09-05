import { pollute } from "./global.js";
import pNode from "petit-node";
export async function init(env = {}) {
    console.log("init");
    await pNode.boot(); // 'process' is enabled here
    Object.assign(process.env, env);
    process.env.PNODE_VER = pNode.version;
    //process.env.boot=process.env.TMP_BOOT||"/tmp/boot/";
    pollute({ pNode, FS: pNode.getFS() });
    return pNode;
}
export function getInstance() {
    return pNode;
}
//# sourceMappingURL=pnode.js.map