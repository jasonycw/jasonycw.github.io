import { advanceBotAiTick, createBotAiSimulation } from '../bots/index.js';
import {
  COMBAT_DEFAULTS,
  DEFAULT_LOADOUT,
  LOCAL_PLAYER_SLOT_INDEX,
  MATCH_PHASES,
  PLAYER_LIFE_STATES,
  SLOT_TYPES,
} from '../config/index.js';
import { createMatchState, createOfflineSlots } from '../core/index.js';
import { applyCombatShot, advanceRespawnTimers } from '../gameplay/combat.js';
import { MAP_COLLISION_VOLUMES, MAP_SPAWN_POINTS } from '../map/index.js';
import { createPlayerControllerState, simulatePlayerMovementStep } from '../player/index.js';
import { selectBuyPurchase } from '../ui/buyMenu.js';
import { deriveHudData } from '../ui/hudData.js';
import { completeReload, createWeaponState, getWeaponById, startReload } from '../weapons/index.js';

export const OFFLINE_MATCH_PHASE = 'running/free-play';
export const OFFLINE_TICK_RATE = 60;
export const MATCH_OVERLAY_STATES = Object.freeze({
  NONE: 'none',
  BUY: 'buy',
  SETTINGS: 'settings',
  SCOREBOARD: 'scoreboard',
});

const cloneLoadout = (loadout = DEFAULT_LOADOUT) => Object.freeze({
  primaryWeaponId: loadout.primaryWeaponId ?? DEFAULT_LOADOUT.primaryWeaponId,
  secondaryWeaponId: loadout.secondaryWeaponId ?? DEFAULT_LOADOUT.secondaryWeaponId,
  equipmentIds: Object.freeze([...(loadout.equipmentIds ?? DEFAULT_LOADOUT.equipmentIds)]),
  activeWeaponId: loadout.activeWeaponId ?? DEFAULT_LOADOUT.activeWeaponId,
});

const hasKevlar = (loadout) => loadout.equipmentIds.includes('kevlar') || loadout.equipmentIds.includes('kevlar-helmet');

const withPlayers = (matchState, players) => Object.freeze({
  ...matchState,
  phase: MATCH_PHASES.RUNNING,
  mode: OFFLINE_MATCH_PHASE,
  players: Object.freeze(players),
});

const replacePlayer = (matchState, slotIndex, fields) => withPlayers(matchState, matchState.players.map((player, index) => (
  index === slotIndex ? Object.freeze({ ...player, ...fields }) : player
)));

const createControllersForPlayers = (players) => Object.freeze(Object.fromEntries(players.map((player) => [player.slotIndex, createPlayerControllerState({
  position: MAP_SPAWN_POINTS[player.slotIndex]?.position,
  activeWeaponId: player.loadout?.activeWeaponId ?? DEFAULT_LOADOUT.activeWeaponId,
})])));

const createWeaponStatesForPlayers = (players) => Object.freeze(Object.fromEntries(players.map((player) => [
  player.slotIndex,
  createWeaponState(player.loadout?.activeWeaponId ?? DEFAULT_LOADOUT.activeWeaponId),
])));

const getWeaponSlotId = (loadout, slotId) => {
  if (slotId === 'primary') return loadout.primaryWeaponId;
  if (slotId === 'secondary') return loadout.secondaryWeaponId;
  if (slotId === 'knife') return loadout.equipmentIds.find((weaponId) => getWeaponById(weaponId)?.equipmentSlot === 'melee') ?? 'knife';
  return null;
};

const countScoreKills = (matchState) => matchState.players.reduce((total, player) => total + player.score.kills, 0);
const countScoreDeaths = (matchState) => matchState.players.reduce((total, player) => total + player.score.deaths, 0);
const getMetricDelta = (before, after, key) => Math.max(0, (after[key] ?? 0) - (before[key] ?? 0));

export function createOfflineMatch({ localPlayerName = 'Player', localLoadout = DEFAULT_LOADOUT } = {}) {
  const normalizedLoadout = cloneLoadout(localLoadout);
  const players = Object.freeze(createOfflineSlots(localPlayerName).map((player) => (
    player.slotIndex === LOCAL_PLAYER_SLOT_INDEX
      ? Object.freeze({ ...player, loadout: normalizedLoadout, armor: hasKevlar(normalizedLoadout) ? COMBAT_DEFAULTS.maxArmor : player.armor })
      : player
  )));
  const matchState = Object.freeze({ ...createMatchState({ phase: MATCH_PHASES.RUNNING, players }), mode: OFFLINE_MATCH_PHASE });

  return createBotAiSimulation({
    matchState,
    controllersBySlotIndex: createControllersForPlayers(matchState.players),
    weaponStatesBySlotIndex: createWeaponStatesForPlayers(matchState.players),
  });
}

