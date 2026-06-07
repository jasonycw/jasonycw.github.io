import { COMBAT_DEFAULTS, PLAYER_LIFE_STATES } from '../config/index.js';
import { MAP_SPAWN_POINTS } from '../map/index.js';
import { PLAYER_MOVEMENT_DEFAULTS } from '../player/index.js';
import { fireWeapon } from '../weapons/index.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const freezeVector = (vector) => Object.freeze({ x: vector.x, y: vector.y, z: vector.z });
const cloneLoadout = (loadout) => Object.freeze({
  primaryWeaponId: loadout.primaryWeaponId,
  secondaryWeaponId: loadout.secondaryWeaponId,
  equipmentIds: Object.freeze([...(loadout.equipmentIds ?? [])]),
  activeWeaponId: loadout.activeWeaponId,
});

export const SPAWN_PROTECTION_BREAK_REASONS = Object.freeze({
  FIRE: 'fire',
});

export const createCombatPlayerFields = ({ nowMs = 0 } = {}) => Object.freeze({
  lifeState: PLAYER_LIFE_STATES.ALIVE,
  health: COMBAT_DEFAULTS.maxHealth,
  armor: 0,
  respawnAtMs: null,
  spawnProtectionUntilMs: nowMs + COMBAT_DEFAULTS.spawnProtectionMs,
});

export function clearSpawnProtection(player, reason = SPAWN_PROTECTION_BREAK_REASONS.FIRE) {
  return Object.freeze({ ...player, spawnProtectionUntilMs: 0, spawnProtectionBreakReason: reason });
}

export function isSpawnProtected(player, nowMs = 0) {
  return player.lifeState === PLAYER_LIFE_STATES.ALIVE && Number.isFinite(player.spawnProtectionUntilMs) && nowMs < player.spawnProtectionUntilMs;
}

export function applyDamage(player, {
  damage,
  nowMs = 0,
  attackerSlotIndex = null,
  respawnDelayMs = COMBAT_DEFAULTS.respawnDelayMs,
} = {}) {
  if (player.lifeState !== PLAYER_LIFE_STATES.ALIVE) {
    return Object.freeze({ player, damageApplied: 0, killed: false, ignored: 'not-alive' });
  }

  if (isSpawnProtected(player, nowMs)) {
    return Object.freeze({ player, damageApplied: 0, killed: false, ignored: 'spawn-protected' });
  }

  const incomingDamage = Math.max(0, Math.round(damage));
  const armorAbsorbed = Math.min(player.armor, Math.floor(incomingDamage * 0.5));
  const healthDamage = incomingDamage - armorAbsorbed;
  const health = clamp(player.health - healthDamage, 0, COMBAT_DEFAULTS.maxHealth);
  const armor = clamp(player.armor - armorAbsorbed, 0, COMBAT_DEFAULTS.maxArmor);
  const killed = health === 0;

  return Object.freeze({
    player: Object.freeze({
      ...player,
      lifeState: killed ? PLAYER_LIFE_STATES.RESPAWNING : PLAYER_LIFE_STATES.ALIVE,
      health,
      armor,
      respawnAtMs: killed ? nowMs + respawnDelayMs : player.respawnAtMs ?? null,
      killedBySlotIndex: killed ? attackerSlotIndex : player.killedBySlotIndex,
      spawnProtectionUntilMs: killed ? 0 : player.spawnProtectionUntilMs ?? 0,
    }),
    damageApplied: healthDamage,
    armorAbsorbed,
    killed,
    ignored: null,
  });
}

export function recordKill(matchState, killerSlotIndex, victimSlotIndex) {
  const players = matchState.players.map((player, slotIndex) => {
    if (slotIndex === killerSlotIndex && killerSlotIndex !== victimSlotIndex) {
      return Object.freeze({ ...player, score: Object.freeze({ ...player.score, kills: player.score.kills + 1 }) });
    }

    if (slotIndex === victimSlotIndex) {
      return Object.freeze({ ...player, score: Object.freeze({ ...player.score, deaths: player.score.deaths + 1 }) });
    }

    return player;
  });

  return Object.freeze({ ...matchState, players: Object.freeze(players) });
}

