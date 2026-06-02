import {
  BOT_SLOT_COUNT,
  COMBAT_DEFAULTS,
  DEFAULT_LOADOUT,
  LOCAL_PLAYER_SLOT_INDEX,
  MAX_PLAYER_SLOTS,
  PLAYER_LIFE_STATES,
  SLOT_TYPES,
  WEAPONS,
} from '../config/index.js';
import { applyCombatShot, advanceRespawnTimers } from '../gameplay/combat.js';
import { MAP_COLLISION_VOLUMES, MAP_LANDMARKS, MAP_ROUTE_GRAPH, MAP_SPAWN_POINTS, MAP_WAYPOINTS } from '../map/index.js';
import { createPlayerControllerState, PLAYER_MOVEMENT_DEFAULTS, simulatePlayerMovementStep } from '../player/index.js';
import { completeReload, createWeaponState, getWeaponById, startReload } from '../weapons/index.js';

export const BOT_STATE_MACHINE_STATES = Object.freeze({
  IDLE: 'idle',
  NAVIGATING: 'navigating',
  ENGAGING: 'engaging',
  RETREATING_RELOADING: 'retreating/reloading',
  DEAD: 'dead',
  RESPAWNING: 'respawning',
});

export const BOT_COMBAT_INTENT_STATES = Object.freeze({
  NONE: 'none',
  ACQUIRING_TARGET: 'acquiring-target',
  HOLDING_ANGLE: 'holding-angle',
  DISENGAGING: 'disengaging',
});

export const BOT_DIFFICULTIES = Object.freeze({
  EASY: Object.freeze({ id: 'easy', label: 'Easy', reactionTicks: 24, aimErrorDegrees: 10, pathReplanTicks: 60, aggression: 0.35 }),
  NORMAL: Object.freeze({ id: 'normal', label: 'Normal', reactionTicks: 14, aimErrorDegrees: 6, pathReplanTicks: 45, aggression: 0.55 }),
  HARD: Object.freeze({ id: 'hard', label: 'Hard', reactionTicks: 8, aimErrorDegrees: 3, pathReplanTicks: 30, aggression: 0.75 }),
});

export const DEFAULT_BOT_DIFFICULTY_ID = BOT_DIFFICULTIES.NORMAL.id;

export const BOT_NAMES = Object.freeze([
  'Anchor',
  'Bishop',
  'Cache',
  'Dusty',
  'Echo',
  'Flick',
  'Goose',
  'Hopper',
  'Ivy',
  'Jolt',
  'Kilo',
  'Ledger',
  'Mirage',
  'Nuke',
  'Overpass',
]);

const WAYPOINTS_BY_ID = Object.freeze(Object.fromEntries(MAP_WAYPOINTS.map((waypoint) => [waypoint.id, waypoint])));
const DEFAULT_PATROL_TARGETS = Object.freeze(['wp-b-site', 'wp-mid', 'wp-a-site-boxes', 'wp-long-a', 'wp-window']);
const BOT_TICK_RATE = 60;
const BOT_TICK_MS = 1000 / BOT_TICK_RATE;
const BOT_WAYPOINT_REACHED_RADIUS = 1.4;
const BOT_STUCK_TICKS = 18;
const BOT_VISIBLE_RANGE = 70;
const BOT_RETREAT_HEALTH = 35;
const BOT_LOADOUTS = Object.freeze([
  Object.freeze({ primaryWeaponId: WEAPONS.AK47.id, secondaryWeaponId: WEAPONS.GLOCK18.id, equipmentIds: Object.freeze([WEAPONS.KNIFE.id, WEAPONS.KEVLAR.id]), activeWeaponId: WEAPONS.AK47.id }),
  Object.freeze({ primaryWeaponId: WEAPONS.M4A1.id, secondaryWeaponId: WEAPONS.USP.id, equipmentIds: Object.freeze([WEAPONS.KNIFE.id, WEAPONS.KEVLAR.id]), activeWeaponId: WEAPONS.M4A1.id }),
  Object.freeze({ primaryWeaponId: WEAPONS.MP5.id, secondaryWeaponId: WEAPONS.DEAGLE.id, equipmentIds: Object.freeze([WEAPONS.KNIFE.id, WEAPONS.KEVLAR.id]), activeWeaponId: WEAPONS.MP5.id }),
]);