export function deriveOfflineMatchHud(state) {
  return deriveHudData(state.matchState, {
    localSlotIndex: LOCAL_PLAYER_SLOT_INDEX,
    controllersBySlotIndex: state.controllersBySlotIndex,
    weaponStatesBySlotIndex: state.weaponStatesBySlotIndex,
  });
}

export function switchOfflineWeaponSlot(state, slotId) {
  const localPlayer = state.matchState.players[LOCAL_PLAYER_SLOT_INDEX];
  const currentLoadout = cloneLoadout(localPlayer.loadout);
  const weaponId = getWeaponSlotId(currentLoadout, slotId);

  if (!weaponId || !getWeaponById(weaponId) || weaponId === currentLoadout.activeWeaponId) {
    return Object.freeze({ ok: false, reason: weaponId === currentLoadout.activeWeaponId ? 'already-active' : 'slot-empty', state });
  }

  const loadout = cloneLoadout({ ...currentLoadout, activeWeaponId: weaponId });
  const currentController = state.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX];
  const matchState = replacePlayer(state.matchState, LOCAL_PLAYER_SLOT_INDEX, { loadout });

  return Object.freeze({
    ok: true,
    reason: 'weapon-switched',
    slotId,
    weaponId,
    state: Object.freeze({
      ...state,
      matchState,
      controllersBySlotIndex: Object.freeze({
        ...state.controllersBySlotIndex,
        [LOCAL_PLAYER_SLOT_INDEX]: createPlayerControllerState({
          position: currentController?.position ?? MAP_SPAWN_POINTS[LOCAL_PLAYER_SLOT_INDEX].position,
          velocity: currentController?.velocity,
          yaw: currentController?.view?.yaw ?? 0,
          pitch: currentController?.view?.pitch ?? 0,
          activeWeaponId: weaponId,
          grounded: currentController?.movement?.grounded ?? true,
        }),
      }),
      weaponStatesBySlotIndex: Object.freeze({
        ...state.weaponStatesBySlotIndex,
        [LOCAL_PLAYER_SLOT_INDEX]: createWeaponState(weaponId),
      }),
    }),
  });
}

export function reloadOfflineWeapon(state, { nowMs = state.nowMs } = {}) {
  const weaponState = state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX];
  const reload = startReload(weaponState, nowMs);

  return Object.freeze({
    ...reload,
    state: Object.freeze({
      ...state,
      weaponStatesBySlotIndex: Object.freeze({
        ...state.weaponStatesBySlotIndex,
        [LOCAL_PLAYER_SLOT_INDEX]: reload.state,
      }),
    }),
  });
}

const completeLocalReloadIfReady = (state) => {
  const weaponState = state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX];
  if (!weaponState?.isReloading || state.nowMs < weaponState.reloadCompleteAtMs) {
    return state;
  }

  const reload = completeReload(weaponState, state.nowMs);
  if (!reload.ok) {
    return state;
  }

  return Object.freeze({
    ...state,
    weaponStatesBySlotIndex: Object.freeze({
      ...state.weaponStatesBySlotIndex,
      [LOCAL_PLAYER_SLOT_INDEX]: reload.state,
    }),
  });
};

export function buyOfflineWeapon(state, weaponId) {
  const purchase = selectBuyPurchase(state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout, weaponId);
  if (!purchase.ok) {
    return Object.freeze({ state, purchase });
  }

  const loadout = cloneLoadout(purchase.loadout);
  const currentController = state.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX];
  const matchState = replacePlayer(state.matchState, LOCAL_PLAYER_SLOT_INDEX, {
    loadout,
    armor: hasKevlar(loadout) ? COMBAT_DEFAULTS.maxArmor : state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].armor,
  });

  return Object.freeze({
    purchase,
    state: Object.freeze({
      ...state,
      matchState,
      controllersBySlotIndex: Object.freeze({
        ...state.controllersBySlotIndex,
        [LOCAL_PLAYER_SLOT_INDEX]: createPlayerControllerState({
          position: currentController?.position ?? MAP_SPAWN_POINTS[LOCAL_PLAYER_SLOT_INDEX].position,
          velocity: currentController?.velocity,
          yaw: currentController?.view?.yaw ?? 0,
          pitch: currentController?.view?.pitch ?? 0,
          activeWeaponId: loadout.activeWeaponId,
          grounded: currentController?.movement?.grounded ?? true,
        }),
      }),
      weaponStatesBySlotIndex: Object.freeze({
        ...state.weaponStatesBySlotIndex,
        [LOCAL_PLAYER_SLOT_INDEX]: createWeaponState(loadout.activeWeaponId),
      }),
    }),
  });
}

