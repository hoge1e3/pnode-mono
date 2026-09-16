import { parentPort, workerData } from 'node:worker_threads';
import { merge3 } from '../js/src/merge3.js';

const { base, mine, theirs } = workerData;
const t0 = performance.now();
try {
  const [merged, hasConflict] = merge3(base, mine, theirs);
  parentPort.postMessage({
    ok: true,
    ms: performance.now() - t0,
    hasConflict,
    mergedLength: merged.length,
  });
} catch (e) {
  parentPort.postMessage({
    ok: false,
    ms: performance.now() - t0,
    error: String((e && e.stack) || e),
  });
}
