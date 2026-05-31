import {
  DEFAULT_LOADOUT,
  FACTIONS,
  MAX_PLAYER_SLOTS,
  PLAYER_LIFE_STATES,
  SLOT_TYPES,
  WEAPONS,
} from '../config/index.js';
import { deriveWeaponSwitchMetadata } from '../render/weaponModels.js';

const DEFAULT_SESSION_CLOCK = Object.freeze({ tick: 0, phase: 'menu' });
const DEFAULT_RADAR = Object.freeze({ kind: 'placeholder', blips: Object.freeze([]) });
const DEFAULT_LATENCY = Object.freeze({ ms: null });

const safeInteger = (value, fallback = 0) => Number.isInteger(value) ? value : fallback;

const normalizeName = (value, fallback) => {
  const name = String(value ?? '').trim();
  return name.length > 0 ? name : fallback;
};

const normalizeLoadout = (loadout = DEFAULT_LOADOUT) => Object.freeze({
  primaryWeaponId: loadout.primaryWeaponId ?? DEFAULT_LOADOUT.primaryWeaponId,
  secondaryWeaponId: loadout.secondaryWeaponId ?? DEFAULT_LOADOUT.secondaryWeaponId,
  equipmentIds: Object.freeze(Array.isArray(loadout.equipmentIds) ? [...loadout.equipmentIds] : [...DEFAULT_LOADOUT.equipmentIds]),
  activeWeaponId: loadout.activeWeaponId ?? DEFAULT_LOADOUT.activeWeaponId,
});

const resolveWeapon = (weaponId) => Object.values(WEAPONS).find((weapon) => weapon.id === weaponId) ?? WEAPONS.AK47;

const normalizeScore = (score = {}) => Object.freeze({
  kills: safeInteger(score.kills),
  deaths: safeInteger(score.deaths),
});

const deriveAmmo = (loadout) => {
  const weapon = resolveWeapon(loadout.activeWeaponId);

  return Object.freeze({
    weaponId: weapon.id,
    clip: weapon.ammo.magazine,
    reserve: weapon.ammo.reserveMax,
    ammoType: weapon.ammo.type,
  });
};

const deriveActiveWeapon = (loadout) => {
  const weapon = resolveWeapon(loadout.activeWeaponId);
  const metadata = deriveWeaponSwitchMetadata(loadout.activeWeaponId);

  return Object.freeze({
    ...metadata,
    hud: Object.freeze({
      ...metadata.hud,
      label: weapon.name,
      weaponId: weapon.id,
    }),
  });
};

const normalizeLifeState = (lifeState) => Object.values(PLAYER_LIFE_STATES).includes(lifeState)
  ? lifeState
  : PLAYER_LIFE_STATES.DEAD;

const normalizeSlotType = (slotType) => Object.values(SLOT_TYPES).includes(slotType)
  ? slotType
  : SLOT_TYPES.BOT;

const createFallbackPlayer = (slotIndex) => ({
  id: `slot-${String(slotIndex).padStart(2, '0')}`,
  slotIndex,
  slotType: SLOT_TYPES.BOT,
  name: `Slot ${slotIndex + 1}`,
  faction: slotIndex % 2 === 0 ? FACTIONS.COUNTER_TERRORISTS : FACTIONS.TERRORISTS,
  lifeState: PLAYER_LIFE_STATES.DEAD,
  health: 0,
  armor: 0,
  loadout: DEFAULT_LOADOUT,
  score: { kills: 0, deaths: 0 },
});

export const compareFfaScoreboardRows = (left, right) => {
  if (left.score.kills !== right.score.kills) {
    return right.score.kills - left.score.kills;
  }

  if (left.score.deaths !== right.score.deaths) {
    return left.score.deaths - right.score.deaths;
  }

  const nameComparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  if (nameComparison !== 0) {
    return nameComparison;
  }

  const strictNameComparison = left.name.localeCompare(right.name);
  if (strictNameComparison !== 0) {
    return strictNameComparison;
  }

  return left.slotIndex - right.slotIndex;
};

export const deriveHudPlayer = (player, slotIndex = 0) => {
  const source = player ?? createFallbackPlayer(slotIndex);
  const lifeState = normalizeLifeState(source.lifeState);
  const loadout = normalizeLoadout(source.loadout);
  const score = normalizeScore(source.score);
  const isAlive = lifeState === PLAYER_LIFE_STATES.ALIVE;

  return Object.freeze({
    id: source.id ?? `slot-${String(safeInteger(source.slotIndex, slotIndex)).padStart(2, '0')}`,
    slotIndex: safeInteger(source.slotIndex, slotIndex),
    slotType: normalizeSlotType(source.slotType),
    name: normalizeName(source.name, `Slot ${safeInteger(source.slotIndex, slotIndex) + 1}`),
    faction: source.faction ?? FACTIONS.COUNTER_TERRORISTS,
    lifeState,
    health: isAlive ? safeInteger(source.health, 100) : 0,
    armor: isAlive ? safeInteger(source.armor, 0) : 0,
    loadout,
    ammo: deriveAmmo(loadout),
    activeWeapon: deriveActiveWeapon(loadout),
    score,
    latency: DEFAULT_LATENCY,
    respawnCountdown: Object.freeze({ ticksRemaining: isAlive ? 0 : null, secondsRemaining: isAlive ? 0 : null }),
  });
};

export const deriveScoreboardRows = (players = []) => Object.freeze(
  Array.from({ length: MAX_PLAYER_SLOTS }, (_, slotIndex) => deriveHudPlayer(players[slotIndex] ?? createFallbackPlayer(slotIndex), slotIndex))
    .sort(compareFfaScoreboardRows),
);

export const deriveHudData = (matchState = {}, { localSlotIndex = 0 } = {}) => {
  const players = Array.isArray(matchState.players) ? matchState.players : [];
  const paddedPlayers = Array.from({ length: MAX_PLAYER_SLOTS }, (_, slotIndex) => players[slotIndex] ?? createFallbackPlayer(slotIndex));

  return Object.freeze({
    sessionClock: Object.freeze({
      tick: safeInteger(matchState.tick),
      phase: matchState.phase ?? DEFAULT_SESSION_CLOCK.phase,
    }),
    radar: DEFAULT_RADAR,
    localPlayer: deriveHudPlayer(paddedPlayers[localSlotIndex] ?? createFallbackPlayer(localSlotIndex), localSlotIndex),
    scoreboard: deriveScoreboardRows(paddedPlayers),
  });
};
