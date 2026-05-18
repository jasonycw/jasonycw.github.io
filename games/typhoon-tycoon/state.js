import { CONFIG } from './config.js';

// ==================== GAME STATE ====================
export const state = {
  phase: 'menu',
  hsi: CONFIG.hsiInit,
  hsiMax: CONFIG.hsiInit,
  powerQuota: 0,
  powerUsed: 0,
  waveTimer: CONFIG.waveInitDelay,
  spawnTimer: 0,
  enemiesPerWave: 3,
  enemiesSpawnedInWave: 0,
  enemyCount: 0,
  gameTime: 0,
  wave: 0,
  enemiesKilled: 0,

  // Tech tree
  hasUniversity: false,
  hasResearchCenter: false,
  hasCheungKong: false,
  universityCount: 0,
  researchCenterCount: 0,

  // Selection
  selectedType: null,

  // Power outage
  powerOutage: false,
  outageTimer: 0
};

// ==================== STRUCTURE FACTORY ====================
export function getStructConfig(type) {
  return CONFIG.structures[type] || null;
}

export function meetsRequirements(type) {
  const cfg = getStructConfig(type);
  if (!cfg) return false;
  if (!cfg.req) return true;
  if (cfg.req === 'University') return state.hasUniversity;
  if (cfg.req === 'ResearchCenter') return state.hasResearchCenter;
  return true;
}

export function getStructureCost(type) {
  const cfg = getStructConfig(type);
  return cfg ? cfg.cost : 0;
}

export function isStructureUnlocked(type) {
  if (type === 'LaserTower' || type === 'PowerPlant' || type === 'University') return true;
  if (type === 'FreezeTower' || type === 'ResearchCenter') return state.hasUniversity;
  if (type === 'RepelTower' || type === 'NuclearPlant') return state.hasResearchCenter;
  if (type === 'CheungKong') return state.hasResearchCenter;
  return true;
}