const getTargetRecords = (matchState, controllersBySlotIndex, shooterSlotIndex) => matchState.players
  .filter((player) => player.slotIndex !== shooterSlotIndex && player.lifeState === PLAYER_LIFE_STATES.ALIVE)
  .map((player) => {
    const controller = controllersBySlotIndex[player.slotIndex] ?? {};
    const position = controller.position ?? MAP_SPAWN_POINTS[player.slotIndex]?.position ?? { x: 0, y: 0, z: 0 };
    return Object.freeze({
      id: String(player.slotIndex),
      slotIndex: player.slotIndex,
      position: freezeVector(position),
      radius: controller.radius ?? PLAYER_MOVEMENT_DEFAULTS.collisionRadius,
    });
  });

export function applyCombatShot(matchState, {
  shooterSlotIndex,
  weaponState,
  controllersBySlotIndex = Object.freeze({}),
  nowMs = 0,
  seed = 1,
  moving = false,
  origin,
  direction = { x: 0, y: 0, z: 1 },
  altFire = false,
} = {}) {
  const shooter = matchState.players[shooterSlotIndex];
  if (!shooter || shooter.lifeState !== PLAYER_LIFE_STATES.ALIVE) {
    return Object.freeze({ ok: false, reason: 'shooter-not-alive', matchState, weaponState, shot: null });
  }

  const shooterController = controllersBySlotIndex[shooterSlotIndex] ?? {};
  const shotOrigin = origin ?? shooterController.position ?? MAP_SPAWN_POINTS[shooterSlotIndex]?.position ?? { x: 0, y: 0, z: 0 };
  const shotResult = fireWeapon(weaponState, {
    nowMs,
    seed,
    moving,
    origin: shotOrigin,
    direction,
    targets: getTargetRecords(matchState, controllersBySlotIndex, shooterSlotIndex),
    altFire,
  });

  if (!shotResult.ok) {
    return Object.freeze({ ok: false, reason: shotResult.reason, matchState, weaponState: shotResult.state, shot: null });
  }

  let nextPlayers = matchState.players.map((player, slotIndex) => slotIndex === shooterSlotIndex ? clearSpawnProtection(player) : player);
  let nextMatchState = Object.freeze({ ...matchState, players: Object.freeze(nextPlayers) });
  let damageResult = null;

  if (shotResult.shot.hit) {
    const victimSlotIndex = Number(shotResult.shot.hit.targetId);
    const victim = nextMatchState.players[victimSlotIndex];
    damageResult = applyDamage(victim, { damage: shotResult.shot.damage, nowMs, attackerSlotIndex: shooterSlotIndex });
    nextPlayers = nextMatchState.players.map((player, slotIndex) => slotIndex === victimSlotIndex ? damageResult.player : player);
    nextMatchState = Object.freeze({ ...nextMatchState, players: Object.freeze(nextPlayers) });

    if (damageResult.killed) {
      nextMatchState = recordKill(nextMatchState, shooterSlotIndex, victimSlotIndex);
    }
  }

  return Object.freeze({
    ok: true,
    reason: 'fired',
    matchState: nextMatchState,
    weaponState: shotResult.state,
    shot: shotResult.shot,
    damage: damageResult,
  });
}

export function respawnPlayer(player, { nowMs = 0, spawnPoint = MAP_SPAWN_POINTS[player.slotIndex] } = {}) {
  return Object.freeze({
    ...player,
    lifeState: PLAYER_LIFE_STATES.ALIVE,
    health: COMBAT_DEFAULTS.maxHealth,
    armor: player.loadout.equipmentIds?.includes('kevlar') || player.loadout.equipmentIds?.includes('kevlar-helmet') ? COMBAT_DEFAULTS.maxArmor : player.armor,
    respawnAtMs: null,
    spawnProtectionUntilMs: nowMs + COMBAT_DEFAULTS.spawnProtectionMs,
    spawnId: spawnPoint?.id ?? player.spawnId,
    loadout: cloneLoadout(player.loadout),
  });
}

export function advanceRespawnTimers(matchState, { nowMs = 0, spawnPoints = MAP_SPAWN_POINTS } = {}) {
  const players = matchState.players.map((player) => {
    if (player.lifeState !== PLAYER_LIFE_STATES.RESPAWNING || !Number.isFinite(player.respawnAtMs) || nowMs < player.respawnAtMs) {
      return player;
    }

    return respawnPlayer(player, { nowMs, spawnPoint: spawnPoints[player.slotIndex] });
  });

  return Object.freeze({ ...matchState, players: Object.freeze(players) });
}
