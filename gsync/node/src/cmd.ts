import * as path from "path";
import { isUtf8Text, Repo, sameExceptCRLF, stripCR } from "./git.js";
import { GIT_DIR_NAME, Sync, SyncFactory } from "./sync.js";
import { APIConfig, asBranchName, asFilePath, asHash, asLocalRef, Author, BranchName, FilePath, Hash, PathInRepo, SyncStatus, Conflicted, CloneOptions, ConflictResolutionPolicy, CommitEntry, isHash } from "./types.js";
import { promises as fs } from "fs";
import { factory as offlineObjectStoreFactory } from "./objects.js";
import { getSplashScreen } from "./splash.js";
import { GSYNC_CONFLICT_DIR } from "./constants.js";
import { exists, join } from "./util.js";
//import * as difflib from "difflib";
import { diffLines } from "diff";
import { merge3 } from "./merge3.js";

const splashScreen = await getSplashScreen();
let verbose = false;

export async function main(cwd = process.cwd(), argv = process.argv): Promise<any> {
    const cli = new Cli(cwd);
    try {
        // 1st command line arg is either clone commit sync
        // call corresponding function
        const [,, command, ...args] = argv;
        switch (command) {
            case "clone":
            case "clone_overwrite":
            case "clone_nocheckout":
                if (args.length < 2) {
                    console.log(argv.join(" ") + " <serverUrl> <repoId> [<branch-or-commitHash>]");
                    return;
                }
                const b = args[2] || "main";
                if (command === "clone") {
                    return await cli.clone(cwd, args[0], args[1], b);
                } else if (command === "clone_nocheckout") {
                    return await cli.clone(cwd, args[0], args[1], b, { gitDirName: GIT_DIR_NAME, allowNonEmpty: "skipCheckout" });
                } else {
                    return await cli.clone(cwd, args[0], args[1], b, { gitDirName: GIT_DIR_NAME, allowNonEmpty: "overwrite" });
                }
            case "init":
                if (args.length < 1) {
                    console.log(argv.join(" ") + " <serverUrl>");
                    return;
                }
                return await cli.init(args[0], GIT_DIR_NAME);
            case "commit":
                return await cli.commit();
            case "sync":
            case undefined:
                return await cli.syncWithRetry("saveHashedRemote");
            case "newer":
                return await cli.syncWithRetry("newer");
            case "log":
                return await cli.log(!!args[0]);
            case "cat-file":
                return await cli.catFile(args[0]);
            //case "download-objects":
            //    return await cli.downloadObjects(args.includes("-a")?"all":"max_mtime");
            case "manage":
                return await cli.manage();
            case "share":
                return cli.share();
            case "scan":
                return await cli.scan(
                    args.includes("--id"),
                    args.includes("--url"),
                    args.includes("--key"),
                    args.includes("--shell"),
                );
            case "switch":
            case "checkout":
                {
                    if (args.length === 0) {
                        return await cli.listBranches();
                    }
                    let create = false;
                    let force = false;
                    let targetBranch = "";
                    for (let i = 0; i < args.length; i++) {
                        const arg = args[i];
                        if (arg === "-c" || arg === "--create") {
                            create = true;
                        } else if (arg === "-f" || arg === "--force") {
                            force = true;
                        } else if (typeof arg === "object") {
                            // acepad shell interprets -c as {c:true}
                            const a = arg as any;
                            if (a.c || a.create) {
                                create = true;
                            }
                            if (a.f || a.force) {
                                force = true;
                            }
                        } else if (arg.startsWith("-")) {
                            throw new Error(`Unknown option: ${arg}`);
                        } else {
                            targetBranch = arg;
                        }
                    }
                    if (!targetBranch) {
                        console.log("Usage: gsync switch <branch> [-c] [-f]");
                        throw new Error("No branch specified.");
                    }
                    return await cli.switchBranch(targetBranch, { create, force });
                }
            case "branch":
                return await cli.listBranches();
            case "msync":
                {
                    if (args.length < 1) {
                        console.log("Usage: gsync msync <branch>");
                        return;
                    }
                    return await cli.msync(args[0]);
                }
            case "merge":
                {
                    if (args.length < 1) {
                        console.log("Usage: gsync merge <branch>");
                        return;
                    }
                    return await cli.mergeBranch(args[0]);
                }
            case "reset_hard":
                {
                    // Reset working tree and local branch to remote latest commit. Branch optional.
                    const targetBranch = args.length > 0 && args[0] ? args[0] : undefined;
                    return await cli.resetHard(targetBranch);
                }
            case "diff":
                return await cli.diffCmd(args);
            default:
                throw new Error(`Unknown command: ${command}`);
        }
    } finally {
        await splashScreen.hide();
    }
}
export class Cli {
cwd: string;
constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
}


