import * as fs from "fs";
import * as path from "path";
import * as assert from "assert";
import { Repo } from "../src/git.js";
import { commit, switchBranch, mergeBranch, init, sync, clone } from "../src/cmd.js";
import { asBranchName, asFilePath, asLocalRef } from "../src/types.js";
import { serverUrl } from "./test-settings.js";
import { Sync, SyncFactory } from "../src/sync.js";
const cleanups: (() => any)[] = [];
function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
async function initRepo(dir: string): Promise<Repo> {
  await init(dir, serverUrl);
  // Re-instantiate repo to get fresh instance after init
  const gitDir = asFilePath(path.join(dir, ".gsync"));
  const { factory: offlineObjectStoreFactory } = await import("../src/objects.js");
  const objectStore = await offlineObjectStoreFactory(gitDir);
  const repo = new Repo(gitDir, objectStore);
  return repo;
}
async function cloneRepo(src:Repo, dir:string):Promise<Sync> {
  const syncf=new SyncFactory(src.gitDir);
  const conf=await syncf.readConfig();
  return await clone(dir, serverUrl, conf.repoId); 
}
export async function testBranchSwitchAndMerge() {
  const testdir = path.resolve("./test-repo-temp-branch");
  if (fs.existsSync(testdir)) {
    fs.rmSync(testdir, { recursive: true, force: true });
  }
  fs.mkdirSync(testdir, { recursive: true });
  cleanups.push(() => fs.rmSync(testdir, { recursive: true, force: true }));
  const repoDir = path.join(testdir, "repo");
  const repo = await initRepo(repoDir);
  // Initial files on main
  write(path.join(repoDir, "file1.txt"), "version 1 on main");
  const commit1 = await commit(repoDir, "Initial commit on main");
  // --- Test 1: Branch Creation ---
  // Create and switch to branch1
  await switchBranch(repoDir, "branch1", { create: true });
  const branches = await repo.getBranches();
  assert.ok(branches.includes(asBranchName("branch1")), "branch1 should be created");
  const currentBranch = await repo.getCurrentBranchName();
  assert.equal(currentBranch, "branch1", "should be on branch1");
  // --- Test 2: Commit on branch1 ---
  write(path.join(repoDir, "file2.txt"), "file 2 on branch1");
  write(path.join(repoDir, "file1.txt"), "version 2 on branch1");
  const commit2 = await commit(repoDir, "Commit on branch1");
  // --- Test 3: Uncommitted changes block switch ---
  write(path.join(repoDir, "file3.txt"), "uncommitted file");
  await assert.rejects(
    switchBranch(repoDir, "main"),
    /You have uncommitted changes/
  );
  // Force switch should work
  await switchBranch(repoDir, "main", { force: true });
  assert.equal(await repo.getCurrentBranchName(), "main", "force switch to main should succeed");
  // Clean up file3.txt manually to make working directory clean
  fs.rmSync(path.join(repoDir, "file3.txt"), { force: true });
  // Verify file1.txt content is restored to main's version, and file2.txt is gone
  assert.equal(fs.readFileSync(path.join(repoDir, "file1.txt"), "utf8"), "version 1 on main");
  assert.ok(!fs.existsSync(path.join(repoDir, "file2.txt")), "file2.txt should not exist on main");
  // --- Test 4: Fast-forward Merge ---
  // Merging branch1 into main should be fast-forward
  const mergeStatus1 = await mergeBranch(repoDir, "branch1");
  assert.equal(mergeStatus1, "pulled", "merge branch1 into main should be fast-forward (pulled)");
  assert.equal(fs.readFileSync(path.join(repoDir, "file1.txt"), "utf8"), "version 2 on branch1");
  assert.equal(fs.readFileSync(path.join(repoDir, "file2.txt"), "utf8"), "file 2 on branch1");
  assert.equal(await repo.readHead(asLocalRef(asBranchName("main"))), commit2, "main HEAD should match branch1 HEAD");
  // --- Test 5: Divergent Merge (No Conflicts) ---
  // From main (at commit2), create branch2
  await switchBranch(repoDir, "branch2", { create: true });
  // On branch2, change file1.txt (ensure size change to detect modification within same second)
  write(path.join(repoDir, "file1.txt"), "version 3 on branch2 - modification");
  const commit3 = await commit(repoDir, "Commit on branch2");
  // Switch back to main
  await switchBranch(repoDir, "main");
  // On main, create and commit file4.txt (divergent change)
  write(path.join(repoDir, "file4.txt"), "file 4 on main");
  const commit4 = await commit(repoDir, "Commit on main");
  // Merge branch2 into main (should auto-merge since they modified different files/areas)
  const mergeStatus2 = await mergeBranch(repoDir, "branch2");
  assert.equal(mergeStatus2, "auto_merged", "merge should auto_merge");
  // Verify contents
  assert.equal(fs.readFileSync(path.join(repoDir, "file1.txt"), "utf8"), "version 3 on branch2 - modification");
  assert.equal(fs.readFileSync(path.join(repoDir, "file4.txt"), "utf8"), "file 4 on main");
  // --- Test 6: Divergent Merge (With Conflicts) ---
  // Create branch3 from current main
  await switchBranch(repoDir, "branch3", { create: true });
  write(path.join(repoDir, "file1.txt"), "conflict version on branch3 (divergent)");
  const commit5 = await commit(repoDir, "Commit on branch3");
  // Switch to main
  await switchBranch(repoDir, "main");
  write(path.join(repoDir, "file1.txt"), "conflict version on main (divergent)");
  const commit6 = await commit(repoDir, "Commit on main");
  // Merge branch3 into main (should conflict)
  const mergeStatus3 = await mergeBranch(repoDir, "branch3");
  assert.ok(Array.isArray(mergeStatus3), "should return conflict paths array");
  if (Array.isArray(mergeStatus3)) {
    console.log(mergeStatus3);
    let hasFile1=false;
    for (let st of mergeStatus3) {
      if (st.match(/file1\([0-9a-f]+\).txt/)) hasFile1=true;
    }
    if (!hasFile1) {
      assert.fail("conflict should be on file1.txt");
    }
  } else {
    assert.fail("mergeStatus3 should be an array");
  }
  // Verify conflict file was created
  const files = fs.readdirSync(repoDir);
  const conflictFile = files.find(f => f.startsWith("file1(") && f.endsWith(").txt"));
  assert.ok(conflictFile, "conflict file should exist");
  assert.equal(fs.readFileSync(path.join(repoDir, conflictFile), "utf8"), "conflict version on branch3 (divergent)");
}

