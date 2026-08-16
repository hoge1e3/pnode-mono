import * as espree from "espree";
import type { Program } from "acorn";
import type { SFile } from "@hoge1e3/sfile";

type Entry={timestamp:number,ast:Program};
function optsKey(options?:espree.Options):string {
  if (!options) return "";
  const o=options as Record<string,unknown>;
  return Object.keys(o).sort().map((k)=>`${k}=${JSON.stringify(o[k])}`).join("&");
}
export class AstCache {
  private store=new Map<string,Entry>();
  get(file:SFile, options?:espree.Options, source?:string):Program {
    const key=`${file.path()}#${optsKey(options)}`;
    const ts=file.lastUpdate();
    const cached=this.store.get(key);
    if (cached && cached.timestamp===ts) return cached.ast;
    const ast=espree.parse(source??file.text(), options);
    this.store.set(key,{timestamp:ts,ast});
    return ast;
  }
  clear():void {this.store.clear();}
}
//export const astCache=new AstCache();