async resetHard(targetBranch: string | undefined) {
    const gitDir = await this.findGitDir();
    const syncf = new SyncFactory(gitDir);
    const sync = await syncf.load();
    const repo = sync.repo;
    const branch = targetBranch ? asBranchName(targetBranch) : await repo.getCurrentBranchName();

    const remoteHead = await sync.getRemoteHead(branch);
    if (!remoteHead) throw new Error(`No remote HEAD for branch '${branch}'`);

    const localRef = asLocalRef(branch);
    const localCommitHash = await repo.readHead(localRef);
    const remoteCommit = await repo.readCommit(remoteHead);
    const remoteTree = await repo.readTree(remoteCommit.tree);

    if (localCommitHash) {
        const localCommit = await repo.readCommit(localCommitHash);
        const localTree = await repo.readTree(localCommit.tree);
        const diff = await repo.diffTreeRecursive(localTree, remoteTree);
        await repo.applyDiff(diff);
    } else {
        await repo.checkoutTreeToDir(remoteCommit.tree, repo.workingDir());
    }

    // clear merge state and set local ref to remote
    await repo.writeMergeHead();
    await repo.updateHead(localRef, remoteHead);
    console.log(`Reset '${branch}' to remote ${remoteHead}`);
    return;
}

async scan(showRepo: boolean, showUrl: boolean, showKey: boolean, shell: boolean) {
    const name = GIT_DIR_NAME;
    // scan recursively *cwd* and list folder named *name*
    const scanDir = async (dir: FilePath): Promise<FilePath[]> => {
        let results: FilePath[] = [];
        const files = await fs.readdir(dir);
        for (let f of files) {
            const fullpath = join(dir, f);
            if ((await fs.stat(fullpath)).isDirectory()) {
                if (f === name) {
                    results.push(dir);
                } else {
                    results = results.concat(await scanDir(fullpath));
                }
            }
        }
        return results;
    };
    for (let d of await scanDir(asFilePath(this.cwd))) {
        if (shell) {
            console.log("cd", d, ";gsync");
            continue;
        }
        const field: string[] = [d];
        if (showKey || showRepo || showUrl) {
            const gitDir = join(d, GIT_DIR_NAME);
            const syncf = new SyncFactory(gitDir);
            const conf = await syncf.readConfig();
            if (showUrl) field.push(conf.serverUrl);
            if (showRepo) field.push(conf.repoId);
            if (showKey) field.push(conf.apiKey);
        }
        console.log(...field);
    }
}

async share(gitDirName: string = GIT_DIR_NAME) {
    const dir = path.join(this.cwd, gitDirName);
    const gitDir = asFilePath(dir);
    const syncf = new SyncFactory(gitDir);
    const conf = await syncf.readConfig();
    console.log("gsync clone " + conf.serverUrl + " " + conf.repoId);
}

async manage(gitDirName: string = GIT_DIR_NAME) {
    const dir = path.join(this.cwd, gitDirName);
    const gitDir = asFilePath(dir);
    const syncf = new SyncFactory(gitDir);
    const conf = await syncf.readConfig();
    const repoId = conf.repoId;
    const url = conf.serverUrl;
    const manage =
        url.match(/\w+.php$/) ?
            url.replace(/\w+.php$/, "manage.php") :
            url + "manage.php";
    console.log(`Open ${manage}?repo=${repoId}`);
}
async offlineRepo(gitDir: FilePath): Promise<Repo> {
    const objectStore = await offlineObjectStoreFactory(gitDir);
    return new Repo(gitDir, objectStore);
}

async msync(branchName: string): Promise<SyncStatus> {
    const r1 = await this.syncWithRetry("saveHashedRemote");
    if (Array.isArray(r1)) throw new Error(`Conflict after sync: ${r1.join(", ")}`);
    console.log("sync1:", r1);
    const r2 = await this.mergeBranch(branchName);
    if (Array.isArray(r2)) throw new Error(`Conflict during merge: ${r2.join(", ")}`);
    console.log("merge:", r2);
    const r3 = await this.syncWithRetry("saveHashedRemote");
    if (Array.isArray(r3)) throw new Error(`Conflict after sync: ${r3.join(", ")}`);
    console.log("sync2:", r3);
    return r3;
}

async catFile(hash: string) {
    const gitDir = await this.findGitDir();
    const repo = await this.offlineRepo(gitDir);
    const obj = await repo.readObject(asHash(hash));
    if (!obj) {
        console.log("No such object: ", hash);
        return;
    }
    console.log("Type: ", obj.type);
    console.log("Content: ");
    console.log(obj.content.toString());
}

