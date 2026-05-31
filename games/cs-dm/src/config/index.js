export { BUY_CATEGORY_METADATA, GRENADE_SCOPE_NOTE, WEAPON_CATEGORIES, WEAPON_LIST, WEAPONS, WEAPONS_BY_ID, getWeaponById } from '../weapons/index.js';

export const GAME_TITLE = 'CS DM';

export const MAX_PLAYER_SLOTS = 16;
export const LOCAL_PLAYER_SLOT_INDEX = 0;
export const BOT_SLOT_COUNT = MAX_PLAYER_SLOTS - 1;

export const SLOT_TYPES = Object.freeze({
  LOCAL: 'local',
  BOT: 'bot',
  REMOTE: 'remote',
});

export const FACTIONS = Object.freeze({
  TERRORISTS: 'terrorists',
  COUNTER_TERRORISTS: 'counter-terrorists',
  SPECTATOR: 'spectator',
});

export const MATCH_PHASES = Object.freeze({
  MENU: 'menu',
  WARMUP: 'warmup',
  RUNNING: 'running',
  PAUSED: 'paused',
  ENDED: 'ended',
});

export const PLAYER_LIFE_STATES = Object.freeze({
  ALIVE: 'alive',
  DEAD: 'dead',
  RESPAWNING: 'respawning',
});

export const COMBAT_DEFAULTS = Object.freeze({
  maxHealth: 100,
  maxArmor: 100,
  respawnDelayMs: 3000,
  spawnProtectionMs: 1500,
});

export const DEFAULT_LOADOUT = Object.freeze({
  primaryWeaponId: 'ak47',
  secondaryWeaponId: 'glock18',
  equipmentIds: Object.freeze(['knife']),
  activeWeaponId: 'ak47',
});

export const SPAWN_REFERENCES = Object.freeze([
  Object.freeze({ id: 'spawn-00', faction: FACTIONS.TERRORISTS, callout: 'T Spawn' }),
  Object.freeze({ id: 'spawn-01', faction: FACTIONS.TERRORISTS, callout: 'Upper Tunnels' }),
  Object.freeze({ id: 'spawn-02', faction: FACTIONS.TERRORISTS, callout: 'Lower Tunnels' }),
  Object.freeze({ id: 'spawn-03', faction: FACTIONS.TERRORISTS, callout: 'Outside Long' }),
  Object.freeze({ id: 'spawn-04', faction: FACTIONS.TERRORISTS, callout: 'Long A' }),
  Object.freeze({ id: 'spawn-05', faction: FACTIONS.TERRORISTS, callout: 'Catwalk' }),
  Object.freeze({ id: 'spawn-06', faction: FACTIONS.TERRORISTS, callout: 'Mid' }),
  Object.freeze({ id: 'spawn-07', faction: FACTIONS.TERRORISTS, callout: 'B Tunnels' }),
  Object.freeze({ id: 'spawn-08', faction: FACTIONS.COUNTER_TERRORISTS, callout: 'CT Spawn' }),
  Object.freeze({ id: 'spawn-09', faction: FACTIONS.COUNTER_TERRORISTS, callout: 'A Site' }),
  Object.freeze({ id: 'spawn-10', faction: FACTIONS.COUNTER_TERRORISTS, callout: 'A Ramp' }),
  Object.freeze({ id: 'spawn-11', faction: FACTIONS.COUNTER_TERRORISTS, callout: 'Short A' }),
  Object.freeze({ id: 'spawn-12', faction: FACTIONS.COUNTER_TERRORISTS, callout: 'Mid Doors' }),
  Object.freeze({ id: 'spawn-13', faction: FACTIONS.COUNTER_TERRORISTS, callout: 'B Site' }),
  Object.freeze({ id: 'spawn-14', faction: FACTIONS.COUNTER_TERRORISTS, callout: 'Window' }),
  Object.freeze({ id: 'spawn-15', faction: FACTIONS.COUNTER_TERRORISTS, callout: 'Back Plat' }),
]);

