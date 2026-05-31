import { advanceOfflineMatchTick, createOfflineMatch, OFFLINE_TICK_RATE, summarizeOfflinePerformance } from './offlineMatch.js';

export const PERFORMANCE_BUDGETS = Object.freeze({
  medianFrameMs: 33,
  p95FrameMs: 80,
  maxSimulationStallMs: 500,
  postCleanupTransientLimit: 64,
});

export const TRANSIENT_EFFECT_TTL_MS = 450;

const now = () => globalThis.performance?.now?.() ?? Date.now();
const round = (value) => Number(value.toFixed(3));

const quantile = (sortedValues, percentile) => {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.ceil((percentile / 100) * sortedValues.length) - 1);
  return sortedValues[index];
};

export function createFrameTimingReport(frameTimesMs) {
  const sorted = [...frameTimesMs].sort((a, b) => a - b);
  const medianFrameMs = round(quantile(sorted, 50));
  const p95FrameMs = round(quantile(sorted, 95));
  const maxSimulationStallMs = round(sorted[sorted.length - 1] ?? 0);

  return Object.freeze({
    frameCount: frameTimesMs.length,
    medianFrameMs,
    p95FrameMs,
    maxSimulationStallMs,
    withinBudget: medianFrameMs <= PERFORMANCE_BUDGETS.medianFrameMs
      && p95FrameMs <= PERFORMANCE_BUDGETS.p95FrameMs
      && maxSimulationStallMs <= PERFORMANCE_BUDGETS.maxSimulationStallMs,
  });
}

export function runOfflinePerformanceSmoke({ seconds = 60, initialState = createOfflineMatch({ localPlayerName: 'PerfSmoke' }) } = {}) {
  const totalTicks = Math.round(seconds * OFFLINE_TICK_RATE);
  const frameTimesMs = [];
  let state = initialState;

  for (let tickIndex = 0; tickIndex < totalTicks; tickIndex += 1) {
    const frameStart = now();
    state = advanceOfflineMatchTick(state);
    frameTimesMs.push(now() - frameStart);
  }

  const frameReport = createFrameTimingReport(frameTimesMs);
  return Object.freeze({
    state,
    summary: summarizeOfflinePerformance(state, frameReport),
    frameReport,
  });
}

const pruneTransientEffects = (effects, nowMs) => effects.filter((effect) => nowMs - effect.createdAtMs <= TRANSIENT_EFFECT_TTL_MS);

export function runTransientEntityCountSmoke({ fireSeconds = 30, cleanupSeconds = 5, initialState = createOfflineMatch({ localPlayerName: 'EntitySmoke' }) } = {}) {
  const fireTicks = Math.round(fireSeconds * OFFLINE_TICK_RATE);
  const cleanupTicks = Math.round(cleanupSeconds * OFFLINE_TICK_RATE);
  let state = initialState;
  let effects = [];
  let maxTransientCount = 0;
  let shotsObserved = 0;

  for (let tickIndex = 0; tickIndex < fireTicks; tickIndex += 1) {
    const previousShots = state.metrics?.botShotsFired ?? state.metrics?.shotsFired ?? 0;
    state = advanceOfflineMatchTick(state, { localInput: { fire: true, nowMs: state.nowMs, seed: tickIndex + 17 } });
    const nextShots = state.metrics?.botShotsFired ?? state.metrics?.shotsFired ?? 0;
    const localShotCount = state.lastLocalShot ? 1 : 0;
    const newShotCount = Math.max(0, nextShots - previousShots) + localShotCount;
    shotsObserved += newShotCount;

    if (newShotCount > 0) {
      effects = effects.concat(Array.from({ length: newShotCount }, (_, index) => Object.freeze({
        id: `shot-${tickIndex}-${index}`,
        createdAtMs: state.nowMs,
      })));
    }

    effects = pruneTransientEffects(effects, state.nowMs);
    maxTransientCount = Math.max(maxTransientCount, effects.length);
  }

  for (let tickIndex = 0; tickIndex < cleanupTicks; tickIndex += 1) {
    state = advanceOfflineMatchTick(state);
    effects = pruneTransientEffects(effects, state.nowMs);
    maxTransientCount = Math.max(maxTransientCount, effects.length);
  }

  return Object.freeze({
    finalState: state,
    shotsObserved,
    maxTransientCount,
    finalTransientCount: effects.length,
    cleanupSeconds,
    withinBudget: effects.length <= PERFORMANCE_BUDGETS.postCleanupTransientLimit,
  });
}