async init(serverUrl: string, gitDirName: string = GIT_DIR_NAME) {
    const dir = path.join(this.cwd, gitDirName);
    if (!serverUrl.endsWith(".php") && !serverUrl.endsWith("/")) {
        console.warn(`WARNING! ${serverUrl} should be ends with .php or / `);
    }
    const gitDir = asFilePath(dir);
    const syncf = new SyncFactory(gitDir);
    const sync = await syncf.init(serverUrl);
    const repoId = sync.webapi.config.repoId;
    console.log("Initialized new repository with id: ", repoId);
    const repo = sync.repo;
    await repo.setCurrentBranchName(asBranchName("main"));
    return repoId;
}

async clone(into: string, serverUrl: string, repoId: string, branch = "main", options: CloneOptions = { gitDirName: GIT_DIR_NAME }): Promise<Sync> {
    return await this._clone(asFilePath(into), { serverUrl, repoId, apiKey: Math.random().toString(36).slice(2) }, asBranchName(branch), options);
}

private async _clone(into: FilePath, config: APIConfig, branch: BranchName, options: CloneOptions): Promise<Sync> {
    let skipco;
    if (await exists(into) && (await fs.readdir(into)).length > 0) {
        if (!options.allowNonEmpty) throw new Error(`${into} is not empty.`);
        skipco = (options.allowNonEmpty === "skipCheckout");
    }
    console.log(`Cloning into ${into}...`);
    await fs.mkdir(into, { recursive: true });
    const newGitDir = asFilePath(path.join(into, options.gitDirName));
    await fs.mkdir(newGitDir, { recursive: true });
    const newSyncf = new SyncFactory(newGitDir);
    await newSyncf.writeConfig(config);
    const newSync = await newSyncf.load();

    const repo=newSync.repo;//new Repo(newGitDir);
    //await newSync.downloadObjects();
    let headCommitHash=await newSync.getRemoteHead(branch);
    let detachedHead=false;
    if (!headCommitHash) {
        if (!isHash(branch)) {
            throw new Error("No remote head on "+branch);
        }
        headCommitHash=asHash(branch);
        detachedHead=true;
    }
    if (!detachedHead) await repo.updateHead(asLocalRef(branch), headCommitHash );    
    if (!skipco) {
        const headCommit = await repo.readCommit(headCommitHash);
        await repo.checkoutTreeToDir(headCommit.tree, into);
    }
    if (!detachedHead) await repo.setCurrentBranchName(branch);
    return newSync;
}
async findGitDir(): Promise<FilePath> {
    let c = this.cwd;
    while (true) {
        const res = asFilePath(path.join(c, GIT_DIR_NAME));
        if (await exists(res)) return res;
        const nc = path.dirname(c);
        if (!nc || nc === c) throw new Error(`No git repo found from ${this.cwd}`);
        c = nc;
    }
}

async commit(message?: string): Promise<Hash> {
    const gitDir = await this.findGitDir();
    // even commit is failed unless online 
    const syncf = new SyncFactory(gitDir);
    const sync = await syncf.load();
    const saveIndexFile = sync.objectStore.useIndexFile();
    const repo = sync.repo;
    if (!await exists(repo.headPath())) {
        await repo.setCurrentBranchName(asBranchName("main"));
    }
    const branch = await repo.getCurrentBranchName();
    const ref = asLocalRef(branch);
    const curCommitHash = await repo.readHead(ref);
    if (verbose) console.log("curCommitHash", curCommitHash);
    // even commit is failed unless online 
    const curCommit = curCommitHash ? await repo.readCommit(curCommitHash) : null;
    let newCommitTreeHash;
    if (saveIndexFile) {
        const indexPath = asFilePath(path.join(repo.gitDir, "index"));
        const index = await repo.updateIndexFromWorkingDir(indexPath);
        newCommitTreeHash = await repo.writeTreeFromIndex(index);
    } else {
        const tree = await repo.buildTreeFromWorkingDir();
        newCommitTreeHash = await repo.writeTree(tree);
    }
    if (verbose) console.log("newCommitTreeHash", newCommitTreeHash);
    const MERGE_HEAD = await repo.readMergeHead();
    if (!MERGE_HEAD && curCommit && curCommit.tree === newCommitTreeHash) {
        console.log(branch, ": Nothing changed");
        return curCommitHash!;
    }
    let isMobile: RegExpMatchArray | null = null;
    try {
        isMobile = navigator.userAgent.match(/iphone|android/i);
    } catch (e) {
    }
    const author = new Author(isMobile ? isMobile + "" : "pc", "test@example.com");
    const newCommitHash = await repo.writeCommit({
        author,
        committer: author,
        parents: [...curCommitHash ? [curCommitHash] : [], ...MERGE_HEAD ? [MERGE_HEAD] : []],
        message: message || new Date() + "",
        tree: newCommitTreeHash
    });
    if (MERGE_HEAD) await repo.writeMergeHead();
    if (verbose) console.log("New commit for", branch, ": ", newCommitHash);
    await repo.updateHead(ref, newCommitHash);
    return newCommitHash;
}

