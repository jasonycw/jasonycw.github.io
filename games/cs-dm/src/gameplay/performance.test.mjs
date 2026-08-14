import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PERFORMANCE_BUDGETS, runOfflinePerformanceSmoke, runTransientEntityCountSmoke } from './performance.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const tests = [
  ['records 60-second 16-player offline performance within budget', () => {
    const result = runOfflinePerformanceSmoke({ seconds: 60 });
    const { frameReport, summary } = result;

    assert.equal(summary.playerCount, 16);
    assert.equal(summary.tick, 3600);
    assert.equal(frameReport.frameCount, 3600);
    assert.equal(frameReport.medianFrameMs <= PERFORMANCE_BUDGETS.medianFrameMs, true);
    assert.equal(frameReport.p95FrameMs <= PERFORMANCE_BUDGETS.p95FrameMs, true);
    assert.equal(frameReport.maxSimulationStallMs <= PERFORMANCE_BUDGETS.maxSimulationStallMs, true);
    assert.equal(frameReport.withinBudget, true);

    writeEvidence('task-27-perf-smoke.txt', [
      'PASS T27 deterministic offline performance smoke',
      `ticks=${summary.tick}`,
      `players=${summary.playerCount}`,
      `medianFrameMs=${frameReport.medianFrameMs}`,
      `p95FrameMs=${frameReport.p95FrameMs}`,
      `maxSimulationStallMs=${frameReport.maxSimulationStallMs}`,
      `budgetMedianMs=${PERFORMANCE_BUDGETS.medianFrameMs}`,
      `budgetP95Ms=${PERFORMANCE_BUDGETS.p95FrameMs}`,
      `budgetMaxStallMs=${PERFORMANCE_BUDGETS.maxSimulationStallMs}`,
      `withinBudget=${frameReport.withinBudget}`,
      `botShotsFired=${summary.botShotsFired}`,
      `totalKills=${summary.totalKills}`,
      `botRespawns=${summary.botRespawns}`,
    ]);
  }],

  ['bounds transient projectile and effect counts after firing cleanup', () => {
    const result = runTransientEntityCountSmoke({ fireSeconds: 30, cleanupSeconds: 5 });

    assert.equal(result.shotsObserved > 0, true);
    assert.equal(result.finalTransientCount <= PERFORMANCE_BUDGETS.postCleanupTransientLimit, true);
    assert.equal(result.withinBudget, true);

    writeEvidence('task-27-entity-counts.txt', [
      'PASS T27 transient entity bound smoke',
      'fireSeconds=30',
      `cleanupSeconds=${result.cleanupSeconds}`,
      `shotsObserved=${result.shotsObserved}`,
      `maxTransientCount=${result.maxTransientCount}`,
      `finalTransientCount=${result.finalTransientCount}`,
      `budgetFinalTransientCount=${PERFORMANCE_BUDGETS.postCleanupTransientLimit}`,
      `withinBudget=${result.withinBudget}`,
    ]);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS performance - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL performance - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
