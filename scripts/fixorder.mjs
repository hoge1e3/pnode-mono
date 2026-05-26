import { load } from "./workspaces.mjs";
export function fixOrder() {
    const pkg =  JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const n2ws=load();
    function order(w, ord=[]) {
        if (ord.includes(w)) return;
        for (let dw of w.depsInWs(n2ws)) {
            order(dw, ord);
        }
        ord.push(w);
        return ord;
    }
    const ord=[];
    for (let [name, p] of n2ws) {
        order(p,ord);
    }
    pkg.workspaces=(ord.map(o=>o.dir));
    fs.writeFileSync("./package.json",JSON.stringify(pkg,null,2));
    console.log("Fixed workspace order as: ", pkg.workspaces);
    return ord;
}
fixOrder();


//list();