async syncWithRetry(conflictResolutionPolicy: ConflictResolutionPolicy): Promise<SyncStatus> {
    const res = [];
    for (let i = 0; i < 5; i++) {
        let r = await this.sync(conflictResolutionPolicy);
        res.push(r);
        if (r !== "auto_merged") {
            // auto_merged->pushed
            if (res.includes("auto_merged")) return "auto_merged";
            else return r;
        }
    }
    throw new Error("Auto-merge repeated 5 times. Aborted.");
}
/*async downloadObjects(ignoreState:IgnoreState) {
    const gitDir = await this.findGitDir();
    const sync = new Sync(gitDir);
    await sync.downloadObjects(ignoreState);
}*/
async sync(conflictResolutionPolicy: ConflictResolutionPolicy = "saveHashedRemote", message = new Date() + ""): Promise<SyncStatus> {
    const gitDir = await this.findGitDir();
    const syncf = new SyncFactory(gitDir);
    const sync = await syncf.load();
    const repo = sync.repo;
    const branch = await repo.getCurrentBranchName();
    //splashScreen.show("Check remote");
    await splashScreen.show("Commit");
    const [localCommitHash, remoteCommitHash] = await Promise.all([
        this.commit(message),
        sync.getRemoteHead(branch),
    ]);
    if (!remoteCommitHash) {
        // push to remote(new)
        await splashScreen.show("Upload objects");
        await sync.uploadObjects();
        if (verbose) console.log("Push ", branch, " into ", localCommitHash);
        await sync.addRemoteHead(branch, localCommitHash);
        return "newly_pushed";
    }
    const baseCommitHash = await repo.findMergeBase(localCommitHash, remoteCommitHash);
    if (remoteCommitHash === baseCommitHash) {
        // update remote
        if (localCommitHash === remoteCommitHash) {
            console.log("Remote is up-to-date: ", localCommitHash);
            return "no_changes";
        }
        await splashScreen.show("Upload objects");
        await sync.uploadObjects();
        if (verbose) console.log("Push into remote: ", remoteCommitHash, " to ", localCommitHash);
        await sync.setRemoteHead(branch, remoteCommitHash, localCommitHash);
        return "pushed";
    }
    const localCommit = await repo.readCommit(localCommitHash);
    const remoteCommit = await repo.readCommit(remoteCommitHash);
    const remoteCommitTime = remoteCommit.author.date;
    const localTree = await repo.readTree(localCommit.tree);
    const remoteTree = await repo.readTree(remoteCommit.tree);
    if (localCommitHash === baseCommitHash) {
        // update local
        const diff = await repo.diffTreeRecursive(localTree, remoteTree);
        await repo.applyDiff(diff);
        await repo.updateHead(asLocalRef(branch), remoteCommitHash);
        console.log("Update local branch", localCommitHash, "to", remoteCommitHash);
        return "pulled";
    }
    const baseCommit = await repo.readCommit(baseCommitHash);
    const baseTree = await repo.readTree(baseCommit.tree);
    const { toA, toB, conflicts } = await repo.threeWayMerge(baseTree, localTree, remoteTree);
    await repo.writeMergeHead(remoteCommitHash);
    await repo.applyDiff(toA);
    if (conflicts.length == 0) {
        console.log("Auto-Merged from ", remoteCommitHash);
        const mergedCommitHash = await this.commit();
        if (verbose) console.log("Merged commit hash: ", mergedCommitHash);
        if (verbose) console.log("Run sync again to push merged commit");
        return "auto_merged";
    } else {
        let confpaths: Conflicted = [];
        for (let c of conflicts) {
            const remoteObj = await repo.readObject(c.b);
            const localPath = repo.toFilePath(c.path);
            const localContent = await fs.readFile(localPath);
            const baseContent = c.base ? (await repo.readObject(c.base)).content : Buffer.from([]);
            if (!sameExceptCRLF(localContent, remoteObj.content)) {
                const winner =
                    conflictResolutionPolicy === "ignoreLocal" ? "remote" :
                        conflictResolutionPolicy === "ignoreRemote" ? "local" :
                            conflictResolutionPolicy === "newer" ?
                                (remoteCommitTime.getTime() >
                                    (await fs.stat(localPath)).mtime.getTime() ? "remote" : "local") :
                                null;
                if (winner === null) {
                    //TODO: same as mergeBranch
                    const baseContent_str = isUtf8Text(stripCR(baseContent));
                    const localContent_str = isUtf8Text(stripCR(localContent));
                    const remoteContent_str = isUtf8Text(stripCR(remoteObj.content));
                    const [merged, hasConflict] =
                        baseContent_str && localContent_str && remoteContent_str ?
                            merge3(baseContent_str, localContent_str, remoteContent_str) :
                            ["", true];
                    if (hasConflict) {
                        const postfix = `(${remoteCommitHash.substring(0, 8)})`;
                        const postfixedPath = await this.conflictedFile(repo, localPath, postfix);
                        confpaths.push(repo.toPathInRepo(postfixedPath));
                        if (confpaths.length == 1) console.log("CONFLICT");
                        console.log(`Conflict saved at ${postfixedPath}`);
                        await fs.mkdir(path.dirname(postfixedPath), { recursive: true });
                        await fs.writeFile(postfixedPath, remoteObj.content);
                        if (merged.length > 0) {
                            const postfix = `(merge-${remoteCommitHash.substring(0, 8)})`;
                            const postfixedPath = await this.conflictedFile(repo, localPath, postfix);
                            console.log(`Conflict-merged saved at ${postfixedPath}`);
                            await fs.writeFile(postfixedPath, merged);
                        }
                    } else {
                        await fs.writeFile(localPath, merged);
                    }
                } else if (winner === "remote") {
                    console.log(`Overwrite ${localPath}`);
                    await fs.writeFile(localPath, remoteObj.content);
                } else {
                    console.log(`Skip ${localPath}`);
                }
            }
        }
        if (confpaths.length > 0) {
            console.log("Resolve conflicts and run sync again");
            return confpaths;
        } else {
            console.log("Auto-Merged from ", remoteCommitHash);
            const mergedCommitHash = await this.commit();
            if (verbose) console.log("Merged commit hash: ", mergedCommitHash);
            if (verbose) console.log("Run sync again to push merged commit");
            return "auto_merged";
        }
    }
}
static makePostfix<T extends string>(filepath: T, postfix: string): T {
    // ex: filepath = "/a/b/test.txt"  postfix = "(1)"
    //       returns "/a/b/test(1).txt"
    //     filepath may either absolute or relative path
    const ext = path.extname(filepath);
    const basename = path.basename(filepath, ext);
    const dirname = path.dirname(filepath);
    const newBasename = `${basename}${postfix}${ext}`;
    return path.join(dirname, newBasename) as T;
}
private async conflictedFile(repo: Repo, filePath: FilePath, postfix: string): Promise<FilePath> {
    const work = repo.workingDir();
    if (!await exists(join(work, GSYNC_CONFLICT_DIR))) {
        return Cli.makePostfix(filePath, postfix);
    }
    const rel = path.relative(work, filePath);
    if (rel.startsWith("..")) throw new Error(`${filePath} is out of ${work}`);
    const dst = Cli.makePostfix(path.join(work, GSYNC_CONFLICT_DIR, rel) as FilePath, postfix);
    return dst;
}