const freezeRouteStep = (waypoint) => Object.freeze({
  waypointId: waypoint.id,
  calloutId: waypoint.calloutId,
  position: waypoint.position,
});

export const BOT_SLOT_CONTRACT = Object.freeze({
  slotType: SLOT_TYPES.BOT,
  lifecycle: 'idle | navigating | engaging | retreating/reloading | dead | respawning',
  difficultyId: 'easy | normal | hard',
  currentWaypointId: 'id from MAP_ROUTE_GRAPH.anchors',
  targetWaypointId: 'id from MAP_ROUTE_GRAPH.anchors or null',
  route: 'array of waypoint route steps; movement execution is deferred to T21',
  combatIntent: 'non-shooting intent state with targetSlotIndex and desiredRange only',
  handoff: 'remote replacement fields: canBeReplacedByRemote, reservedForRemotePeerId, replacementToken, replacedByRemoteSlotId, handoffTick',
});

export const WAYPOINT_GRAPH_CONTRACT = Object.freeze({
  graph: MAP_ROUTE_GRAPH,
  anchors: 'MAP_ROUTE_GRAPH.anchors reused from map module',
  routeShape: 'array of waypoint ids from start to target, inclusive',
  selection: 'deterministic target helper derived from slotIndex and tick',
});

export function getBotNameForSlot(slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex <= LOCAL_PLAYER_SLOT_INDEX || slotIndex >= MAX_PLAYER_SLOTS) {
    throw new RangeError('Bot slot index must be 1..15.');
  }

  return BOT_NAMES[slotIndex - 1];
}

export function createBotRuntimeContract({
  slotIndex,
  difficultyId = DEFAULT_BOT_DIFFICULTY_ID,
  currentWaypointId = 'wp-t-spawn',
  targetWaypointId = null,
  route = Object.freeze([]),
  state = BOT_STATE_MACHINE_STATES.IDLE,
  tick = 0,
} = {}) {
  if (!Object.values(BOT_DIFFICULTIES).some((difficulty) => difficulty.id === difficultyId)) {
    throw new RangeError(`Unknown bot difficulty: ${difficultyId}`);
  }

  return Object.freeze({
    state,
    previousState: null,
    difficultyId,
    difficulty: BOT_DIFFICULTIES[difficultyId.toUpperCase()],
    stateEnteredTick: tick,
    currentWaypointId,
    targetWaypointId,
    route: Object.freeze([...route]),
    combatIntent: Object.freeze({
      state: BOT_COMBAT_INTENT_STATES.NONE,
      targetSlotIndex: null,
      lastSeenTick: null,
      desiredRange: 18,
      targetAcquiredTick: null,
    }),
    movement: Object.freeze({
      routeIndex: 0,
      blockedTicks: 0,
      lastPosition: null,
      unstuckCount: 0,
    }),
    handoff: Object.freeze({
      canBeReplacedByRemote: true,
      reservedForRemotePeerId: null,
      replacementToken: `bot-slot-${String(slotIndex).padStart(2, '0')}`,
      replacedByRemoteSlotId: null,
      handoffTick: null,
    }),
  });
}

export function selectBotLoadout({ slotIndex, difficultyId = DEFAULT_BOT_DIFFICULTY_ID } = {}) {
  const difficultyOffset = difficultyId === BOT_DIFFICULTIES.HARD.id ? 1 : difficultyId === BOT_DIFFICULTIES.EASY.id ? 2 : 0;
  return BOT_LOADOUTS[Math.abs(slotIndex + difficultyOffset) % BOT_LOADOUTS.length] ?? DEFAULT_LOADOUT;
}