export function applyOfflineLocalInput(state, {
  buttons = [],
  jumpPressed,
  look = { yawDelta: 0, pitchDelta: 0 },
  fire = false,
  reload = false,
  nowMs = state.nowMs,
  seed = state.tick + 1,
} = {}) {
  const localPlayer = state.matchState.players[LOCAL_PLAYER_SLOT_INDEX];
  let matchState = state.matchState;
  let controllersBySlotIndex = state.controllersBySlotIndex;
  let weaponStatesBySlotIndex = state.weaponStatesBySlotIndex;
  let shot = null;

  if (localPlayer.lifeState === PLAYER_LIFE_STATES.ALIVE) {
    const controller = simulatePlayerMovementStep(controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX], {
      buttons,
      jumpPressed,
      look,
      activeWeaponId: localPlayer.loadout.activeWeaponId,
      collisionVolumes: MAP_COLLISION_VOLUMES,
    });
    controllersBySlotIndex = Object.freeze({ ...controllersBySlotIndex, [LOCAL_PLAYER_SLOT_INDEX]: controller });

    if (reload) {
      const reloadResult = startReload(weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX], nowMs);
      weaponStatesBySlotIndex = Object.freeze({ ...weaponStatesBySlotIndex, [LOCAL_PLAYER_SLOT_INDEX]: reloadResult.state });
    }

    if (fire) {
      const result = applyCombatShot(matchState, {
        shooterSlotIndex: LOCAL_PLAYER_SLOT_INDEX,
        weaponState: weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX],
        controllersBySlotIndex,
        nowMs,
        seed,
        moving: Math.hypot(controller.velocity.x, controller.velocity.z) > 0.01,
        origin: controller.position,
        direction: Object.freeze({ x: -Math.sin(controller.view.yaw), y: 0, z: -Math.cos(controller.view.yaw) }),
      });
      matchState = result.matchState;
      weaponStatesBySlotIndex = Object.freeze({ ...weaponStatesBySlotIndex, [LOCAL_PLAYER_SLOT_INDEX]: result.weaponState });
      shot = result.shot;
    }
  }

  return Object.freeze({ ...state, matchState, controllersBySlotIndex, weaponStatesBySlotIndex, lastLocalShot: shot });
}

export function advanceOfflineMatchTick(state, { localInput = null, blockers = [] } = {}) {
  const beforeMetrics = state.metrics;
  const beforeKills = countScoreKills(state.matchState);
  const beforeDeaths = countScoreDeaths(state.matchState);
  const previousLocalLifeState = state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].lifeState;
  const localController = state.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX];
  const localWeaponState = state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX];
  const needsLocalMovementStep = Boolean(localInput) || localController?.movement?.grounded === false || localWeaponState?.isReloading;
  let workingState = needsLocalMovementStep ? applyOfflineLocalInput(state, localInput ?? {}) : state;
  const lastLocalShot = localInput ? workingState.lastLocalShot ?? null : null;

  workingState = advanceBotAiTick(workingState, { blockers });
  workingState = completeLocalReloadIfReady(workingState);

  const localPlayer = workingState.matchState.players[LOCAL_PLAYER_SLOT_INDEX];
  if (previousLocalLifeState === PLAYER_LIFE_STATES.RESPAWNING && localPlayer.lifeState === PLAYER_LIFE_STATES.ALIVE) {
    workingState = Object.freeze({
      ...workingState,
      controllersBySlotIndex: Object.freeze({
        ...workingState.controllersBySlotIndex,
        [LOCAL_PLAYER_SLOT_INDEX]: createPlayerControllerState({
          position: MAP_SPAWN_POINTS[LOCAL_PLAYER_SLOT_INDEX].position,
          activeWeaponId: localPlayer.loadout.activeWeaponId,
        }),
      }),
      weaponStatesBySlotIndex: Object.freeze({
        ...workingState.weaponStatesBySlotIndex,
        [LOCAL_PLAYER_SLOT_INDEX]: createWeaponState(localPlayer.loadout.activeWeaponId),
      }),
    });
  }

  const matchState = advanceRespawnTimers(Object.freeze({ ...workingState.matchState, phase: MATCH_PHASES.RUNNING, mode: OFFLINE_MATCH_PHASE }), { nowMs: workingState.nowMs });
  const metrics = Object.freeze({
    ...workingState.metrics,
    totalKills: countScoreKills(matchState),
    totalDeaths: countScoreDeaths(matchState),
    botShotsFired: (state.metrics.botShotsFired ?? 0) + getMetricDelta(beforeMetrics, workingState.metrics, 'shotsFired'),
    botRespawns: (state.metrics.botRespawns ?? 0) + getMetricDelta(beforeMetrics, workingState.metrics, 'respawns'),
    killsThisTick: countScoreKills(matchState) - beforeKills,
    deathsThisTick: countScoreDeaths(matchState) - beforeDeaths,
  });

  return Object.freeze({ ...workingState, matchState, metrics, lastLocalShot });
}

