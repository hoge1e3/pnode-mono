import type {ExportAllDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration, ImportDeclaration, Literal} from "acorn";
import { simple, SimpleVisitors } from "acorn-walk";
import { CompiledESModule} from "./Module.js";
import { FileBasedModuleEntry } from "./Module.js";
import { IAliases, Module, NodeRange, Replacement, ScriptingContext } from "../types/index.js";
//import { astCache } from "./AstCache.js";
import type { AstCache } from "./AstCache.js";


type URLConverter = {
  conv:(s: string) => Promise<string>;
  deps:Module[];
};
function spliceStr(str:string, 
    begin:number, end:number, 
    replacement:string) {
  const firstPart = str.slice(0, begin);
  const lastPart = str.slice(end);
  return firstPart + (replacement || '') + lastPart;
}
const sourceMapPat=/\/\/# sourceMappingURL=([^\r\n]+)\s*$/;
export async function convert(aliases:IAliases, entry: FileBasedModuleEntry,urlConverter:URLConverter): Promise<CompiledESModule> {
  const file=entry.file;
  try {
    const sourceCode=file.text();
    const importSources=aliases.astCache.get(file, sourceCode);
    const replPromises=[] as Promise<Replacement>[];
    const convLiteral=(source: Literal)=>{
      const range=source.range||[0,0];
      const originalSource = source.value;
      const convertedSource = urlConverter.conv(originalSource as string);
      replPromises.push(convertedSource.then((s:string)=>({
        to: `/*${JSON.stringify(originalSource)}*/${JSON.stringify(s)}`,
        range: range.slice() as NodeRange
      })));
    };
    for (let source of importSources) {
      convLiteral(source);
    }
    /*
    const visitor = {
      ExportAllDeclaration(node: ExportAllDeclaration) {
        if (node.source) convLiteral(node.source);
      },
      ExportNamedDeclaration(node: ExportNamedDeclaration) {
        if (node.source) convLiteral(node.source);
      },
      ImportDeclaration(node: ImportDeclaration) {
        if (node.source) convLiteral(node.source);
      },
    } as SimpleVisitors<unknown>;
    simple(ast, visitor);*/
    let conv2=sourceCode;
    await Promise.all(replPromises).then((repls)=>{
      const sorted=repls.sort((a,b)=>b.range[0]-a.range[0])
      for(let {range,to} of sorted){
        conv2=spliceStr(conv2,range[0],range[1],to);
      }
    });
    let sourceMapInjected=false;
    const sctx=aliases.scriptingContext;
    if (sctx.process?.env?.PNODE_SOURCE_MAP) {
      conv2=conv2.replace(sourceMapPat,(_,mpath)=>{
        const srcmf=file.sibling(mpath);
        if (srcmf.exists()) {
          sourceMapInjected=true;
          const cont=srcmf.getContent();
          cont.contentType="application/json";
          return `//# sourceMappingURL=${cont.toURL()}\n`;
        } 
        return `//# sourceMappingURL=${mpath}\n`;
      })
    }
    if (!sourceMapInjected) {
      conv2+=`\n//# sourceURL=file://${file.path()}\n`;
    }
    const gensrc=conv2;
    const url= sctx.URL.createObjectURL(new sctx.Blob([gensrc],{type:"text/javascript"}));
    return new CompiledESModule(
      sctx,
      entry, 
      urlConverter.deps, url, gensrc);
  } catch (err) {
    const original=err as any;
    console.error(err);
    const e=new Error("At "+file.path()+
    (original.lineNumber? ":"+original.lineNumber+":"+original.column :"")+"\n"+
    original.message) as any;
    e.original=original;
    e.file=file;
    throw e;
  }
}