export function createBotSlotFields({ slotIndex, difficultyId = DEFAULT_BOT_DIFFICULTY_ID, currentWaypointId = 'wp-t-spawn' } = {}) {
  return Object.freeze({
    bot: createBotRuntimeContract({ slotIndex, difficultyId, currentWaypointId }),
  });
}

export function listOfflineBotSlotIndexes() {
  return Object.freeze(Array.from({ length: BOT_SLOT_COUNT }, (_, index) => index + 1));
}

export function selectDeterministicBotTarget({ slotIndex, tick = 0, candidates = DEFAULT_PATROL_TARGETS } = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new RangeError('Bot target candidates must not be empty.');
  }

  const selectedIndex = Math.abs((slotIndex * 31) + Math.floor(tick / 300)) % candidates.length;
  return candidates[selectedIndex];
}

export function findWaypointRoute(startWaypointId, targetWaypointId, graph = MAP_ROUTE_GRAPH) {
  if (!WAYPOINTS_BY_ID[startWaypointId] || !WAYPOINTS_BY_ID[targetWaypointId]) {
    return Object.freeze([]);
  }

  const queue = [[startWaypointId]];
  const visited = new Set([startWaypointId]);

  while (queue.length > 0) {
    const route = queue.shift();
    const waypointId = route[route.length - 1];

    if (waypointId === targetWaypointId) {
      return Object.freeze(route.map((routeWaypointId) => freezeRouteStep(WAYPOINTS_BY_ID[routeWaypointId])));
    }

    const waypoint = graph.anchors.find((anchor) => anchor.id === waypointId);
    for (const linkedWaypointId of waypoint?.links ?? []) {
      if (visited.has(linkedWaypointId)) continue;
      visited.add(linkedWaypointId);
      queue.push([...route, linkedWaypointId]);
    }
  }

  return Object.freeze([]);
}

export function createBotPathPlan({ slotIndex, currentWaypointId = 'wp-t-spawn', tick = 0 } = {}) {
  const targetWaypointId = selectDeterministicBotTarget({ slotIndex, tick });
  const route = findWaypointRoute(currentWaypointId, targetWaypointId);

  return Object.freeze({
    currentWaypointId,
    targetWaypointId,
    route,
    state: route.length > 1 ? BOT_STATE_MACHINE_STATES.NAVIGATING : BOT_STATE_MACHINE_STATES.IDLE,
  });
}

export function getDust2TunnelRouteToBSite() {
  return findWaypointRoute('wp-t-spawn', 'wp-b-site');
}

export function isTunnelWaypoint(routeStep) {
  return routeStep.calloutId === MAP_LANDMARKS.UPPER_TUNNELS.id || routeStep.calloutId === MAP_LANDMARKS.LOWER_TUNNELS.id || routeStep.calloutId === MAP_LANDMARKS.B_TUNNELS.id;
}

export function summarizeBotSlots(players) {
  const botSlots = players.filter((player) => player.slotType === SLOT_TYPES.BOT);
  const uniqueNames = new Set(botSlots.map((player) => player.name));

  return Object.freeze({
    botSlotCount: botSlots.length,
    uniqueBotNameCount: uniqueNames.size,
    names: Object.freeze(botSlots.map((player) => player.name)),
    allHaveBotContract: botSlots.every((player) => player.bot?.handoff?.canBeReplacedByRemote === true),
    allAlive: botSlots.every((player) => player.lifeState === PLAYER_LIFE_STATES.ALIVE),
  });
}

