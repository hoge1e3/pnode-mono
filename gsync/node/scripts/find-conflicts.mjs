// merge3 が固まる（または異常に時間がかかる）組み合わせを、
// コミット履歴から総当たりで検出する診断スクリプト。
//
// 使い方:
//   node scripts/find-conflicts.mjs <repoDir> [--brute] [--timeout=5000] [--slow=500]
//
//   <repoDir>        .gsync がある作業ディレクトリ（省略時はカレントディレクトリ）
//   --brute          全コミットの総当たりペアで検証する（デフォルトは実際に記録された
//                     マージコミット（親が2つ）だけを対象にする軽量モード）
//   --timeout=ms     1件あたりのタイムアウト（デフォルト 5000ms）。これを超えたら
//                     HANG として記録し、Workerを強制終了して次に進む。
//   --slow=ms        この時間を超えたら SLOW として一覧に出す（デフォルト 500ms）
//
// 注意: --brute はコミット数の2乗のペアを調べるため、履歴が大きいと非常に時間が
// かかります。まずはデフォルト（記録済みマージのみ）で試し、必要に応じて --brute
// を使ってください。

import { Worker } from 'node:worker_threads';
import * as path from 'node:path';
import * as fs from "node:fs";
import { promises as fsp } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Repo, isUtf8Text, stripCR } from '../js/src/git.js';
import { factory as objectStoreFactory } from '../js/src/objects.js';
import {DownloadableObjectStore} from "../js/src/sync.js";
import { PHPClientFactory } from '../js/src/webapi.js';

const apiFactory=new PHPClientFactory();// TODO: firebase etc.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GIT_DIR_NAME = '.gsync';
const REMOTE_CONF_FILE="remote-conf.json";
async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function walkRefs(dir, out) {
  if (!await exists(dir)) return;
  for (const ent of await fsp.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      await walkRefs(full, out);
    } else {
      const hash = (await fsp.readFile(full, 'utf-8')).trim();
      if (hash) out.push(hash);
    }
  }
}

