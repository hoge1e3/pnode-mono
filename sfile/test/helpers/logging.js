export const _console = {
    taglist: {
        "metaurl": false,
        "isChildOf": false,
        "Convert Content ": false,
        "Test #": true,
        "Enter": false,
        "lastUpdate": false,
        ".tonyu files in ": false,
        "directories in ": false,
        "files in ": false,
        "hier": false,
        "rel": false,
        "abs": false,
        "k-absk": false,
        "hier, k, path": false,
        "nfsls": false,
        "check same": false,
        "bin dump:": false,
        "ALERT": true,
        "f.getBytes": false,
        "tmp.getBytes": false,
        "bins": false,
        "checkMtime": false,
        "getDirTree-nw": false,
        "text.txt": false,
        "BLOB reading...": false,
        "BLOB read done!": false,
        "buildScrap": false,
        "checkWatch": false,
        "checkSameDir": false,
        getDirTree: false,
        FULLL: false,
    },
    unknownlist: {},
    error: console.error.bind(console),
    log(tag, ...args) {
        if (this.taglist[tag] == null)
            this.unknownlist[tag] = true;
        else if (!this.taglist[tag])
            return;
        console.log(tag, ...args);
    }
};
export const alert = (s) => _console.log("ALERT", s);
//# sourceMappingURL=logging.js.map