const round = (value) => Number(value.toFixed(6));
const freezeVector = (vector) => Object.freeze({ x: round(vector.x), y: round(vector.y), z: round(vector.z) });
const distance2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const normalize2d = (vector) => {
  const length = Math.hypot(vector.x, vector.z);
  return length === 0 ? { x: 0, z: 1 } : { x: vector.x / length, z: vector.z / length };
};
const createBotMetrics = () => Object.freeze({
  movementDistance: 0,
  shotsFired: 0,
  shotsHit: 0,
  kills: 0,
  deaths: 0,
  respawns: 0,
  unstuckEvents: 0,
  easyAimErrorRadians: 0,
  hardAimErrorRadians: 0,
});
const addMetric = (metrics, key, amount = 1) => Object.freeze({ ...metrics, [key]: round((metrics[key] ?? 0) + amount) });
const getControllerPosition = (controllersBySlotIndex, slotIndex) => controllersBySlotIndex[slotIndex]?.position ?? { x: 0, y: 0, z: 0 };
const getNearestWaypointId = (position) => MAP_WAYPOINTS.reduce((best, waypoint) => {
  const distance = distance2d(position, waypoint.position);
  return distance < best.distance ? { waypointId: waypoint.id, distance } : best;
}, { waypointId: MAP_WAYPOINTS[0].id, distance: Number.POSITIVE_INFINITY }).waypointId;
const getWaypointLinks = (waypointId) => WAYPOINTS_BY_ID[waypointId]?.links ?? Object.freeze([]);
const getRouteTargetPosition = (bot) => bot.route[Math.min(bot.movement?.routeIndex ?? 0, Math.max(0, bot.route.length - 1))]?.position
  ?? WAYPOINTS_BY_ID[bot.targetWaypointId]?.position
  ?? WAYPOINTS_BY_ID[bot.currentWaypointId]?.position;

const withPlayerBot = (player, botFields) => Object.freeze({ ...player, bot: Object.freeze({ ...player.bot, ...botFields }) });
const withPlayers = (matchState, players) => Object.freeze({ ...matchState, players: Object.freeze(players) });
const withBotForSlot = (matchState, slotIndex, botFields) => withPlayers(matchState, matchState.players.map((player, index) => (
  index === slotIndex && player.bot ? withPlayerBot(player, botFields) : player
)));

const segmentIntersectsBox2d = (start, end, box) => {
  const halfWidth = box.size.width / 2;
  const halfDepth = box.size.depth / 2;
  const minX = box.center.x - halfWidth;
  const maxX = box.center.x + halfWidth;
  const minZ = box.center.z - halfDepth;
  const maxZ = box.center.z + halfDepth;
  const steps = Math.max(2, Math.ceil(distance2d(start, end) / 4));

  for (let step = 1; step < steps; step += 1) {
    const progress = step / steps;
    const x = start.x + (end.x - start.x) * progress;
    const z = start.z + (end.z - start.z) * progress;
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
      return true;
    }
  }

  return false;
};

export function hasApproximateLineOfSight(origin, target, { maxRange = BOT_VISIBLE_RANGE, blockers = [] } = {}) {
  if (distance2d(origin, target) > maxRange) {
    return false;
  }

  return !blockers.some((blocker) => blocker.kind === 'box' && distance2d(origin, blocker.center) > 3 && distance2d(target, blocker.center) > 3 && segmentIntersectsBox2d(origin, target, blocker));
}

export function chooseVisibleBotTarget({ matchState, controllersBySlotIndex, slotIndex, nowMs = 0, maxRange = BOT_VISIBLE_RANGE, blockers = [] } = {}) {
  const origin = getControllerPosition(controllersBySlotIndex, slotIndex);
  let selected = null;

  for (const player of matchState.players) {
    if (player.slotIndex === slotIndex || player.lifeState !== PLAYER_LIFE_STATES.ALIVE || player.spawnProtectionUntilMs > nowMs) {
      continue;
    }

    if (!controllersBySlotIndex[player.slotIndex]) {
      continue;
    }

    const position = getControllerPosition(controllersBySlotIndex, player.slotIndex);
    const distance = distance2d(origin, position);
    if (hasApproximateLineOfSight(origin, position, { maxRange, blockers }) && (selected === null || distance < selected.distance)) {
      selected = Object.freeze({ slotIndex: player.slotIndex, position: freezeVector(position), distance: round(distance) });
    }
  }

  return selected;
}

