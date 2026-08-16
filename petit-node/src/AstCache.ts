import * as espree from "espree";
import type { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration, Literal } from "acorn";
import type { SFile } from "@hoge1e3/sfile";
import { NodeRange } from "../types";
import { simple, SimpleVisitors } from "acorn-walk";

type Entry={timestamp:number,importSources:Literal[]};
/*function optsKey(options?:espree.Options):string {
  if (!options) return "";
  const o=options as Record<string,unknown>;
  return Object.keys(o).sort().map((k)=>`${k}=${JSON.stringify(o[k])}`).join("&");
}*/
export class AstCache {
  private store=new Map<string,Entry>();
  get(file:SFile, source?:string):Literal[] {
    const key=`${file.path()}`;
    const ts=file.lastUpdate();
    const cached=this.store.get(key);
    if (cached && cached.timestamp===ts) return cached.importSources;
    const ast=espree.parse(source??file.text(), {
      sourceType: 'module',
      loc: true,
      range: true,
      ecmaVersion: 2024,
    });
    const importSources:Literal[]=[];
    const visitor = {
      ExportAllDeclaration(node: ExportAllDeclaration) {
        if (node.source) importSources.push(node.source);
      },
      ExportNamedDeclaration(node: ExportNamedDeclaration) {
        if (node.source) importSources.push(node.source);
      },
      ImportDeclaration(node: ImportDeclaration) {
        if (node.source) importSources.push(node.source);
      },
    } as SimpleVisitors<unknown>;
    simple(ast, visitor);
    //importSourceRanges.sort((a,b)=>b.range![0]-a.range![0])
    this.store.set(key,{timestamp:ts,importSources});
    return importSources;
  }
  clear():void {this.store.clear();}
}
//export const astCache=new AstCache();