export async function testMultiRepoMerge() {
  const testdir = path.resolve("./test-repo-temp-multi");
  if (fs.existsSync(testdir)) {
    fs.rmSync(testdir, { recursive: true, force: true });
  }
  fs.mkdirSync(testdir, { recursive: true });
  cleanups.push(() => fs.rmSync(testdir, { recursive: true, force: true }));
  const repo1Dir = path.join(testdir, "repo1");
  const repo1 = await initRepo(repo1Dir);
  // --- Test 1: Initialize repo1 with initial commit on main ---
  write(path.join(repo1Dir, "shared.txt"), "shared file v1");
  write(path.join(repo1Dir, "repo1-only.txt"), "repo1 specific file");
  const repo1Commit1 = await sync(repo1Dir, "saveHashedRemote", "Initial commit on repo1 main");
  // --- Test 2: Create feature1 branch on repo1 ---
  await switchBranch(repo1Dir, "feature1", { create: true });
  write(path.join(repo1Dir, "shared.txt"), "shared file v2 from feature1");
  write(path.join(repo1Dir, "feature1.txt"), "feature1 specific file");
  const repo1Commit2 = await sync(repo1Dir, "saveHashedRemote", "Feature1 changes on repo1");
  const repo2Dir = path.join(testdir, "repo2");
  const repo2 = (await cloneRepo(repo1, repo2Dir)).repo;
  // --- Test 3: Initialize repo2 with initial commit on main ---
  write(path.join(repo2Dir, "shared.txt"), "shared file v1");
  write(path.join(repo2Dir, "repo2-only.txt"), "repo2 specific file");
  const repo2Commit1 = await sync(repo2Dir, "saveHashedRemote", "Initial commit on repo2 main");
  // --- Test 4: Create feature2 branch on repo2 with different changes ---
  await switchBranch(repo2Dir, "feature2", { create: true });
  write(path.join(repo2Dir, "shared.txt"), "shared file v3 from feature2");
  write(path.join(repo2Dir, "feature2.txt"), "feature2 specific file");
  const repo2Commit2 = await sync(repo2Dir, "saveHashedRemote", "Feature2 changes on repo2");
  // --- Test 5: Verify each repo is on correct branch ---
  assert.equal(await repo1.getCurrentBranchName(), "feature1", "repo1 should be on feature1");
  assert.equal(await repo2.getCurrentBranchName(), "feature2", "repo2 should be on feature2");
  // --- Test 6: Switch repo1 back to main ---
  await switchBranch(repo1Dir, "main");
  assert.equal(await repo1.getCurrentBranchName(), "main", "repo1 should be on main");
  // --- Test 7: Merge feature1 into repo1 main ---
  const mergeStatus1 = await mergeBranch(repo1Dir, "feature1");
  assert.equal(mergeStatus1, "pulled", "merge feature1 into repo1 main should be fast-forward");
  assert.equal(fs.readFileSync(path.join(repo1Dir, "shared.txt"), "utf8"), "shared file v2 from feature1");
  assert.ok(fs.existsSync(path.join(repo1Dir, "feature1.txt")), "feature1.txt should exist after merge");
  // --- Test 8: Switch repo2 back to main ---
  await switchBranch(repo2Dir, "main");
  assert.equal(await repo2.getCurrentBranchName(), "main", "repo2 should be on main");
  // --- Test 9: Merge feature2 into repo2 main ---
  const mergeStatus2 = await mergeBranch(repo2Dir, "feature2");
  assert.equal(mergeStatus2, "pulled", "merge feature2 into repo2 main should be fast-forward");
  assert.equal(fs.readFileSync(path.join(repo2Dir, "shared.txt"), "utf8"), "shared file v3 from feature2");
  assert.ok(fs.existsSync(path.join(repo2Dir, "feature2.txt")), "feature2.txt should exist after merge");
  // --- Test 10: Verify repos remain independent ---
  assert.ok(!fs.existsSync(path.join(repo1Dir, "feature2.txt")), "repo1 should not have feature2.txt");
  assert.ok(!fs.existsSync(path.join(repo2Dir, "feature1.txt")), "repo2 should not have feature1.txt");
  assert.ok(fs.existsSync(path.join(repo1Dir, "repo1-only.txt")), "repo1-only.txt should exist in repo1");
  assert.ok(fs.existsSync(path.join(repo2Dir, "repo2-only.txt")), "repo2-only.txt should exist in repo2");
}

async function main() {
  try {
    await testBranchSwitchAndMerge();
    await testMultiRepoMerge();
    for (const cleanup of cleanups) {
      await cleanup();
    }
    console.log("Branch & Merge tests passed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

main();