export function runOfflineSmokeSimulation(initialState = createOfflineMatch(), { seconds = 120, localInputs = [] } = {}) {
  const totalTicks = Math.round(seconds * OFFLINE_TICK_RATE);
  let state = initialState;

  for (let tickIndex = 0; tickIndex < totalTicks; tickIndex += 1) {
    state = advanceOfflineMatchTick(state, { localInput: localInputs[tickIndex] ?? null });
  }

  return state;
}

export function forceOfflineKill(state, { killerSlotIndex = LOCAL_PLAYER_SLOT_INDEX, victimSlotIndex = 1, nowMs = state.nowMs } = {}) {
  const players = state.matchState.players.map((player, slotIndex) => {
    if (slotIndex === victimSlotIndex) {
      return Object.freeze({
        ...player,
        lifeState: PLAYER_LIFE_STATES.RESPAWNING,
        health: 0,
        armor: 0,
        respawnAtMs: nowMs + COMBAT_DEFAULTS.respawnDelayMs,
        killedBySlotIndex: killerSlotIndex,
        spawnProtectionUntilMs: 0,
        score: Object.freeze({ ...player.score, deaths: player.score.deaths + 1 }),
      });
    }
    if (slotIndex === killerSlotIndex && killerSlotIndex !== victimSlotIndex) {
      return Object.freeze({ ...player, score: Object.freeze({ ...player.score, kills: player.score.kills + 1 }) });
    }
    return player;
  });

  return Object.freeze({ ...state, matchState: withPlayers(state.matchState, players) });
}

export function summarizeOfflineMatch(state) {
  const hud = deriveOfflineMatchHud(state);
  const players = state.matchState.players;

  return Object.freeze({
    phase: state.matchState.phase,
    mode: state.matchState.mode,
    playerCount: players.length,
    localSlotIndex: state.matchState.localSlotIndex,
    localLifeState: players[LOCAL_PLAYER_SLOT_INDEX].lifeState,
    localLoadout: cloneLoadout(players[LOCAL_PLAYER_SLOT_INDEX].loadout),
    botCount: players.filter((player) => player.slotType === SLOT_TYPES.BOT).length,
    scoreboardRows: hud.scoreboard.length,
    totalKills: countScoreKills(state.matchState),
    totalDeaths: countScoreDeaths(state.matchState),
    botShotsFired: state.metrics.botShotsFired ?? state.metrics.shotsFired ?? 0,
    botRespawns: state.metrics.botRespawns ?? state.metrics.respawns ?? 0,
    hasRoundWinner: Boolean(state.matchState.roundWinner || state.matchState.winningTeam || state.matchState.teamWinner),
  });
}

export function summarizeOfflineMenuConsistency(state, { overlayState = MATCH_OVERLAY_STATES.NONE } = {}) {
  const hud = deriveOfflineMatchHud(state);
  const localPlayer = state.matchState.players[LOCAL_PLAYER_SLOT_INDEX];
  const controller = state.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX];

  return Object.freeze({
    overlayState,
    phase: state.matchState.phase,
    mode: state.matchState.mode,
    localLifeState: localPlayer.lifeState,
    localHealth: localPlayer.health,
    localArmor: localPlayer.armor,
    localWeaponId: localPlayer.loadout.activeWeaponId,
    controllerWeaponId: controller?.activeWeaponId ?? controller?.weapon?.activeWeaponId ?? localPlayer.loadout.activeWeaponId,
    scoreboardRows: hud.scoreboard.length,
    hudLifeState: hud.localPlayer.lifeState,
    hudHealth: hud.localPlayer.health,
    respawnAtMs: localPlayer.respawnAtMs,
    consistent: state.matchState.phase === MATCH_PHASES.RUNNING
      && state.matchState.mode === OFFLINE_MATCH_PHASE
      && hud.scoreboard.length === 16
      && hud.localPlayer.lifeState === localPlayer.lifeState
      && hud.localPlayer.health === (localPlayer.lifeState === PLAYER_LIFE_STATES.ALIVE ? localPlayer.health : 0),
  });
}

export function summarizeOfflinePerformance(state, frameReport = null) {
  const summary = summarizeOfflineMatch(state);

  return Object.freeze({
    tick: state.tick,
    nowMs: state.nowMs,
    playerCount: summary.playerCount,
    botCount: summary.botCount,
    totalKills: summary.totalKills,
    totalDeaths: summary.totalDeaths,
    botShotsFired: summary.botShotsFired,
    botRespawns: summary.botRespawns,
    frameReport,
  });
}