async log(check_ref = false) {
    const gitDir = await this.findGitDir();
    const repo = await this.offlineRepo(gitDir);
    const b = await repo.getCurrentBranchName();
    let ch = await repo.readHead(asLocalRef(b));
    if (!ch) return;
    let c = await repo.readCommit(ch);
    while (c) {
        console.log(ch, c.message);
        if (check_ref) console.log("Scanned objects: ", await Cli.checkRef(repo, ch));
        let next: CommitEntry | undefined;
        for (let canh of c.parents) {
            try {
                const can = await repo.readCommit(canh);
                if (!next || can.author.date.getTime() > next.author.date.getTime()) {
                    next = can;
                    ch = canh;
                }
            } catch (e) {
                console.error(e);
            }
        }
        c = next!;
        //if (c.parents[1]) console.log("Skipped merge commit: ",c.parents[1]);
    }
}

static async checkRef(repo: Repo, chash: Hash): Promise<number> {
    const obj = await repo.readCommit(chash);
    return await tree(obj.tree);
    async function tree(hash: Hash, _path = "./"): Promise<number> {
        let c = 0;
        try {
            const treeo = await repo.readTree(hash);
            for (let entry of treeo) {
                if (entry.mode === '40000') {
                    // dir
                    c += await tree(entry.hash, path.join(_path, entry.name));
                } else {
                    const blob = await repo.readObject(entry.hash);
                    c++;
                }
            }
        } catch (e) {
            console.error("Missing " + chash + " " + _path);
        }
        return c;
    }
}

async listBranches() {
    const gitDir = await this.findGitDir();
    const repo = await this.offlineRepo(gitDir);
    const currentBranch = await repo.getCurrentBranchName();
    const branches = await repo.getBranches();
    for (const branch of branches) {
        if (branch === currentBranch) {
            console.log(`* ${branch}`);
        } else {
            console.log(`  ${branch}`);
        }
    }
}