export function createBotAimDirection({ origin, target, difficulty, slotIndex = 0, tick = 0 } = {}) {
  const direction = normalize2d({ x: target.x - origin.x, z: target.z - origin.z });
  const errorRadians = (difficulty.aimErrorDegrees * Math.PI) / 180;
  const wobble = (((slotIndex * 37 + tick * 17) % 11) - 5) / 5;
  const appliedError = errorRadians * wobble * 0.18;
  const cos = Math.cos(appliedError);
  const sin = Math.sin(appliedError);

  return Object.freeze({
    direction: freezeVector({ x: direction.x * cos - direction.z * sin, y: 0, z: direction.x * sin + direction.z * cos }),
    errorRadians: round(Math.abs(appliedError)),
  });
}

const createControllersForPlayers = (players) => Object.freeze(Object.fromEntries(players.map((player) => {
  return [player.slotIndex, createPlayerControllerState({
    position: MAP_SPAWN_POINTS[player.slotIndex]?.position,
    activeWeaponId: player.loadout?.activeWeaponId ?? DEFAULT_LOADOUT.activeWeaponId,
  })];
})));

export function createBotAiSimulation({ matchState, controllersBySlotIndex, weaponStatesBySlotIndex, tick = matchState?.tick ?? 0 } = {}) {
  const seededPlayers = matchState.players.map((player) => {
    if (player.slotType !== SLOT_TYPES.BOT) return player;
    const loadout = selectBotLoadout({ slotIndex: player.slotIndex, difficultyId: player.bot?.difficultyId ?? DEFAULT_BOT_DIFFICULTY_ID });
    return Object.freeze({ ...player, armor: loadout.equipmentIds.includes(WEAPONS.KEVLAR.id) ? COMBAT_DEFAULTS.maxArmor : player.armor, loadout });
  });
  const seededMatchState = withPlayers(matchState, seededPlayers);
  const controllers = controllersBySlotIndex ?? createControllersForPlayers(seededMatchState.players);
  const weaponStates = weaponStatesBySlotIndex ?? Object.freeze(Object.fromEntries(seededMatchState.players.map((player) => [
    player.slotIndex,
    createWeaponState(player.loadout?.activeWeaponId ?? DEFAULT_LOADOUT.activeWeaponId),
  ])));

  return Object.freeze({
    matchState: seededMatchState,
    controllersBySlotIndex: controllers,
    weaponStatesBySlotIndex: weaponStates,
    tick,
    nowMs: Math.round(tick * BOT_TICK_MS),
    metrics: createBotMetrics(),
  });
}

const getBotPlan = (bot, slotIndex, tick) => {
  if (bot.route.length > 0 && bot.targetWaypointId && tick - bot.stateEnteredTick < bot.difficulty.pathReplanTicks) {
    return bot;
  }

  const plan = createBotPathPlan({ slotIndex, currentWaypointId: bot.currentWaypointId, tick });
  return Object.freeze({ ...bot, ...plan, route: plan.route, movement: Object.freeze({ ...bot.movement, routeIndex: Math.min(1, Math.max(0, plan.route.length - 1)) }) });
};

const chooseUnstuckRoute = (bot, slotIndex, tick) => {
  const links = getWaypointLinks(bot.currentWaypointId);
  const alternateTarget = links.length > 0 ? links[Math.abs(slotIndex + tick) % links.length] : selectDeterministicBotTarget({ slotIndex, tick, candidates: DEFAULT_PATROL_TARGETS });
  const route = findWaypointRoute(bot.currentWaypointId, alternateTarget);
  return Object.freeze({
    ...bot,
    state: BOT_STATE_MACHINE_STATES.NAVIGATING,
    targetWaypointId: alternateTarget,
    route,
    movement: Object.freeze({ ...bot.movement, routeIndex: Math.min(1, Math.max(0, route.length - 1)), blockedTicks: 0, unstuckCount: (bot.movement?.unstuckCount ?? 0) + 1 }),
  });
};

