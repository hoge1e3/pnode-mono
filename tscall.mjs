#!run
export async function main(opt={}){
  const ndm=this.resolve("node_modules");
  const wss=this.resolve("package.json").obj().workspaces;
  for (let ws of wss) {
    this.cd(ws);
    if (!this.resolve("tsconfig.json").exists()){
      this.echo("Skip", ws);
      this.cd("..");
      continue;
    }
    const pkg=this.resolve("package.json").obj();
    const n=pkg.name;
    const nd=ndm.rel(n);
    if (!nd.exists()) {
      this.ln(this.resolve("."), nd);
    }
    if (opt.clean && 
    this.resolve(".tsbuildinfo").exists()) {
      this.rm(".tsbuildinfo");
    }
    const r=await this.tsc();
    this.echo(ws, r);
    this.cd("..");
  }
  this.echo("All Done");
}