async switchBranch(branchName: string, options: { create?: boolean, force?: boolean } = {}) {
    const gitDir = await this.findGitDir();
    const syncf = new SyncFactory(gitDir);
    const sync = await syncf.load();
    const repo = sync.repo;
    const currentBranch = await repo.getCurrentBranchName();
    if (currentBranch === branchName && !options.create) {
        console.log(`Already on '${branchName}'`);
        return;
    }
    const branches = await repo.getBranches();
    const branchExists = branches.includes(asBranchName(branchName));
    if (options.create) {
        if (branchExists && !options.force) {
            throw new Error(`Branch '${branchName}' already exists.`);
        }
        const remoteBranchCommit = await sync.getRemoteHead(asBranchName(branchName));
        if (remoteBranchCommit) {
            throw new Error(`Branch '${branchName}' exists on remote. Cannot create with -c option.`);
        }
        const currentRef = asLocalRef(currentBranch);
        const currentCommitHash = await repo.readHead(currentRef);
        if (!currentCommitHash) {
            throw new Error(`Cannot create branch '${branchName}' because current branch has no commits.`);
        }
        await repo.updateHead(asLocalRef(asBranchName(branchName)), currentCommitHash);
        console.log(`Created branch '${branchName}'`);
    } else {
        if (!branchExists) {
            const remoteBranchCommit = await sync.getRemoteHead(asBranchName(branchName));
            if (remoteBranchCommit) {
                await repo.updateHead(asLocalRef(asBranchName(branchName)), remoteBranchCommit);
                console.log(`Fetched remote branch '${branchName}'`);
            } else {
                throw new Error(`Branch '${branchName}' does not exist locally or on remote.`);
            }
        }
    }
    if (!options.force) {
        const hasChanges = await repo.hasUncommittedChanges();
        if (hasChanges) {
            throw new Error(`You have uncommitted changes. Please commit or stash them before switching branches, or use -f to force switch.`);
        }
    }
    const currentRef = asLocalRef(currentBranch);
    const targetRef = asLocalRef(asBranchName(branchName));
    const currentCommitHash = await repo.readHead(currentRef);
    const targetCommitHash = await repo.readHead(targetRef);
    if (targetCommitHash) {
        const targetCommit = await repo.readCommit(targetCommitHash);
        const targetTree = await repo.readTree(targetCommit.tree);

        if (currentCommitHash) {
            const currentCommit = await repo.readCommit(currentCommitHash);
            const currentTree = await repo.readTree(currentCommit.tree);
            const diff = await repo.diffTreeRecursive(currentTree, targetTree);
            await repo.applyDiff(diff);
        } else {
            await repo.checkoutTreeToDir(targetCommit.tree, repo.workingDir());
        }
    }

    await repo.setCurrentBranchName(asBranchName(branchName));
    console.log(`Switched to branch '${branchName}'`);
}