const advanceBotMovement = ({ bot, controller, slotIndex, tick, activeWeaponId, collisionVolumes = undefined }) => {
  const plannedBot = getBotPlan(bot, slotIndex, tick);
  const targetPosition = getRouteTargetPosition(plannedBot);
  const distanceToTarget = distance2d(controller.position, targetPosition);
  let nextBot = plannedBot;

  if (distanceToTarget <= BOT_WAYPOINT_REACHED_RADIUS) {
    const routeIndex = Math.min((plannedBot.movement?.routeIndex ?? 0) + 1, Math.max(0, plannedBot.route.length - 1));
    const currentStep = plannedBot.route[plannedBot.movement?.routeIndex ?? 0];
    nextBot = Object.freeze({
      ...plannedBot,
      currentWaypointId: currentStep?.waypointId ?? getNearestWaypointId(controller.position),
      state: routeIndex >= plannedBot.route.length - 1 ? BOT_STATE_MACHINE_STATES.IDLE : BOT_STATE_MACHINE_STATES.NAVIGATING,
      movement: Object.freeze({ ...plannedBot.movement, routeIndex, blockedTicks: 0 }),
    });
  }

  const nextTargetPosition = getRouteTargetPosition(nextBot);
  const moveDirection = normalize2d({ x: nextTargetPosition.x - controller.position.x, z: nextTargetPosition.z - controller.position.z });
  const yaw = Math.atan2(-moveDirection.x, -moveDirection.z);
  const movedController = simulatePlayerMovementStep(controller, {
    buttons: ['forward'],
    look: { yawDelta: (yaw - controller.view.yaw) / PLAYER_MOVEMENT_DEFAULTS.mouseSensitivity, pitchDelta: 0 },
    activeWeaponId,
    ...(collisionVolumes ? { collisionVolumes } : {}),
  });
  const movedDistance = distance2d(controller.position, movedController.position);
  const blockedTicks = movedController.movement.blocked || movedDistance < 0.005 ? (nextBot.movement?.blockedTicks ?? 0) + 1 : 0;
  const movement = Object.freeze({ ...nextBot.movement, blockedTicks, lastPosition: freezeVector(movedController.position) });

  if (blockedTicks >= BOT_STUCK_TICKS) {
    return Object.freeze({ controller: movedController, bot: chooseUnstuckRoute(Object.freeze({ ...nextBot, movement }), slotIndex, tick), movedDistance, unstuck: true });
  }

  return Object.freeze({ controller: movedController, bot: Object.freeze({ ...nextBot, movement }), movedDistance, unstuck: false });
};

