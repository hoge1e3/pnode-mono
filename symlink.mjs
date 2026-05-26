#!run
export async function main(opt={}){
  const ndm=this.resolve("node_modules");
  const wss=this.resolve("package.json").obj().workspaces;
  for (let ws of wss) {
    // for node_modules/{path of ws} , check it is symlink. otherwise link to workspace folder
    this.cd(ws);
    this.echo(ws);
    const pkg=this.resolve("package.json").obj();
    const n=pkg.name;
    const nd=ndm.rel(n);
    if (!nd.exists() || !nd.isLink()) {
        this.echo(nd+" is not exists or not a symlink");
        if (nd.exists()) this.rm(nd,{r:1});
        this.ln(this.resolve("."), nd);
    } else {
      //this.echo(nd+" is a link. nothing changed.");
    }
    this.cd("..");
  }
}