async mergeBranch(sourceBranchName: string): Promise<string | Conflicted> {
    const gitDir = await this.findGitDir();
    const syncf = new SyncFactory(gitDir);
    const sync = await syncf.load();
    const repo = sync.repo;

    const currentBranch = await repo.getCurrentBranchName();
    if (currentBranch === sourceBranchName) {
        throw new Error(`Cannot merge branch '${sourceBranchName}' into itself.`);
    }

    const currentRef = asLocalRef(currentBranch);
    const currentCommitHash = await repo.readHead(currentRef);
    const sourceRef = asLocalRef(asBranchName(sourceBranchName));
    const localSourceCommitHash = await repo.readHead(sourceRef);
    const remoteSourceCommitHash = await sync.getRemoteHead(asBranchName(sourceBranchName));
    if (!currentCommitHash) {
        throw new Error(`Current branch '${currentBranch}' has no commits.`);
    }
    let sourceCommitHash: Hash | null = localSourceCommitHash || remoteSourceCommitHash;
    if (!sourceCommitHash) {
        throw new Error(`Source branch '${sourceBranchName}' has no commits locally or on remote.`);
    }
    if (localSourceCommitHash && remoteSourceCommitHash && localSourceCommitHash !== remoteSourceCommitHash) {
        const mergeBase = await repo.findMergeBase(localSourceCommitHash, remoteSourceCommitHash);
        if (mergeBase === localSourceCommitHash) {
            console.log(`Local '${sourceBranchName}' is behind remote. Using remote version.`);
            sourceCommitHash = remoteSourceCommitHash;
            await repo.updateHead(sourceRef, remoteSourceCommitHash);
        } else if (mergeBase === remoteSourceCommitHash) {
            console.log(`Remote '${sourceBranchName}' is behind local. Using local version.`);
            sourceCommitHash = localSourceCommitHash;
        } else {
            throw new Error(`Source branch '${sourceBranchName}' has diverged between local and remote. Cannot auto-merge. Resolve manually or update one side.`);
        }
    }
    const hasChanges = await repo.hasUncommittedChanges();
    if (hasChanges) {
        throw new Error(`You have uncommitted changes. Please commit or stash them before merging.`);
    }
    const baseCommitHash = await repo.findMergeBase(currentCommitHash, sourceCommitHash);
    if (sourceCommitHash === baseCommitHash) {
        console.log(`Already up-to-date.`);
        return "no_changes";
    }

    const currentCommit = await repo.readCommit(currentCommitHash);
    const sourceCommit = await repo.readCommit(sourceCommitHash);
    const currentTree = await repo.readTree(currentCommit.tree);
    const sourceTree = await repo.readTree(sourceCommit.tree);

    if (currentCommitHash === baseCommitHash) {
        const diff = await repo.diffTreeRecursive(currentTree, sourceTree);
        await repo.applyDiff(diff);
        await repo.updateHead(currentRef, sourceCommitHash);
        console.log(`Fast-forward: merged branch '${sourceBranchName}' into '${currentBranch}'`);
        return "pulled";
    }

    const baseCommit = await repo.readCommit(baseCommitHash);
    const baseTree = await repo.readTree(baseCommit.tree);

    const { toA, conflicts } = await repo.threeWayMerge(baseTree, currentTree, sourceTree);

    await repo.writeMergeHead(sourceCommitHash);
    await repo.applyDiff(toA);

    if (conflicts.length === 0) {
        console.log(`Auto-merging branch '${sourceBranchName}'`);
        const mergedCommitHash = await this.commit(`Merge branch '${sourceBranchName}' into '${currentBranch}'`);
        console.log(`Merge commit created: ${mergedCommitHash}`);
        return "auto_merged";
    } else {
        let confpaths: Conflicted = [];
        for (let c of conflicts) {
            const sourceObj = await repo.readObject(c.b);
            const localPath = repo.toFilePath(c.path);
            const localContent = await fs.readFile(localPath);
            const baseContent = c.base ? (await repo.readObject(c.base)).content : Buffer.from([]);
            if (!sameExceptCRLF(localContent, sourceObj.content)) {
                //TODO: same as sync
                const baseContent_str = isUtf8Text(stripCR(baseContent));
                const localContent_str = isUtf8Text(stripCR(localContent));
                const sourceContent_str = isUtf8Text(stripCR(sourceObj.content));
                const [merged, hasConflict] =
                    baseContent_str && localContent_str && sourceContent_str ?
                        merge3(baseContent_str, localContent_str, sourceContent_str) :
                        ["", true];
                if (hasConflict) {
                    const postfix = `(${sourceCommitHash.substring(0, 8)})`;
                    const postfixedPath = await this.conflictedFile(repo, localPath, postfix);
                    confpaths.push(repo.toPathInRepo(postfixedPath));
                    if (confpaths.length === 1) console.log("CONFLICT");
                    console.log(`Conflict saved at ${postfixedPath}`);
                    await fs.mkdir(path.dirname(postfixedPath), { recursive: true });
                    await fs.writeFile(postfixedPath, sourceObj.content);
                    if (merged.length > 0) {
                        const postfix = `(merge-${sourceCommitHash.substring(0, 8)})`;
                        const postfixedPath = await this.conflictedFile(repo, localPath, postfix);
                        console.log(`Conflict-merged saved at ${postfixedPath}`);
                        await fs.writeFile(postfixedPath, merged);
                    }
                } else {
                    await fs.writeFile(localPath, merged);
                }
            }
        }
        if (confpaths.length > 0) {
            console.log("Resolve conflicts and run commit to complete the merge.");
            return confpaths;
        } else {
            console.log(`Auto-merging branch '${sourceBranchName}'`);
            const mergedCommitHash = await this.commit(`Merge branch '${sourceBranchName}' into '${currentBranch}'`);
            console.log(`Merge commit created: ${mergedCommitHash}`);
            return "auto_merged";
        }
    }
}

async diffCmd(args: string[]): Promise<void> {
    const verbose = args.includes("--verbose") || args.includes("-v");

    const gitDir = await this.findGitDir();
    const syncf = new SyncFactory(gitDir);
    const sync = await syncf.load();
    const repo = sync.repo;

    const branch = await repo.getCurrentBranchName();
    const localRef = asLocalRef(branch);
    const commitHash = await repo.readHead(localRef);

    if (!commitHash) {
        console.log("No commits yet.");
        return;
    }

    const commit = await repo.readCommit(commitHash);
    const commitTree = await repo.readTree(commit.tree);
    const workingTree = await repo.buildTreeFromWorkingDir();

    const diffs = await repo.diffTreeRecursive(commitTree, workingTree);

    if (diffs.length === 0) {
        console.log("No changes.");
        return;
    }

    console.log(`Changes between HEAD (${commitHash.substring(0, 8)}) and working directory:`);
    console.log("");

    for (const diff of diffs) {
        const status = diff.type === "deleted" ? "deleted" : (diff.type === "added" ? "new file" : "modified");
        const path = diff.path;
        console.log(`${status.padEnd(11)} ${path}`);

        if (verbose) {
            if (diff.type === "modified") {
                const oldText = await repo.readBlobAsText(diff.oldHash);
                const newPath = repo.toFilePath(diff.path);
                const newText = await fs.readFile(newPath, "utf-8");
                showLineDiff(path, oldText, newText);
            } else if (diff.type === "added") {
                const newPath = repo.toFilePath(diff.path);
                const newText = await fs.readFile(newPath, "utf-8");
                showLines(path, newText, "+");
            } else if (diff.type === "deleted") {
                const oldText = await repo.readBlobAsText(diff.oldHash);
                showLines(path, oldText, "-");
            }
        }
    }
}
}