const advanceBotCombat = ({ state, slotIndex, bot, nowMs, tick, blockers }) => {
  const player = state.matchState.players[slotIndex];
  let weaponState = state.weaponStatesBySlotIndex[slotIndex];
  let matchState = state.matchState;
  let metrics = state.metrics;

  if (weaponState?.isReloading && nowMs >= weaponState.reloadCompleteAtMs) {
    weaponState = completeReload(weaponState, nowMs).state;
  }

  const selectedWeapon = getWeaponById(weaponState.weaponId);
  if (weaponState.ammoInMagazine <= 0 && selectedWeapon?.ammo.magazine > 0) {
    const reloadResult = startReload(weaponState, nowMs);
    return Object.freeze({ matchState, weaponState: reloadResult.state, bot: Object.freeze({ ...bot, state: BOT_STATE_MACHINE_STATES.RETREATING_RELOADING }), metrics });
  }

  const visibleTarget = chooseVisibleBotTarget({ matchState, controllersBySlotIndex: state.controllersBySlotIndex, slotIndex, nowMs, maxRange: Math.min(selectedWeapon?.range.max ?? BOT_VISIBLE_RANGE, BOT_VISIBLE_RANGE), blockers });
  if (!visibleTarget) {
    return Object.freeze({
      matchState,
      weaponState,
      bot: Object.freeze({ ...bot, combatIntent: Object.freeze({ ...bot.combatIntent, state: BOT_COMBAT_INTENT_STATES.NONE, targetSlotIndex: null }) }),
      metrics,
    });
  }

  const targetAcquiredTick = bot.combatIntent.targetSlotIndex === visibleTarget.slotIndex ? bot.combatIntent.targetAcquiredTick ?? tick : tick;
  let nextBot = Object.freeze({
    ...bot,
    state: player.health <= BOT_RETREAT_HEALTH ? BOT_STATE_MACHINE_STATES.RETREATING_RELOADING : BOT_STATE_MACHINE_STATES.ENGAGING,
    combatIntent: Object.freeze({
      ...bot.combatIntent,
      state: BOT_COMBAT_INTENT_STATES.ACQUIRING_TARGET,
      targetSlotIndex: visibleTarget.slotIndex,
      targetAcquiredTick,
      lastSeenTick: tick,
      desiredRange: Math.min(visibleTarget.distance, selectedWeapon?.range.falloffStart ?? bot.combatIntent.desiredRange),
    }),
  });

  if (tick - targetAcquiredTick < bot.difficulty.reactionTicks) {
    return Object.freeze({ matchState, weaponState, bot: nextBot, metrics });
  }

  const origin = getControllerPosition(state.controllersBySlotIndex, slotIndex);
  const aim = createBotAimDirection({ origin, target: visibleTarget.position, difficulty: bot.difficulty, slotIndex, tick });
  const combatResult = applyCombatShot(matchState, {
    shooterSlotIndex: slotIndex,
    weaponState,
    controllersBySlotIndex: state.controllersBySlotIndex,
    nowMs,
    seed: slotIndex * 1009 + tick,
    moving: state.controllersBySlotIndex[slotIndex]?.movement?.blocked === false,
    origin,
    direction: aim.direction,
  });

  if (combatResult.ok) {
    metrics = addMetric(metrics, 'shotsFired');
    if (combatResult.shot.hit) metrics = addMetric(metrics, 'shotsHit');
    if (combatResult.damage?.killed) metrics = addMetric(metrics, 'kills');
    if (bot.difficulty.id === BOT_DIFFICULTIES.EASY.id) metrics = addMetric(metrics, 'easyAimErrorRadians', aim.errorRadians);
    if (bot.difficulty.id === BOT_DIFFICULTIES.HARD.id) metrics = addMetric(metrics, 'hardAimErrorRadians', aim.errorRadians);
    matchState = combatResult.matchState;
    weaponState = combatResult.weaponState;
    nextBot = Object.freeze({ ...nextBot, combatIntent: Object.freeze({ ...nextBot.combatIntent, state: BOT_COMBAT_INTENT_STATES.HOLDING_ANGLE }) });
  }

  return Object.freeze({ matchState, weaponState, bot: nextBot, metrics });
};

