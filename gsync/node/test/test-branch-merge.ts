import * as fs from "fs";
import * as path from "path";
import * as assert from "assert";

import { Repo } from "../src/git.js";
import { commit, switchBranch, mergeBranch, init } from "../src/cmd.js";
import { asFilePath, asBranchName, asLocalRef, isHash, FilePath, Hash, asPathInRepo } from "../src/types.js";
import { GIT_DIR_NAME } from "../src/sync.js";
import { factory as offlineObjectStoreFactory } from "../src/objects.js";

const cleanups: (() => any)[] = [];

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

async function initRepo(dir: string): Promise<Repo> {
  const gitDir = asFilePath(path.join(dir, GIT_DIR_NAME));
  fs.mkdirSync(gitDir, { recursive: true });
  fs.writeFileSync(
    path.join(gitDir, "remote-conf.json"),
    JSON.stringify({
      serverUrl: "http://localhost/dummy.php",
      repoId: "dummy_repo",
      apiKey: "dummy_key"
    })
  );
  fs.writeFileSync(
    path.join(gitDir, "remote-state.json"),
    JSON.stringify({
      uploadSince: 0
    })
  );
  const objectStore = await offlineObjectStoreFactory(gitDir);
  const repo = new Repo(gitDir, objectStore);
  await repo.setCurrentBranchName(asBranchName("main"));
  return repo;
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
    assert.ok(mergeStatus3.includes(asPathInRepo("file1.txt")), "conflict should be on file1.txt");
  } else {
    assert.fail("mergeStatus3 should be an array");
  }

  // Verify conflict file was created
  const files = fs.readdirSync(repoDir);
  const conflictFile = files.find(f => f.startsWith("file1(") && f.endsWith(").txt"));
  assert.ok(conflictFile, "conflict file should exist");
  assert.equal(fs.readFileSync(path.join(repoDir, conflictFile), "utf8"), "conflict version on branch3");
}

async function main() {
  try {
    await testBranchSwitchAndMerge();
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
