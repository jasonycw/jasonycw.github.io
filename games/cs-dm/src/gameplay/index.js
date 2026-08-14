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
  MATCH_OVERLAY_STATES,
  OFFLINE_MATCH_PHASE,
  OFFLINE_TICK_RATE,
  reloadOfflineWeapon,
  runOfflineSmokeSimulation,
  summarizeOfflineMatch,
  summarizeOfflineMenuConsistency,
  summarizeOfflinePerformance,
  switchOfflineWeaponSlot,
} from './offlineMatch.js';

export {
  createFrameTimingReport,
  PERFORMANCE_BUDGETS,
  runOfflinePerformanceSmoke,
  runTransientEntityCountSmoke,
  TRANSIENT_EFFECT_TTL_MS,
} from './performance.js';
