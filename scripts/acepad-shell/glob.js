
const truncSEP = ((s) => s.replace(/\/$/, ""));
export function glob(path){
    if (!hasWildcard(path)) {
        return [path];
    }
    path=truncSEP(path);
    const d=path.split("/");
    const s=[];
    while(d.length) {
        const c=d.shift();
        if (!hasWildcard(c)) {
            s.push(c);
        } else {
            d.push(c);
            break;
        }
    }
    /*for (let i=0;i<d.length;i++) {
        if (i<d.length-1) d[i]+="/";
        else if (d[i]==="") d.pop();
    }*/
    const base=this.resolve("./");
    const pats=d.map(wildcardToRegex);

    //console.log("path, d, s, pats", path, d, s, pats);
    const dir=this.resolve(s.join("/"));
    function* traverse(dir, pats) {
        //console.log("dir, pats", dir, pats);
        if (pats.length==0) {
            yield dir.relPath(base);
            return;
        }
        const [pat,...cdr]=pats;
        if (!dir.isDir()) return;
        for (let c of dir.ls()) {
            c=truncSEP(c);
            if (c.match(pat)) {
                yield* traverse(dir.rel(c), cdr);
            }
        }
    }
    return traverse(dir, pats);
    
}
export function hasWildcard(c) {
    return c.match(/[\*\?]/);
}
function wildcardToRegex(pattern) {
  const specialChars = '.+^$()[]{}|\\';
  const pathSeparators = '/\\';
  
  let regex = '^';
  
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    
    if (char === '*') {
      regex += '[^' + pathSeparators.replace("\\","\\\\") + ']*';
    } else if (char === '?') {
      regex += '[^' + pathSeparators.replace("\\","\\\\") + ']';
    } else if (specialChars.includes(char)) {
      regex += '\\' + char;
    } else if (pathSeparators.includes(char)) {
      regex += '[/\\\\]';
    } else {
      regex += char;
    }
  }
  
  regex += '$';
  
  return new RegExp(regex);
}