import { diffLines, Change } from "diff";

type Edit={start:number,end:number,lines:string[]};

function toLines(s:string){return s.split(/\r?\n/);}
function chunkLines(s:string):string[]{
  const l=s.split(/\r?\n/);
  if(l[l.length-1]==="")l.pop();
  return l;
}
function edits(a:string[],b:string[]):Edit[]{
 const changes=diffLines(a.join("\n"),b.join("\n"));
 let ai=0; const out:Edit[]=[];
 for(let i=0;i<changes.length;i++){
  const c=changes[i] as any;
  if(!c.added&&!c.removed){ai+=chunkLines(c.value).length;continue;}
  if(c.removed){
    const rem=chunkLines(c.value); let add:string[]=[];
    if(i+1<changes.length && (changes[i+1] as any).added){
      add=chunkLines((changes[++i] as any).value);
    }
    out.push({start:ai,end:ai+rem.length,lines:add});
    ai+=rem.length;
  }else if(c.added){
    out.push({start:ai,end:ai,lines:chunkLines(c.value)});
  }
 }
 return out;
}

// m.lines と t.lines を比較し、完全に同じならそのまま res に出力し、
// 違いがあれば内部でさらに diff を取って、本当に違う部分だけを
// <<<<<<< MINE / ======= / >>>>>>> THEIRS で囲んで出力する。
// これにより「両方が全く同じ行を挿入した」「一部だけ重なっている」といった
// ケースで、不要なコンフリクトマーカーを避けられる。
// 戻り値はこの呼び出しでコンフリクトが実際に発生したかどうか。
function emitMergeOrConflict(res:string[], m:Edit, t:Edit):boolean{
  if(m.end==t.end && JSON.stringify(m.lines)==JSON.stringify(t.lines)){
    res.push(...m.lines);
    return false;
  }
  let hasConflict=false;
  // diffLines は文字列単位なので join して diff を取り、各 change を処理する
  const md = diffLines(m.lines.join("\n"), t.lines.join("\n"));
  // グルーピングして連続する変更をひとつのコンフリクトブロックにする
  let pendingMine: string[] = [];
  let pendingTheirs: string[] = [];
  const isEmpty=(s:string[])=>s.join("\n").trim()==="";
  const flush = () => {
    if(pendingMine.length===0 && pendingTheirs.length===0) return;
    const em=isEmpty(pendingMine), et=isEmpty(pendingTheirs);
    if (em || et) {
      if (!et) res.push(...pendingTheirs);
      if (!em) res.push(...pendingMine);
    } else {
      hasConflict = true;
      res.push("<<<<<<< MINE");
      res.push(...pendingMine);
      res.push("=======");
      res.push(...pendingTheirs);
      res.push(">>>>>>> THEIRS");
    }
    pendingMine = [];
    pendingTheirs = [];
  };
  for(const c of md as any){
    if(!c.added && !c.removed){
      // 共通部分はまず未決を出してからそのまま出力
      flush();
      const common = chunkLines(c.value);
      res.push(...common);
    }else if(c.removed){
      pendingMine.push(...chunkLines(c.value));
    }else if(c.added){
      pendingTheirs.push(...chunkLines(c.value));
    }
  }
  flush();
  return hasConflict;
}

export function merge3(ancestor:string,mine:string,theirs:string):[string,boolean]{
 const base=toLines(ancestor);
 const me=edits(base,toLines(mine));
 const th=edits(base,toLines(theirs));
 let mi=0,ti=0,pos=0,res:string[]=[],hasConflict=false;
 while(pos<=base.length){
  const m=me[mi],t=th[ti];
  const ns=Math.min(m?m.start:1e9,t?t.start:1e9,base.length);
  while(pos<ns){res.push(base[pos++]);}
  if(pos>=base.length && !m && !t)break;
  const mHere = !!m && m.start===pos;
  const tHere = !!t && t.start===pos;

  if(mHere&&tHere){
    // 両方が同じ位置から始まる編集
    if(emitMergeOrConflict(res,m,t)) hasConflict=true;
    pos=Math.max(m.end,t.end); mi++; ti++; continue;
  }
  // 片方の編集が、もう片方の範囲に食い込んでいる場合もコンフリクトとして
  // まとめて処理する（そうしないと pos が相手の start を追い越してしまい、
  // 二度と mi/ti が進まなくなって無限ループする）
  if(mHere && t && t.start<m.end){
    if(emitMergeOrConflict(res,m,t)) hasConflict=true;
    pos=Math.max(m.end,t.end); mi++; ti++; continue;
  }
  if(tHere && m && m.start<t.end){
    if(emitMergeOrConflict(res,m,t)) hasConflict=true;
    pos=Math.max(m.end,t.end); mi++; ti++; continue;
  }
  if(mHere){ res.push(...m.lines); pos=m.end; mi++; continue; }
  if(tHere){ res.push(...t.lines); pos=t.end; ti++; continue; }
  if(pos<base.length){res.push(base[pos++]);}
 }
 return [res.join("\n"),hasConflict];
}
