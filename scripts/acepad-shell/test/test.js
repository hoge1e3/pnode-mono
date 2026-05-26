

export function main(a,opt={}) {
    this.echo(a);
    this.echo(this.resolve("."));
    for (let f of this.glob(a)){
        this.echo(opt.header,f);
    }

}