import {
  DEFAULT_LOADOUT,
  FACTIONS,
  MAX_PLAYER_SLOTS,
  PLAYER_LIFE_STATES,
  SLOT_TYPES,
  WEAPONS,
} from '../config/index.js';
import { MAP_COLLISION_VOLUMES } from '../map/index.js';
import { deriveWeaponSwitchMetadata } from '../render/weaponModels.js';

const DEFAULT_SESSION_CLOCK = Object.freeze({ tick: 0, phase: 'menu' });
const DEFAULT_RADAR_BOUNDS = Object.freeze({ minX: 0, maxX: 100, minZ: 0, maxZ: 100 });
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

const deriveAmmo = (loadout, weaponState = null) => {
  const weapon = resolveWeapon(loadout.activeWeaponId);
  const liveState = weaponState?.weaponId === weapon.id ? weaponState : null;

  return Object.freeze({
    weaponId: weapon.id,
    clip: liveState ? safeInteger(liveState.ammoInMagazine) : weapon.ammo.magazine,
    reserve: liveState ? safeInteger(liveState.reserveAmmo) : weapon.ammo.reserveMax,
    ammoType: weapon.ammo.type,
    isReloading: Boolean(liveState?.isReloading),
    reloadCompleteAtMs: safeInteger(liveState?.reloadCompleteAtMs),
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
    weaponId: weapon.id,
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

const deriveRadarBounds = (collisionVolumes = MAP_COLLISION_VOLUMES) => {
  const edges = collisionVolumes.flatMap((volume) => [
    Object.freeze({ x: volume.center.x - volume.size.width / 2, z: volume.center.z - volume.size.depth / 2 }),
    Object.freeze({ x: volume.center.x + volume.size.width / 2, z: volume.center.z + volume.size.depth / 2 }),
  ]);

  if (edges.length === 0) {
    return DEFAULT_RADAR_BOUNDS;
  }

  return Object.freeze({
    minX: Math.min(...edges.map((edge) => edge.x)),
    maxX: Math.max(...edges.map((edge) => edge.x)),
    minZ: Math.min(...edges.map((edge) => edge.z)),
    maxZ: Math.max(...edges.map((edge) => edge.z)),
  });
};

const clampPercent = (value) => Math.min(100, Math.max(0, value));

const normalizeRadarPoint = (position, bounds, localPosition = null) => {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const depth = Math.max(1, bounds.maxZ - bounds.minZ);

  if (localPosition) {
    const dx = ((position.x - localPosition.x) / width) * 100;
    const dy = ((position.z - localPosition.z) / depth) * 100;
    const distance = Math.hypot(dx, dy);
    if (distance > 50) {
      return Object.freeze({
        x: Number((50 + (dx / distance) * 50).toFixed(3)),
        y: Number((50 + (dy / distance) * 50).toFixed(3)),
      });
    }
    return Object.freeze({
      x: Number(clampPercent(50 + dx).toFixed(3)),
      y: Number(clampPercent(50 + dy).toFixed(3)),
    });
  }

  return Object.freeze({
    x: Number((((position.x - bounds.minX) / width) * 100).toFixed(3)),
    y: Number((((position.z - bounds.minZ) / depth) * 100).toFixed(3)),
  });
};

const deriveRadarBlocks = (collisionVolumes, bounds, localPosition = null) => Object.freeze(collisionVolumes.map((volume, index) => {
  const point = normalizeRadarPoint({ x: volume.center.x - volume.size.width / 2, z: volume.center.z - volume.size.depth / 2 }, bounds, localPosition);
  const width = Math.max(0.5, Number(((volume.size.width / Math.max(1, bounds.maxX - bounds.minX)) * 100).toFixed(3)));
  const height = Math.max(0.5, Number(((volume.size.depth / Math.max(1, bounds.maxZ - bounds.minZ)) * 100).toFixed(3)));
  return Object.freeze({ id: `radar-block-${index}`, x: point.x, y: point.y, width, height });
}));

export const deriveRadarData = ({ players = [], controllersBySlotIndex = {}, localSlotIndex = 0, collisionVolumes = MAP_COLLISION_VOLUMES } = {}) => {
  const bounds = deriveRadarBounds(collisionVolumes);
  const localController = controllersBySlotIndex[localSlotIndex];
  const localPosition = localController?.position ?? null;

  return Object.freeze({
    kind: 'player-centered-radar',
    bounds,
    blocks: deriveRadarBlocks(collisionVolumes, bounds, localPosition),
    localView: Object.freeze({ yaw: localController?.view?.yaw ?? 0 }),
    blips: Object.freeze(players
      .filter((player) => player.lifeState === PLAYER_LIFE_STATES.ALIVE && controllersBySlotIndex[player.slotIndex]?.position)
      .map((player) => Object.freeze({
        slotIndex: safeInteger(player.slotIndex),
        kind: player.slotIndex === localSlotIndex ? 'local' : normalizeSlotType(player.slotType),
        faction: player.faction ?? FACTIONS.COUNTER_TERRORISTS,
        point: player.slotIndex === localSlotIndex && localPosition
          ? Object.freeze({ x: 50, y: 50 })
          : normalizeRadarPoint(controllersBySlotIndex[player.slotIndex].position, bounds, localPosition),
      }))),
  });
};

export const deriveHudPlayer = (player, slotIndex = 0, { weaponState = null } = {}) => {
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
    ammo: deriveAmmo(loadout, weaponState),
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

export const deriveHudData = (matchState = {}, { localSlotIndex = 0, controllersBySlotIndex = {}, weaponStatesBySlotIndex = {} } = {}) => {
  const players = Array.isArray(matchState.players) ? matchState.players : [];
  const paddedPlayers = Array.from({ length: MAX_PLAYER_SLOTS }, (_, slotIndex) => players[slotIndex] ?? createFallbackPlayer(slotIndex));

  return Object.freeze({
    sessionClock: Object.freeze({
      tick: safeInteger(matchState.tick),
      phase: matchState.phase ?? DEFAULT_SESSION_CLOCK.phase,
    }),
    radar: deriveRadarData({ players: paddedPlayers, controllersBySlotIndex, localSlotIndex }),
    localPlayer: deriveHudPlayer(paddedPlayers[localSlotIndex] ?? createFallbackPlayer(localSlotIndex), localSlotIndex, { weaponState: weaponStatesBySlotIndex[localSlotIndex] }),
    scoreboard: deriveScoreboardRows(paddedPlayers),
  });
};