function runMerge3InWorker(base, mine, theirs, timeoutMs) {
  return new Promise((resolve) => {
    const worker = new Worker(path.join(__dirname, 'merge3-worker.mjs'), {
      workerData: { base, mine, theirs },
    });
    const t0 = performance.now();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      resolve({ timedOut: true, ms: performance.now() - t0 });
    }, timeoutMs);
    worker.once('message', (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve({ timedOut: false, ...msg });
    });
    worker.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ timedOut: false, ok: false, ms: performance.now() - t0, error: String(err) });
    });
  });
}
async function readConfig(dir) {
  const conffile = path.join(dir, REMOTE_CONF_FILE);
  const conf = JSON.parse(await fs.promises.readFile(conffile, { encoding: "utf-8" }));
  return conf;
}
async function main() {
  const args = process.argv.slice(2);
  const targetDir = path.resolve(args.find(a => !a.startsWith('--')) || process.cwd());
  const brute = args.includes('--brute');
  const timeoutMs = Number((args.find(a => a.startsWith('--timeout=')) || '--timeout=5000').split('=')[1]);
  const slowMs = Number((args.find(a => a.startsWith('--slow=')) || '--slow=500').split('=')[1]);

  const gitDir = path.join(targetDir, GIT_DIR_NAME);
  if (!await exists(gitDir)) {
    console.error(`No ${GIT_DIR_NAME} found in ${targetDir}`);
    process.exit(1);
  }

  const conf=await readConfig(gitDir);
  const api=await apiFactory.load(conf);
  const offlineStore=await objectStoreFactory(gitDir, api.repoId);
  const objectStore=new DownloadableObjectStore(offlineStore,api);

  const repo = new Repo(gitDir, objectStore);

  // 1. すべてのローカルブランチの先端コミットを集める
  const headsDir = path.join(gitDir, 'refs', 'heads');
  const branchHeads = [];
  await walkRefs(headsDir, branchHeads);
  if (branchHeads.length === 0) {
    console.error(`No branch refs found under ${headsDir}`);
    process.exit(1);
  }
  console.log(`Branch tips: ${branchHeads.length}`);

  // 2. 到達可能な全コミットをBFSで収集
  const commits = new Map(); // hash -> CommitEntry
  const queue = [...branchHeads];
  while (queue.length) {
    const h = queue.shift();
    if (commits.has(h)) continue;
    let c;
    try {
      c = await repo.readCommit(h);
    } catch (e) {
      console.warn(`Skip unreadable commit ${h}: ${e.message}`);
      continue;
    }
    commits.set(h, c);
    for (const p of c.parents) queue.push(p);
  }
  console.log(`Collected ${commits.size} commits.`);

  // 3. 検証するコミットペアを決定
  const hashes = [...commits.keys()];
  const pairs = [];
  if (brute) {
    for (let i = 0; i < hashes.length; i++) {
      for (let j = i + 1; j < hashes.length; j++) {
        pairs.push([hashes[i], hashes[j]]);
      }
    }
    console.log(`Brute force mode: ${pairs.length} commit pairs to check.`);
  } else {
    for (const [, c] of commits) {
      if (c.parents.length === 2) pairs.push([c.parents[0], c.parents[1]]);
    }
    console.log(`Recorded-merge mode: ${pairs.length} merge points to check.`);
  }

  const results = [];
  const seen = new Set(); // (base:a:b) の組み合わせの重複除去

  let pairIdx = 0;
  for (const [ah, bh] of pairs) {
    pairIdx++;
    if (pairIdx % 50 === 0) console.log(`... pair ${pairIdx}/${pairs.length}`);

    let base;
    try {
      base = await repo.findMergeBase(ah, bh);
    } catch {
      continue; // 共通祖先なし（無関係な履歴）
    }
    if (base === ah || base === bh) continue; // fast-forward、コンフリクトしえない

    let baseC, aC, bC;
    try {
      [baseC, aC, bC] = await Promise.all([
        repo.readCommit(base), repo.readCommit(ah), repo.readCommit(bh),
      ]);
    } catch (e) {
      console.warn(`Skip pair ${ah}/${bh}: ${e.message}`);
      continue;
    }
    const [baseTree, aTree, bTree] = await Promise.all([
      repo.readTree(baseC.tree), repo.readTree(aC.tree), repo.readTree(bC.tree),
    ]);

    let conflicts;
    try {
      ({ conflicts } = await repo.threeWayMerge(baseTree, aTree, bTree));
    } catch (e) {
      console.warn(`threeWayMerge failed for ${ah}/${bh}: ${e.message}`);
      continue;
    }

    for (const c of conflicts) {
      const key = `${c.base || ''}:${c.a}:${c.b}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let baseObj, aObj, bObj;
      try {
        [baseObj, aObj, bObj] = await Promise.all([
          c.base ? repo.readObject(c.base) : Promise.resolve({ content: Buffer.from([]) }),
          repo.readObject(c.a),
          repo.readObject(c.b),
        ]);
      } catch (e) {
        console.warn(`Skip conflict ${c.path}: ${e.message}`);
        continue;
      }

      const baseStr = isUtf8Text(stripCR(baseObj.content));
      const aStr = isUtf8Text(stripCR(aObj.content));
      const bStr = isUtf8Text(stripCR(bObj.content));
      if (baseStr === null || aStr === null || bStr === null) {
        continue; // バイナリ扱い。実運用でも merge3 には渡らない
      }

      const r = await runMerge3InWorker(baseStr, aStr, bStr, timeoutMs);
      const entry = {
        path: c.path,
        base: c.base || null,
        a: c.a,
        b: c.b,
        commitA: ah,
        commitB: bh,
        sizes: { base: baseStr.length, mine: aStr.length, theirs: bStr.length },
        ...r,
      };
      results.push(entry);

      const tag = r.timedOut ? 'HANG' : (r.ms > slowMs ? 'SLOW' : (r.ok === false ? 'ERROR' : 'ok'));
      if (tag !== 'ok') {
        console.log(
          `[${tag}] ${c.path}  ${r.timedOut ? '>' + timeoutMs : r.ms.toFixed(0)}ms  ` +
          `base=${(c.base || '(none)').slice(0, 8)} a=${c.a.slice(0, 8)} b=${c.b.slice(0, 8)}  ` +
          `sizes(base/mine/theirs)=${baseStr.length}/${aStr.length}/${bStr.length}`
        );
      }
    }
  }

  results.sort((x, y) => (y.timedOut ? 1 : 0) - (x.timedOut ? 1 : 0) || (y.ms ?? 0) - (x.ms ?? 0));

  console.log('\n=== Top offenders ===');
  for (const r of results.slice(0, 20)) {
    console.log(
      `${r.timedOut ? 'HANG(>' + timeoutMs + 'ms)' : r.ms.toFixed(0) + 'ms'}  ${r.path}  ` +
      `sizes=${r.sizes.base}/${r.sizes.mine}/${r.sizes.theirs}  base=${r.base} a=${r.a} b=${r.b}`
    );
  }

  const outFile = path.join(targetDir, 'merge3-scan-results.json');
  await fsp.writeFile(outFile, JSON.stringify(results, null, 2));
  console.log(`\nTested ${results.length} unique (base,mine,theirs) triples.`);
  console.log(`Full results written to ${outFile}`);

  const hangs = results.filter(r => r.timedOut);
  if (hangs.length > 0) {
    console.log(`\n${hangs.length} combination(s) exceeded the timeout (${timeoutMs}ms) and were terminated as HANG.`);
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