export function advanceBotAiTick(state, { blockers = MAP_COLLISION_VOLUMES } = {}) {
  const tick = state.tick + 1;
  const nowMs = Math.round(tick * BOT_TICK_MS);
  let previousPlayers = state.matchState.players;
  let matchState = advanceRespawnTimers(Object.freeze({ ...state.matchState, tick }), { nowMs });
  let controllersBySlotIndex = { ...state.controllersBySlotIndex };
  let weaponStatesBySlotIndex = { ...state.weaponStatesBySlotIndex };
  let metrics = state.metrics;

  for (const player of matchState.players) {
    const beforePlayer = previousPlayers[player.slotIndex];
    if (beforePlayer?.lifeState === PLAYER_LIFE_STATES.RESPAWNING && player.lifeState === PLAYER_LIFE_STATES.ALIVE) {
      metrics = addMetric(metrics, 'respawns');
      const spawnPosition = MAP_SPAWN_POINTS[player.slotIndex]?.position ?? WAYPOINTS_BY_ID[player.bot?.currentWaypointId]?.position ?? controllersBySlotIndex[player.slotIndex]?.position;
      controllersBySlotIndex[player.slotIndex] = createPlayerControllerState({ position: spawnPosition, activeWeaponId: player.loadout.activeWeaponId });
      weaponStatesBySlotIndex[player.slotIndex] = createWeaponState(player.loadout.activeWeaponId);
      if (player.bot) {
        matchState = withBotForSlot(matchState, player.slotIndex, { state: BOT_STATE_MACHINE_STATES.NAVIGATING, stateEnteredTick: tick });
      }
    }
    if (beforePlayer?.lifeState === PLAYER_LIFE_STATES.ALIVE && player.lifeState === PLAYER_LIFE_STATES.RESPAWNING) {
      metrics = addMetric(metrics, 'deaths');
    }
  }
  previousPlayers = matchState.players;

  for (const player of matchState.players) {
    if (player.slotType !== SLOT_TYPES.BOT || !player.bot) continue;

    if (player.lifeState !== PLAYER_LIFE_STATES.ALIVE) {
      matchState = withBotForSlot(matchState, player.slotIndex, { state: BOT_STATE_MACHINE_STATES.RESPAWNING });
      continue;
    }

    const controller = controllersBySlotIndex[player.slotIndex] ?? createPlayerControllerState({ activeWeaponId: player.loadout.activeWeaponId });
    const movementResult = advanceBotMovement({ bot: player.bot, controller, slotIndex: player.slotIndex, tick, activeWeaponId: player.loadout.activeWeaponId, collisionVolumes: blockers });
    controllersBySlotIndex[player.slotIndex] = movementResult.controller;
    metrics = addMetric(metrics, 'movementDistance', movementResult.movedDistance);
    if (movementResult.unstuck) metrics = addMetric(metrics, 'unstuckEvents');
    matchState = withBotForSlot(matchState, player.slotIndex, movementResult.bot);

    const combatResult = advanceBotCombat({ state: Object.freeze({ ...state, matchState, controllersBySlotIndex, weaponStatesBySlotIndex, metrics }), slotIndex: player.slotIndex, bot: movementResult.bot, nowMs, tick, blockers });
    matchState = withBotForSlot(combatResult.matchState, player.slotIndex, combatResult.bot);
    weaponStatesBySlotIndex[player.slotIndex] = combatResult.weaponState;
    metrics = combatResult.metrics;

    for (const nextPlayer of matchState.players) {
      const previousPlayer = previousPlayers[nextPlayer.slotIndex];
      if (previousPlayer?.lifeState === PLAYER_LIFE_STATES.ALIVE && nextPlayer.lifeState === PLAYER_LIFE_STATES.RESPAWNING) {
        metrics = addMetric(metrics, 'deaths');
      }
    }
    previousPlayers = matchState.players;
  }

  return Object.freeze({
    matchState,
    controllersBySlotIndex: Object.freeze(controllersBySlotIndex),
    weaponStatesBySlotIndex: Object.freeze(weaponStatesBySlotIndex),
    tick,
    nowMs,
    metrics,
  });
}

export function runBotAiSimulation(initialState, { seconds = 60, blockers = MAP_COLLISION_VOLUMES } = {}) {
  const totalTicks = Math.round(seconds * BOT_TICK_RATE);
  let state = initialState;
  for (let index = 0; index < totalTicks; index += 1) {
    state = advanceBotAiTick(state, { blockers });
  }
  return state;
}
