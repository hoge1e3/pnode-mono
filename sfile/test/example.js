import {getNodeFS} from "../src/SFile.js";
async function main() {     
    const FS=await getNodeFS();
    var mydir=FS.get("./mydir/");// directory 
    mydir.mkdir();
    var myfile=mydir.rel("myfile.txt");  // File /mydir/myfile.txt
    myfile.text("my content"); // write file
    console.log(myfile.text()); // read file
    for (let f of mydir.listFiles()) { // list files in mydir
        console.log(f.name());
    }
}
main();