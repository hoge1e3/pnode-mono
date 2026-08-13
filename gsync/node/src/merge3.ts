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
  if(m && m.start==pos && (!t||t.start>pos)){
    res.push(...m.lines); pos=m.end; mi++; continue;
  }
  if(t && t.start==pos && (!m||m.start>pos)){
    res.push(...t.lines); pos=t.end; ti++; continue;
  }
  if(m&&t&&m.start==pos&&t.start==pos){
    if(m.end==t.end && JSON.stringify(m.lines)==JSON.stringify(t.lines)){
      res.push(...m.lines);
    }else{
      hasConflict=true;
      res.push("<<<<<<< MINE");
      res.push(...m.lines);
      res.push("=======");
      res.push(...t.lines);
      res.push(">>>>>>> THEIRS");
    }
    pos=Math.max(m.end,t.end); mi++; ti++; continue;
  }
  if(pos<base.length){res.push(base[pos++]);}
 }
 return [res.join("\n"),hasConflict];
}
