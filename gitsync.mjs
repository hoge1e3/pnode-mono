import { execSync } from "child_process";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
function runGitCommand(cmd, repoPath) {
    return execSync(cmd, { cwd: repoPath, encoding: "utf8" }).trim();
}

async function checkRepoStatus(repoPath) {
    //git log -1 --pretty=%B
    const status = runGitCommand("git status --porcelain", repoPath);
    if (status) {
        console.log(repoPath, "未ステージまたは未コミットの変更があります。状況:");
        console.log(runGitCommand("git status", repoPath));
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        await new Promise((callback)=>{
            rl.question("これらをコミットしてもよろしいですか？ (nで中止、forceでリモートで上書き、それ以外でコミット): ", (answer) => {
                if (answer.trim().toLowerCase() === "n") {
                    console.log("処理を中止しました。");
                    rl.close();
                    process.exit(1);
                } else if (answer.trim().toLowerCase() === "force") {
                    runGitCommand(`git fetch `, repoPath);
                    const branch=runGitCommand(`git branch --show-current`, repoPath);
                    runGitCommand(`git reset --hard origin/${branch}`, repoPath);
                    runGitCommand(`git clean -fd`, repoPath);
                    console.log("リモートの内容で上書きしました:", branch);
                    rl.close();
                    callback();
                } else {
                    const msg=answer.trim();
                    runGitCommand(`git commit -a -m "${msg}"`, repoPath);
                    console.log("変更をコミットしました。");
                    rl.close();
                    callback();
                }
            });
        });
        /*console.log(repoPath,"未ステージまたは未コミットの変更があります。");
        process.exit(1);*/
    }
}

function checkRemoteUpdates(repoPath) {
    runGitCommand("git fetch", repoPath);
    const localAhead = runGitCommand("git rev-list --count HEAD @{u}..", repoPath) || "0";
    const remoteAhead = runGitCommand("git rev-list --count @{u} HEAD..", repoPath) || "0";
    return { localAhead: parseInt(localAhead, 10), remoteAhead: parseInt(remoteAhead, 10) };
}

async function syncRepo(repoPath) {
    await checkRepoStatus(repoPath);
    const { localAhead, remoteAhead } = checkRemoteUpdates(repoPath);

    if (localAhead > 0 && remoteAhead > 0) {
        console.log(repoPath, "ローカルにpushするものがあり、リモートにも更新があります。手動で解決してください。");
        process.exit(1);
    } else if (localAhead > 0) {
        console.log(repoPath, "ローカルの変更をリモートにプッシュします。");
        runGitCommand("git push", repoPath);
    } else if (remoteAhead > 0) {
        console.log(repoPath, "リモートの変更をローカルにプルします。");
        runGitCommand("git pull", repoPath);
    } else {
        console.log(repoPath, "リモートとの同期は必要ありません。");
    }
}

const repoPath = process.argv[2];
if (!repoPath) {
    console.error("使用法: node script.js <リポジトリのパス>");
    process.exit(1);
}
if (!fs.existsSync(path.join(repoPath,".git"))) {
    console.log(repoPath, "gitリポジトリがないか、親にあります。スキップします。");
    process.exit(0);
}
syncRepo(repoPath).then(()=>process.exit(0));
