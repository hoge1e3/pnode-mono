#!run
import * as cmd from "./js/src/cmd.js";
export async function main(...a) {
    try{
      this.echo("See console(F11) for details...");
      console.log("gsync-arg",a);
      const r=await cmd.main(this.cwd().path(), ["run", "gsync", ...a], this);
      if (Array.isArray(r)) {
        for (let e of r) {
            this.echo(e);
        }
      }
      return r;
    }catch(error)  {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.log("Status:", error.response.status);
            console.log(error.response.data);
            //console.log(error.response.headers);
        } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.log("Request failed", error.errors || error + "");
        } else {
            // Something happened in setting up the request that triggered an Error
            console.log('Error', error.stack);
        }
        this.echo("Error see console(F11) for details.");
        //if (error.config) console.log(error.config);
    }
}