export function scan(cwd: string, showRepo: boolean, showUrl: boolean, showKey: boolean, shell: boolean) {
    return new Cli(cwd).scan(showRepo, showUrl, showKey, shell);
}
export function share(cwd: string, gitDirName: string = GIT_DIR_NAME) {
    return new Cli(cwd).share(gitDirName);
}
export function manage(cwd: string, gitDirName: string = GIT_DIR_NAME) {
    return new Cli(cwd).manage(gitDirName);
}
export function msync(dir: string, branchName: string) {
    return new Cli(dir).msync(branchName);
}
export function catFile(dir: string, hash: string) {
    return new Cli(dir).catFile(hash);
}
export function init(cwd: string, serverUrl: string, gitDirName: string = GIT_DIR_NAME) {
    return new Cli(cwd).init(serverUrl, gitDirName);
}
export function clone(into: string, serverUrl: string, repoId: string, branch?: string, options?: CloneOptions) {
    return new Cli(into).clone(into, serverUrl, repoId, branch, options);
}
export function findGitDir(cwd: FilePath) {
    return new Cli(cwd).findGitDir();
}
export function commit(dir: string, message?: string) {
    return new Cli(dir).commit(message);
}
export function syncWithRetry(dir: string, conflictResolutionPolicy: ConflictResolutionPolicy): Promise<SyncStatus> {
    return new Cli(dir).syncWithRetry(conflictResolutionPolicy);
}
export function sync(dir: string, conflictResolutionPolicy?: ConflictResolutionPolicy, message?: string): Promise<SyncStatus> {
    return new Cli(dir).sync(conflictResolutionPolicy, message);
}
export function log(dir: string, check_ref: boolean = false) {
    return new Cli(dir).log(check_ref);
}
export function checkRef(repo: Repo, chash: Hash) {
    return Cli.checkRef(repo, chash);
}
export function cmdListBranches(dir: string) {
    return new Cli(dir).listBranches();
}
export function switchBranch(dir: string, branchName: string, options: { create?: boolean, force?: boolean } = {}) {
    return new Cli(dir).switchBranch(branchName, options);
}
export function mergeBranch(dir: string, sourceBranchName: string) {
    return new Cli(dir).mergeBranch(sourceBranchName);
}
export function diffCmd(dir: string, args: string[]) {
    return new Cli(dir).diffCmd(args);
}

function showLineDiff(
    path: PathInRepo,
    oldText: string,
    newText: string
): void {
    const changes = diffLines(oldText, newText);
    let changed = false;

    for (const change of changes) {
        if (!change.added && !change.removed) continue;
        if (!changed) {
            console.log(`  @@ ${path} @@`);
            changed = true;
        }

        const lines = change.value.split("\n");

        // diffLines() は末尾の改行を含む場合、
        // split() の結果の最後に "" が入るので除去する
        if (lines.length > 0 && lines[lines.length - 1] === "") {
            lines.pop();
        }

        if (change.removed) {
            for (const line of lines) {
                console.log(`  -${line}`);
            }
        } else if (change.added) {
            for (const line of lines) {
                console.log(`  +${line}`);
            }
        }
    }
}/*
function showLineDiff(path: PathInRepo, oldText: string, newText: string): void {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    if (oldLines.length > 0 && oldLines[oldLines.length - 1] === "") oldLines.pop();
    if (newLines.length > 0 && newLines[newLines.length - 1] === "") newLines.pop();
    const s = new difflib.SequenceMatcher(null, oldLines, newLines);
    const opcodes = s.getOpcodes();
    let changed = false;
    for (const [tag, i1, i2, j1, j2] of opcodes) {
        if (tag === "equal") continue;
        if (!changed) {
            console.log(`  @@ ${path} @@`);
            changed = true;
        }
        if (tag === "replace" || tag === "delete") {
            for (let i = i1; i < i2; i++) {
                console.log(`  -${oldLines[i]}`);
            }
        }
        if (tag === "replace" || tag === "insert") {
            for (let j = j1; j < j2; j++) {
                console.log(`  +${newLines[j]}`);
            }
        }
    }
}*/

function showLines(path: PathInRepo, text: string, prefix: string): void {
    const lines = text.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    for (const line of lines) {
        console.log(`  ${prefix}${line}`);
    }
}