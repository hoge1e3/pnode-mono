import { Repo } from "../src/git.js";
import { Index } from "../src/index_file.js";
import { promises as fs } from "fs";
import * as path from "path";
import { asFilePath, asBranchName } from "../src/types.js";
import { factory as offlineObjectStoreFactory } from "../src/objects.js";
import { commit, init } from "../src/cmd.js";

async function main() {
  const testDir = asFilePath(path.resolve("./test-repo-temp"));
  const gitDir = asFilePath(path.join(testDir, ".gsync"));
  
  // Clean up
  await fs.rm(testDir, { recursive: true, force: true });
  await fs.mkdir(testDir, { recursive: true });

  // Initialize repo config manually to bypass http requests
  await fs.mkdir(gitDir, { recursive: true });
  await fs.writeFile(
    path.join(gitDir, "remote-conf.json"),
    JSON.stringify({
      serverUrl: "http://localhost/dummy.php",
      repoId: "dummy_repo",
      apiKey: "dummy_key"
    })
  );
  await fs.writeFile(
    path.join(gitDir, "remote-state.json"),
    JSON.stringify({
      uploadSince: 0
    })
  );

  // Create some files
  await fs.writeFile(path.join(testDir, "a.txt"), "hello a");
  await fs.writeFile(path.join(testDir, "b.txt"), "hello b");
  await fs.mkdir(path.join(testDir, "dir"));
  await fs.writeFile(path.join(testDir, "dir/c.txt"), "hello c");

  const objectStore = await offlineObjectStoreFactory(gitDir);
  const repo = new Repo(gitDir, objectStore);
  
  // Set branch
  await repo.setCurrentBranchName(asBranchName("main"));

  console.log("--- Commit test ---");
  const commitHash = await commit(testDir);
  console.log("Commit hash:", commitHash);

  // Check if index file is created
  const indexPath = path.join(gitDir, "index");
  const indexExists = await fs.stat(indexPath).then(() => true).catch(() => false);
  console.log("Index file exists:", indexExists);

  if (indexExists) {
    const index = await Index.read(asFilePath(indexPath));
    console.log("Index entries count:", index.entries.size);
    for (const [p, entry] of index.entries.entries()) {
      console.log(`- Path: ${p}, Hash: ${entry.sha1}, Size: ${entry.fileSize}`);
    }

    // Assert entries
    if (!index.entries.has("a.txt") || !index.entries.has("b.txt") || !index.entries.has("dir/c.txt")) {
      throw new Error("Missing expected entries in index");
    }
  } else {
    throw new Error("Index file was not created");
  }

  // Clean up
  await fs.rm(testDir, { recursive: true, force: true });
  console.log("Test passed successfully!");
}

main().catch(console.error);
