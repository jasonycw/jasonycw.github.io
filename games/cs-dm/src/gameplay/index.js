export {
  applyCombatShot,
  applyDamage,
  advanceRespawnTimers,
  clearSpawnProtection,
  createCombatPlayerFields,
  isSpawnProtected,
  recordKill,
  respawnPlayer,
  SPAWN_PROTECTION_BREAK_REASONS,
} from './combat.js';

export {
  advanceOfflineMatchTick,
  applyOfflineLocalInput,
  buyOfflineWeapon,
  createOfflineMatch,
  deriveOfflineMatchHud,
  forceOfflineKill,
  OFFLINE_MATCH_PHASE,
  OFFLINE_TICK_RATE,
  runOfflineSmokeSimulation,
  summarizeOfflineMatch,
  summarizeOfflinePerformance,
} from './offlineMatch.js';

export {
  createFrameTimingReport,
  PERFORMANCE_BUDGETS,
  runOfflinePerformanceSmoke,
  runTransientEntityCountSmoke,
  TRANSIENT_EFFECT_TTL_MS,
} from './performance.js';
