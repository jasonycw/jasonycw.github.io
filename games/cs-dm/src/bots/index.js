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

// ─── STATE MACHINES ──────────────────────────────────────────────────────────

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
  FLINCHING: 'flinching',
  TAKING_COVER: 'taking-cover',
  PEEKING: 'peeking',
});

// ─── DIFFICULTY ──────────────────────────────────────────────────────────────

export const BOT_DIFFICULTIES = Object.freeze({
  EASY: Object.freeze({ id: 'easy', label: 'Easy', reactionTicks: 20, aimErrorDegrees: 8, pathReplanTicks: 60, aggression: 0.35 }),
  NORMAL: Object.freeze({ id: 'normal', label: 'Normal', reactionTicks: 10, aimErrorDegrees: 4, pathReplanTicks: 35, aggression: 0.65 }),
  HARD: Object.freeze({ id: 'hard', label: 'Hard', reactionTicks: 6, aimErrorDegrees: 2, pathReplanTicks: 25, aggression: 0.85 }),
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

// ─── ZONE DEFINITIONS ────────────────────────────────────────────────────────
// Each zone is a cluster of waypoints defining a tactical area on the map.

const MAP_ZONES = Object.freeze({
  'zone-t-spawn': Object.freeze({
    id: 'zone-t-spawn',
    name: 'T Spawn',
    waypointIds: Object.freeze(['wp-t-spawn', 'wp-long-a-doors']),
    center: { x: 15, z: 85 },
    isEnemySide: false,
  }),
  'zone-long-a': Object.freeze({
    id: 'zone-long-a',
    name: 'Long A',
    waypointIds: Object.freeze(['wp-long-a']),
    center: { x: 72, z: 84 },
    isEnemySide: false,
  }),
  'zone-a-site': Object.freeze({
    id: 'zone-a-site',
    name: 'A Site',
    waypointIds: Object.freeze(['wp-a-site-boxes', 'wp-short-a']),
    center: { x: 82, z: 78 },
    isEnemySide: true,
  }),
  'zone-mid': Object.freeze({
    id: 'zone-mid',
    name: 'Mid',
    waypointIds: Object.freeze(['wp-mid', 'wp-mid-doors', 'wp-xbox']),
    center: { x: 55, z: 55 },
    isEnemySide: false,
  }),
  'zone-tunnels': Object.freeze({
    id: 'zone-tunnels',
    name: 'Tunnels',
    waypointIds: Object.freeze(['wp-upper-tunnels', 'wp-lower-tunnels', 'wp-b-tunnels']),
    center: { x: 26, z: 55 },
    isEnemySide: false,
  }),
  'zone-b-site': Object.freeze({
    id: 'zone-b-site',
    name: 'B Site',
    waypointIds: Object.freeze(['wp-b-site', 'wp-b-doors', 'wp-window']),
    center: { x: 30, z: 20 },
    isEnemySide: true,
  }),
  'zone-ct-spawn': Object.freeze({
    id: 'zone-ct-spawn',
    name: 'CT Spawn',
    waypointIds: Object.freeze(['wp-ct-spawn']),
    center: { x: 86, z: 14 },
    isEnemySide: true,
  }),
});

const ZONE_LIST = Object.values(MAP_ZONES);

// Bi-directional waypoint → zone lookup
const WAYPOINT_TO_ZONE = Object.freeze(
  Object.fromEntries(ZONE_LIST.flatMap((zone) => zone.waypointIds.map((wpId) => [wpId, zone.id])))
);

const getZoneForWaypoint = (waypointId) => WAYPOINT_TO_ZONE[waypointId] ?? 'zone-mid';
const getHomeZoneWaypoint = (zoneId) => {
  const zone = MAP_ZONES[zoneId];
  return zone ? zone.waypointIds[0] : 'wp-mid';
};

// ─── PLAYSTYLE DEFINITIONS ───────────────────────────────────────────────────

export const BOT_PLAYSTYLES = Object.freeze({
  rusher: Object.freeze({
    id: 'rusher',
    name: 'Rusher',
    preferredWeaponCategories: Object.freeze(['rifle']),
    engagementRange: 55,
    aggression: 0.90,
    movementSpeed: 0.92,
    coverEnabled: false,
    reactionTicksBonus: -2,
    replanInterval: 20,
    burstLength: 5,
    crouchFrequency: 0.02,
    description: 'Aggressive pusher — takes fights and chases wounded enemies',
  }),
  anchor: Object.freeze({
    id: 'anchor',
    name: 'Anchor',
    preferredWeaponCategories: Object.freeze(['rifle']),
    engagementRange: 70,
    aggression: 0.45,
    movementSpeed: 0.55,
    coverEnabled: true,
    reactionTicksBonus: 2,
    replanInterval: 60,
    burstLength: 4,
    crouchFrequency: 0.08,
    description: 'Holds a position — only moves when enemies come close',
  }),
  camper: Object.freeze({
    id: 'camper',
    name: 'Camper',
    preferredWeaponCategories: Object.freeze(['sniper', 'rifle']),
    engagementRange: 75,
    aggression: 0.15,
    movementSpeed: 0.08,
    coverEnabled: true,
    reactionTicksBonus: 5,
    replanInterval: 120,
    burstLength: 1,
    crouchFrequency: 0.20,
    description: 'Finds a corner and stays there watching a sightline',
  }),
  awper: Object.freeze({
    id: 'awper',
    name: 'AWPer',
    preferredWeaponCategories: Object.freeze(['sniper']),
    engagementRange: 110,
    aggression: 0.35,
    movementSpeed: 0.30,
    coverEnabled: true,
    reactionTicksBonus: 0,
    replanInterval: 80,
    burstLength: 1,
    crouchFrequency: 0.15,
    description: 'Holds long sightlines with a sniper rifle',
  }),
  support: Object.freeze({
    id: 'support',
    name: 'Support',
    preferredWeaponCategories: Object.freeze(['smg', 'rifle']),
    engagementRange: 45,
    aggression: 0.70,
    movementSpeed: 0.80,
    coverEnabled: false,
    reactionTicksBonus: 0,
    replanInterval: 30,
    burstLength: 8,
    crouchFrequency: 0.03,
    description: 'Roams between zones and follows the action',
  }),
  flanker: Object.freeze({
    id: 'flanker',
    name: 'Flanker',
    preferredWeaponCategories: Object.freeze(['smg', 'rifle']),
    engagementRange: 50,
    aggression: 0.80,
    movementSpeed: 0.88,
    coverEnabled: false,
    reactionTicksBonus: -1,
    replanInterval: 25,
    burstLength: 5,
    crouchFrequency: 0.04,
    description: 'Takes side routes and surprises enemies',
  }),
});

// ─── PLAYSTYLE-TO-SLOT ASSIGNMENTS ──────────────────────────────────────────
// Deterministic — slotIndex 1-15 maps to a unique playstyle + zone pair.

const PLAYSTYLE_ASSIGNMENTS = Object.freeze([
  { playstyleId: 'rusher', zoneId: 'zone-a-site' },
  { playstyleId: 'anchor', zoneId: 'zone-mid' },
  { playstyleId: 'awper', zoneId: 'zone-a-site' },
  { playstyleId: 'camper', zoneId: 'zone-tunnels' },
  { playstyleId: 'support', zoneId: 'zone-b-site' },
  { playstyleId: 'flanker', zoneId: 'zone-ct-spawn' },
  { playstyleId: 'rusher', zoneId: 'zone-b-site' },
  { playstyleId: 'anchor', zoneId: 'zone-t-spawn' },
  { playstyleId: 'support', zoneId: 'zone-a-site' },
  { playstyleId: 'flanker', zoneId: 'zone-tunnels' },
  { playstyleId: 'rusher', zoneId: 'zone-ct-spawn' },
  { playstyleId: 'camper', zoneId: 'zone-long-a' },
  { playstyleId: 'awper', zoneId: 'zone-mid' },
  { playstyleId: 'anchor', zoneId: 'zone-b-site' },
  { playstyleId: 'support', zoneId: 'zone-mid' },
]);

export function getPlaystyleForSlot(slotIndex) {
  const assignment = PLAYSTYLE_ASSIGNMENTS[slotIndex - 1];
  return assignment?.playstyleId ?? 'support';
}

export function getZoneAssignmentForSlot(slotIndex) {
  const assignment = PLAYSTYLE_ASSIGNMENTS[slotIndex - 1];
  return assignment?.zoneId ?? 'zone-mid';
}

// ─── PLAYSTYLE LOADOUTS ──────────────────────────────────────────────────────
// Each playstyle has 3 tiers indexed [easy, normal, hard].

const PLAYSTYLE_LOADOUTS = Object.freeze({
  rusher: Object.freeze([
    Object.freeze({ primary: 'galil', secondary: 'glock18', equipment: Object.freeze(['knife']) }),
    Object.freeze({ primary: 'famas', secondary: 'glock18', equipment: Object.freeze(['knife', 'kevlar']) }),
    Object.freeze({ primary: 'ak47', secondary: 'deagle', equipment: Object.freeze(['knife', 'kevlar']) }),
  ]),
  anchor: Object.freeze([
    Object.freeze({ primary: 'galil', secondary: 'usp', equipment: Object.freeze(['knife']) }),
    Object.freeze({ primary: 'm4a1', secondary: 'usp', equipment: Object.freeze(['knife', 'kevlar']) }),
    Object.freeze({ primary: 'aug', secondary: 'deagle', equipment: Object.freeze(['knife', 'kevlar']) }),
  ]),
  camper: Object.freeze([
    Object.freeze({ primary: 'scout', secondary: 'usp', equipment: Object.freeze(['knife']) }),
    Object.freeze({ primary: 'scout', secondary: 'usp', equipment: Object.freeze(['knife', 'kevlar']) }),
    Object.freeze({ primary: 'awp', secondary: 'deagle', equipment: Object.freeze(['knife', 'kevlar']) }),
  ]),
  awper: Object.freeze([
    Object.freeze({ primary: 'scout', secondary: 'usp', equipment: Object.freeze(['knife']) }),
    Object.freeze({ primary: 'sg550', secondary: 'fiveseven', equipment: Object.freeze(['knife', 'kevlar']) }),
    Object.freeze({ primary: 'awp', secondary: 'deagle', equipment: Object.freeze(['knife', 'kevlar']) }),
  ]),
  support: Object.freeze([
    Object.freeze({ primary: 'tmp', secondary: 'glock18', equipment: Object.freeze(['knife']) }),
    Object.freeze({ primary: 'mp5', secondary: 'p228', equipment: Object.freeze(['knife', 'kevlar']) }),
    Object.freeze({ primary: 'ump45', secondary: 'fiveseven', equipment: Object.freeze(['knife', 'kevlar']) }),
  ]),
  flanker: Object.freeze([
    Object.freeze({ primary: 'mac10', secondary: 'elite', equipment: Object.freeze(['knife']) }),
    Object.freeze({ primary: 'tmp', secondary: 'deagle', equipment: Object.freeze(['knife', 'kevlar']) }),
    Object.freeze({ primary: 'galil', secondary: 'deagle', equipment: Object.freeze(['knife', 'kevlar']) }),
  ]),
});

// Legacy loadouts kept for backward compatibility
const BOT_LOADOUTS = Object.freeze([
  Object.freeze({ primaryWeaponId: WEAPONS.AK47.id, secondaryWeaponId: WEAPONS.GLOCK18.id, equipmentIds: Object.freeze([WEAPONS.KNIFE.id, WEAPONS.KEVLAR.id]), activeWeaponId: WEAPONS.AK47.id }),
  Object.freeze({ primaryWeaponId: WEAPONS.M4A1.id, secondaryWeaponId: WEAPONS.USP.id, equipmentIds: Object.freeze([WEAPONS.KNIFE.id, WEAPONS.KEVLAR.id]), activeWeaponId: WEAPONS.M4A1.id }),
  Object.freeze({ primaryWeaponId: WEAPONS.MP5.id, secondaryWeaponId: WEAPONS.DEAGLE.id, equipmentIds: Object.freeze([WEAPONS.KNIFE.id, WEAPONS.KEVLAR.id]), activeWeaponId: WEAPONS.MP5.id }),
]);

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const WAYPOINTS_BY_ID = Object.freeze(Object.fromEntries(MAP_WAYPOINTS.map((waypoint) => [waypoint.id, waypoint])));
const DEFAULT_PATROL_TARGETS = Object.freeze(['wp-b-site', 'wp-mid', 'wp-a-site-boxes', 'wp-long-a', 'wp-window']);
const BOT_TICK_RATE = 60;
const BOT_TICK_MS = 1000 / BOT_TICK_RATE;
const BOT_WAYPOINT_REACHED_RADIUS = 1.4;
const BOT_STUCK_TICKS = 18;
const BOT_VISIBLE_RANGE = 70;
const BOT_RETREAT_HEALTH = 35;
const BOT_MAX_YAW_RADIANS_PER_TICK = (150 * Math.PI / 180) / BOT_TICK_RATE;
const BOT_FLINCH_DURATION_TICKS = 4;
const BOT_BURST_RESET_TICKS = 4;

// ─── CONTRACT DOCS ───────────────────────────────────────────────────────────

export const BOT_SLOT_CONTRACT = Object.freeze({
  slotType: SLOT_TYPES.BOT,
  lifecycle: 'idle | navigating | engaging | retreating/reloading | dead | respawning',
  difficultyId: 'easy | normal | hard',
  currentWaypointId: 'id from MAP_ROUTE_GRAPH.anchors',
  targetWaypointId: 'id from MAP_ROUTE_GRAPH.anchors or null',
  route: 'array of waypoint route steps; movement execution is deferred to T21',
  combatIntent: 'non-shooting intent state with targetSlotIndex and desiredRange only',
  handoff: 'remote replacement fields: canBeReplacedByRemote, reservedForRemotePeerId, replacementToken, replacedByRemoteSlotId, handoffTick',
  playstyleId: 'rusher | anchor | camper | awper | support | flanker',
  homeZoneId: 'zone id from MAP_ZONES',
  lastHealth: 'tracked health for hit detection',
  burstShotsFired: 'shots in current burst',
  lastBurstTick: 'tick of last shot in burst',
  coverPosition: 'temporary movement target behind cover or null',
  lastHitTick: 'tick when bot was last hit or null',
  lastHitDirection: 'normalized direction toward attacker or null',
});

export const WAYPOINT_GRAPH_CONTRACT = Object.freeze({
  graph: MAP_ROUTE_GRAPH,
  anchors: 'MAP_ROUTE_GRAPH.anchors reused from map module',
  routeShape: 'array of waypoint ids from start to target, inclusive',
  selection: 'deterministic target helper derived from slotIndex and tick',
});

// ─── EXPORTED UTILITY FUNCTIONS ──────────────────────────────────────────────

export function getBotNameForSlot(slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex <= LOCAL_PLAYER_SLOT_INDEX || slotIndex >= MAX_PLAYER_SLOTS) {
    throw new RangeError('Bot slot index must be 1..15.');
  }
  return BOT_NAMES[slotIndex - 1];
}

export function createBotRuntimeContract({
  slotIndex,
  difficultyId = DEFAULT_BOT_DIFFICULTY_ID,
  currentWaypointId = null,
  targetWaypointId = null,
  route = Object.freeze([]),
  state = BOT_STATE_MACHINE_STATES.IDLE,
  tick = 0,
} = {}) {
  if (!Object.values(BOT_DIFFICULTIES).some((difficulty) => difficulty.id === difficultyId)) {
    throw new RangeError(`Unknown bot difficulty: ${difficultyId}`);
  }

  const playstyleId = getPlaystyleForSlot(slotIndex);
  const homeZoneId = getZoneAssignmentForSlot(slotIndex);
  const homeWp = currentWaypointId || getHomeZoneWaypoint(homeZoneId);

  return Object.freeze({
    state,
    previousState: null,
    difficultyId,
    difficulty: BOT_DIFFICULTIES[difficultyId.toUpperCase()],
    stateEnteredTick: tick,
    currentWaypointId: homeWp,
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
    playstyleId,
    homeZoneId,
    lastHealth: 100,
    burstShotsFired: 0,
    lastBurstTick: 0,
    coverPosition: null,
    lastHitTick: null,
    lastHitDirection: null,
  });
}

export function selectBotLoadout({ slotIndex, difficultyId = DEFAULT_BOT_DIFFICULTY_ID, playstyleId: explicitPlaystyle } = {}) {
  const playstyleId = explicitPlaystyle || getPlaystyleForSlot(slotIndex);
  const difficultyIndex = difficultyId === BOT_DIFFICULTIES.HARD.id ? 2 : difficultyId === BOT_DIFFICULTIES.EASY.id ? 0 : 1;
  const loadoutDef = PLAYSTYLE_LOADOUTS[playstyleId]?.[difficultyIndex];

  if (!loadoutDef) {
    // Fallback for unknown combo
    const difficultyOffset = difficultyId === BOT_DIFFICULTIES.HARD.id ? 1 : difficultyId === BOT_DIFFICULTIES.EASY.id ? 2 : 0;
    return BOT_LOADOUTS[Math.abs(slotIndex + difficultyOffset) % BOT_LOADOUTS.length] ?? DEFAULT_LOADOUT;
  }

  return Object.freeze({
    primaryWeaponId: loadoutDef.primary,
    secondaryWeaponId: loadoutDef.secondary,
    equipmentIds: Object.freeze([...loadoutDef.equipment]),
    activeWeaponId: loadoutDef.primary,
  });
}

export function createBotSlotFields({ slotIndex, difficultyId = DEFAULT_BOT_DIFFICULTY_ID, currentWaypointId = null } = {}) {
  return Object.freeze({
    bot: createBotRuntimeContract({ slotIndex, difficultyId, currentWaypointId }),
  });
}

export function listOfflineBotSlotIndexes() {
  return Object.freeze(Array.from({ length: BOT_SLOT_COUNT }, (_, index) => index + 1));
}

export function selectDeterministicBotTarget({ slotIndex = 1, tick = 0, candidates = DEFAULT_PATROL_TARGETS } = {}) {
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

export function createBotPathPlan({ slotIndex = 1, currentWaypointId = 'wp-t-spawn', tick = 0 } = {}) {
  const targetWaypointId = selectDeterministicBotTarget({ slotIndex, tick });
  const route = findWaypointRoute(currentWaypointId, targetWaypointId);

  return Object.freeze({
    currentWaypointId,
    targetWaypointId,
    route,
    state: route.length > 1 ? BOT_STATE_MACHINE_STATES.NAVIGATING : BOT_STATE_MACHINE_STATES.IDLE,
  });
}

export function getCisternTunnelRouteToCisternCourt() {
  return findWaypointRoute('wp-t-spawn', 'wp-b-site');
}

export function isTunnelWaypoint(routeStep) {
  return routeStep.calloutId === MAP_LANDMARKS.UPPER_TUNNELS.id
    || routeStep.calloutId === MAP_LANDMARKS.LOWER_TUNNELS.id
    || routeStep.calloutId === MAP_LANDMARKS.B_TUNNELS.id;
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

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

const round = (value) => Number(value.toFixed(6));
const freezeVector = (vector) => Object.freeze({ x: round(vector.x), y: round(vector.y), z: round(vector.z) });
const distance2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const normalize2d = (vector) => {
  const length = Math.hypot(vector.x, vector.z);
  return length === 0 ? { x: 0, z: 1 } : { x: vector.x / length, z: vector.z / length };
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const freezeRouteStep = (waypoint) => Object.freeze({
  waypointId: waypoint.id,
  calloutId: waypoint.calloutId,
  position: waypoint.position,
});

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

const withPlayerBot = (player, botFields) => Object.freeze({ ...player, bot: Object.freeze({ ...player.bot, ...botFields }) });
const withPlayers = (matchState, players) => Object.freeze({ ...matchState, players: Object.freeze(players) });
const withBotForSlot = (matchState, slotIndex, botFields) => withPlayers(matchState, matchState.players.map((player, index) => (
  index === slotIndex && player.bot ? withPlayerBot(player, botFields) : player
)));

// ─── PLAYSTYLE TARGET SELECTION ──────────────────────────────────────────────

function selectPlaystyleTarget(bot, slotIndex, tick) {
  const playstyle = BOT_PLAYSTYLES[bot.playstyleId];
  const homeZone = MAP_ZONES[bot.homeZoneId];

  if (!homeZone || !playstyle) {
    return selectDeterministicBotTarget({ slotIndex, tick });
  }

  const rng = (offset) => Math.abs((slotIndex * 137 + tick * 73 + offset * 31) % 1000) / 1000;

  switch (bot.playstyleId) {
    case 'rusher': {
      // Push toward enemy-side zones
      const enemyZones = ZONE_LIST.filter((z) => z.isEnemySide);
      const idx = Math.floor(rng(0) * enemyZones.length);
      const zone = enemyZones[idx % enemyZones.length];
      const wpIdx = Math.floor(rng(1) * zone.waypointIds.length);
      return zone.waypointIds[wpIdx % zone.waypointIds.length];
    }
    case 'anchor': {
      // Stay within own zone
      const wpIdx = Math.floor(rng(0) * homeZone.waypointIds.length);
      return homeZone.waypointIds[wpIdx % homeZone.waypointIds.length];
    }
    case 'camper': {
      // Stay at the first waypoint of home zone (barely move)
      return homeZone.waypointIds[0];
    }
    case 'awper': {
      // Hold long sightlines
      const longRangeZones = ['zone-a-site', 'zone-mid', 'zone-long-a', 'zone-b-site'];
      const zoneId = longRangeZones[Math.floor(rng(0) * longRangeZones.length)];
      const targetZone = MAP_ZONES[zoneId];
      if (targetZone) { return targetZone.waypointIds[0]; }
      return homeZone.waypointIds[0];
    }
    case 'support': {
      // Roam: pick a random zone different from current
      const otherZones = ZONE_LIST.filter((z) => z.id !== bot.homeZoneId);
      const idx = Math.floor(rng(0) * otherZones.length);
      const zone = otherZones[idx % otherZones.length];
      const wpIdx = Math.floor(rng(1) * zone.waypointIds.length);
      return zone.waypointIds[wpIdx % zone.waypointIds.length];
    }
    case 'flanker': {
      // Take side routes
      const flankZones = ['zone-tunnels', 'zone-long-a', 'zone-ct-spawn', 'zone-a-site'];
      const zoneId = flankZones[Math.floor(rng(0) * flankZones.length)];
      const targetZone = MAP_ZONES[zoneId];
      if (targetZone) {
        const wpIdx = Math.floor(rng(1) * targetZone.waypointIds.length);
        return targetZone.waypointIds[wpIdx % targetZone.waypointIds.length];
      }
      return homeZone.waypointIds[0];
    }
    default:
      return selectDeterministicBotTarget({ slotIndex, tick });
  }
}

// ─── COVER SYSTEM ────────────────────────────────────────────────────────────

export function findNearestCover({ origin, threatDirection, blockers = MAP_COLLISION_VOLUMES } = {}) {
  if (!origin || !threatDirection || blockers.length === 0) {
    return null;
  }

  let bestCover = null;
  let bestScore = -Infinity;

  for (const blocker of blockers) {
    if (blocker.kind !== 'box') continue;

    const toOrigin = normalize2d({
      x: origin.x - blocker.center.x,
      z: origin.z - blocker.center.z,
    });

    const alignment = toOrigin.x * threatDirection.x + toOrigin.z * threatDirection.z;
    if (alignment < 0.2) continue;

    const distance = distance2d(origin, blocker.center);
    if (distance > 30 || distance < 2) continue;

    const coverSize = blocker.size.width * blocker.size.depth;
    const score = alignment * 10 + Math.min(coverSize, 50) - distance * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestCover = blocker;
    }
  }

  if (!bestCover) return null;

  const toBot = normalize2d({
    x: origin.x - bestCover.center.x,
    z: origin.z - bestCover.center.z,
  });

  const halfWidth = bestCover.size.width / 2;
  const halfDepth = bestCover.size.depth / 2;

  const offsetX = toBot.x * (Math.max(halfWidth, halfDepth) + 1.2);
  const offsetZ = toBot.z * (Math.max(halfWidth, halfDepth) + 1.2);

  const coverPosition = {
    x: bestCover.center.x + offsetX,
    y: origin.y,
    z: bestCover.center.z + offsetZ,
  };

  return Object.freeze({
    position: freezeVector(coverPosition),
    volume: bestCover,
  });
}

// ─── VISIBILITY / AIM FUNCTIONS ──────────────────────────────────────────────

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
  return !blockers.some((blocker) => blocker.kind === 'box'
    && distance2d(origin, blocker.center) > 3
    && distance2d(target, blocker.center) > 3
    && segmentIntersectsBox2d(origin, target, blocker));
}

export function chooseVisibleBotTarget({ matchState, controllersBySlotIndex, slotIndex, nowMs = 0, maxRange = BOT_VISIBLE_RANGE, blockers = [] } = {}) {
  const origin = getControllerPosition(controllersBySlotIndex, slotIndex);
  let selected = null;

  for (const player of matchState.players) {
    if (player.slotIndex === slotIndex || player.lifeState !== PLAYER_LIFE_STATES.ALIVE || player.spawnProtectionUntilMs > nowMs) {
      continue;
    }
    if (!controllersBySlotIndex[player.slotIndex]) { continue; }

    const position = getControllerPosition(controllersBySlotIndex, player.slotIndex);
    const distance = distance2d(origin, position);
    if (hasApproximateLineOfSight(origin, position, { maxRange, blockers })
      && (selected === null || distance < selected.distance)) {
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

// ─── MOVEMENT FUNCTIONS ──────────────────────────────────────────────────────

const createRouteTargetPosition = (bot) => bot.route[Math.min(bot.movement?.routeIndex ?? 0, Math.max(0, bot.route.length - 1))]?.position
  ?? WAYPOINTS_BY_ID[bot.targetWaypointId]?.position
  ?? WAYPOINTS_BY_ID[bot.currentWaypointId]?.position;

const getBotTargetPosition = (bot) => {
  if (bot.coverPosition && bot.combatIntent.state === BOT_COMBAT_INTENT_STATES.TAKING_COVER) {
    return bot.coverPosition;
  }
  return createRouteTargetPosition(bot);
};

const getBotPlan = (bot, slotIndex, tick) => {
  const playstyle = BOT_PLAYSTYLES[bot.playstyleId] ?? BOT_PLAYSTYLES.support;
  const replanInterval = playstyle.replanInterval;

  // Don't replan during active combat movement (cover, etc.)
  if (bot.combatIntent.state !== BOT_COMBAT_INTENT_STATES.NONE
    && bot.combatIntent.state !== BOT_COMBAT_INTENT_STATES.DISENGAGING
    && bot.state === BOT_STATE_MACHINE_STATES.ENGAGING) {
    return bot;
  }

  // If retreating, target home zone
  if (bot.state === BOT_STATE_MACHINE_STATES.RETREATING_RELOADING) {
    const homeWp = getHomeZoneWaypoint(bot.homeZoneId);
    if (bot.targetWaypointId !== homeWp || tick - bot.stateEnteredTick >= replanInterval) {
      const route = findWaypointRoute(bot.currentWaypointId, homeWp);
      return Object.freeze({
        ...bot,
        targetWaypointId: homeWp,
        route,
        state: BOT_STATE_MACHINE_STATES.NAVIGATING,
        stateEnteredTick: tick,
        movement: Object.freeze({ ...bot.movement, routeIndex: 0 }),
      });
    }
    return bot;
  }

  // Normal replan with playstyle interval
  if (bot.route.length > 0 && bot.targetWaypointId && tick - bot.stateEnteredTick < replanInterval) {
    return bot;
  }

  const targetWaypointId = selectPlaystyleTarget(bot, slotIndex, tick);
  const route = findWaypointRoute(bot.currentWaypointId, targetWaypointId);

  return Object.freeze({
    ...bot,
    targetWaypointId,
    route,
    state: route.length > 1 ? BOT_STATE_MACHINE_STATES.NAVIGATING : BOT_STATE_MACHINE_STATES.IDLE,
    stateEnteredTick: tick,
    movement: Object.freeze({ ...bot.movement, routeIndex: 0 }),
  });
};

const chooseUnstuckRoute = (bot, slotIndex, tick) => {
  const links = getWaypointLinks(bot.currentWaypointId);
  const alternateTarget = links.length > 0
    ? links[Math.abs(slotIndex + tick) % links.length]
    : selectDeterministicBotTarget({ slotIndex, tick, candidates: DEFAULT_PATROL_TARGETS });
  const route = findWaypointRoute(bot.currentWaypointId, alternateTarget);
  return Object.freeze({
    ...bot,
    state: BOT_STATE_MACHINE_STATES.NAVIGATING,
    targetWaypointId: alternateTarget,
    route,
    movement: Object.freeze({ ...bot.movement, routeIndex: 0, blockedTicks: 0, unstuckCount: (bot.movement?.unstuckCount ?? 0) + 1 }),
  });
};

const getMoveButtons = (bot, slotIndex, tick) => {
  const playstyle = BOT_PLAYSTYLES[bot.playstyleId] ?? BOT_PLAYSTYLES.support;

  // Flinch: random strafe/back movement
  if (bot.combatIntent.state === BOT_COMBAT_INTENT_STATES.FLINCHING) {
    const flinchDir = Math.abs(slotIndex * 13 + tick * 7) % 4;
    switch (flinchDir) {
      case 0: return ['back'];
      case 1: return ['left', 'back'];
      case 2: return ['right'];
      case 3: return ['back'];
      default: return ['back'];
    }
  }

  // Taking cover: move forward toward cover
  if (bot.coverPosition && bot.combatIntent.state === BOT_COMBAT_INTENT_STATES.TAKING_COVER) {
    const shouldCrouch = playstyle.crouchFrequency > 0
      && Math.abs(slotIndex * 71 + tick * 43) % 100 < playstyle.crouchFrequency * 100;
    return shouldCrouch ? ['forward', 'crouch'] : ['forward'];
  }

  // Not navigating — stand still
  if (bot.state !== BOT_STATE_MACHINE_STATES.NAVIGATING
    && bot.state !== BOT_STATE_MACHINE_STATES.RETREATING_RELOADING) {
    return [];
  }

  // Playstyle-based movement speed
  const shouldMove = (Math.abs(slotIndex * 137 + tick * 73) % 1000) / 1000 < playstyle.movementSpeed;
  if (!shouldMove) return [];

  const isSniper = playstyle.preferredWeaponCategories.includes('sniper');
  if (isSniper && Math.abs(slotIndex * 53 + tick * 31) % 100 < 40) {
    return ['forward', 'crouch'];
  }

  // Strafing for flankers
  if (bot.playstyleId === 'flanker' && Math.abs(slotIndex * 97 + tick * 61) % 100 < 25) {
    const strafeRight = Math.abs(slotIndex * 43 + tick * 29) % 2 === 0;
    return strafeRight ? ['forward', 'right'] : ['forward', 'left'];
  }

  return ['forward'];
};

const advanceBotMovement = ({ bot, controller, slotIndex, tick, activeWeaponId, collisionVolumes = undefined }) => {
  const plannedBot = getBotPlan(bot, slotIndex, tick);
  const targetPosition = getBotTargetPosition(plannedBot);
  const distanceToTarget = distance2d(controller.position, targetPosition);
  let nextBot = plannedBot;

  if (distanceToTarget <= BOT_WAYPOINT_REACHED_RADIUS) {
    if (nextBot.coverPosition && nextBot.combatIntent.state === BOT_COMBAT_INTENT_STATES.TAKING_COVER) {
      // Reached cover
      nextBot = Object.freeze({
        ...nextBot,
        coverPosition: null,
        combatIntent: Object.freeze({ ...nextBot.combatIntent, state: BOT_COMBAT_INTENT_STATES.HOLDING_ANGLE }),
      });
    } else {
      const routeIndex = Math.min((plannedBot.movement?.routeIndex ?? 0) + 1, Math.max(0, plannedBot.route.length - 1));
      const currentStep = plannedBot.route[plannedBot.movement?.routeIndex ?? 0];
      nextBot = Object.freeze({
        ...plannedBot,
        currentWaypointId: currentStep?.waypointId ?? getNearestWaypointId(controller.position),
        state: routeIndex >= plannedBot.route.length - 1 ? BOT_STATE_MACHINE_STATES.IDLE : BOT_STATE_MACHINE_STATES.NAVIGATING,
        movement: Object.freeze({ ...plannedBot.movement, routeIndex, blockedTicks: 0 }),
      });
    }
  }

  const nextTargetPosition = getBotTargetPosition(nextBot);
  const moveDirection = normalize2d({ x: nextTargetPosition.x - controller.position.x, z: nextTargetPosition.z - controller.position.z });
  const desiredYaw = Math.atan2(-moveDirection.x, -moveDirection.z);
  const yawDelta = clamp(normalizeAngle(desiredYaw - controller.view.yaw), -BOT_MAX_YAW_RADIANS_PER_TICK, BOT_MAX_YAW_RADIANS_PER_TICK);

  const buttons = getMoveButtons(nextBot, slotIndex, tick);

  const movedController = simulatePlayerMovementStep(controller, {
    buttons,
    look: { yawDelta: yawDelta / PLAYER_MOVEMENT_DEFAULTS.mouseSensitivity, pitchDelta: 0 },
    activeWeaponId,
    collisionVolumes,
  });

  const movedDistance = distance2d(controller.position, movedController.position);
  const blockedTicks = movedController.movement.blocked || movedDistance < 0.005 ? (nextBot.movement?.blockedTicks ?? 0) + 1 : 0;
  const movement = Object.freeze({ ...nextBot.movement, blockedTicks, lastPosition: freezeVector(movedController.position) });

  if (blockedTicks >= BOT_STUCK_TICKS) {
    return Object.freeze({
      controller: movedController,
      bot: chooseUnstuckRoute(Object.freeze({ ...nextBot, movement }), slotIndex, tick),
      movedDistance,
      unstuck: true,
    });
  }

  return Object.freeze({ controller: movedController, bot: Object.freeze({ ...nextBot, movement }), movedDistance, unstuck: false });
};

// ─── COMBAT FUNCTIONS ────────────────────────────────────────────────────────

const advanceBotCombat = ({ state, slotIndex, bot, nowMs, tick, blockers }) => {
  const player = state.matchState.players[slotIndex];
  let weaponState = state.weaponStatesBySlotIndex[slotIndex];
  let matchState = state.matchState;
  let metrics = state.metrics;
  let currentBot = bot;

  // ── 1. Complete reload if done ──
  if (weaponState?.isReloading && nowMs >= weaponState.reloadCompleteAtMs) {
    weaponState = completeReload(weaponState, nowMs).state;
  }

  const selectedWeapon = getWeaponById(weaponState.weaponId);

  // ── 2. Start reload if empty ──
  if (weaponState.ammoInMagazine <= 0 && selectedWeapon?.ammo.magazine > 0) {
    const reloadResult = startReload(weaponState, nowMs);
    return Object.freeze({
      matchState,
      weaponState: reloadResult.state,
      bot: Object.freeze({ ...currentBot, state: BOT_STATE_MACHINE_STATES.RETREATING_RELOADING }),
      metrics,
    });
  }

  // ── 3. Handle flinch (reaction to being hit) ──
  if (currentBot.combatIntent.state === BOT_COMBAT_INTENT_STATES.FLINCHING) {
    const flinchTicks = tick - (currentBot.lastHitTick ?? tick);
    if (flinchTicks < BOT_FLINCH_DURATION_TICKS) {
      return Object.freeze({ matchState, weaponState, bot: currentBot, metrics });
    }
    const playstyle = BOT_PLAYSTYLES[currentBot.playstyleId] ?? BOT_PLAYSTYLES.support;
    currentBot = Object.freeze({
      ...currentBot,
      combatIntent: Object.freeze({
        ...currentBot.combatIntent,
        state: playstyle.coverEnabled ? BOT_COMBAT_INTENT_STATES.TAKING_COVER : BOT_COMBAT_INTENT_STATES.HOLDING_ANGLE,
      }),
    });
  }

  // ── 4. Find visible target ──
  const playstyle = BOT_PLAYSTYLES[currentBot.playstyleId] ?? BOT_PLAYSTYLES.support;
  const effectiveReactionTicks = Math.max(1, currentBot.difficulty.reactionTicks + (playstyle.reactionTicksBonus ?? 0));

  const visibleTarget = chooseVisibleBotTarget({
    matchState,
    controllersBySlotIndex: state.controllersBySlotIndex,
    slotIndex,
    nowMs,
    maxRange: Math.min(selectedWeapon?.range.max ?? playstyle.engagementRange, playstyle.engagementRange),
    blockers,
  });

  if (!visibleTarget) {
    if (currentBot.combatIntent.state !== BOT_COMBAT_INTENT_STATES.NONE) {
      currentBot = Object.freeze({
        ...currentBot,
        coverPosition: null,
        combatIntent: Object.freeze({
          state: BOT_COMBAT_INTENT_STATES.NONE,
          targetSlotIndex: null,
          lastSeenTick: null,
          desiredRange: 18,
          targetAcquiredTick: null,
        }),
      });
    }
    return Object.freeze({ matchState, weaponState, bot: currentBot, metrics });
  }

  const targetAcquiredTick = currentBot.combatIntent.targetSlotIndex === visibleTarget.slotIndex
    ? currentBot.combatIntent.targetAcquiredTick ?? tick
    : tick;

  const origin = getControllerPosition(state.controllersBySlotIndex, slotIndex);
  const threatDirection = normalize2d({
    x: origin.x - visibleTarget.position.x,
    z: origin.z - visibleTarget.position.z,
  });

  // ── 5. Calculate cover if appropriate ──
  const shouldTakeCover = playstyle.coverEnabled
    && currentBot.coverPosition === null
    && currentBot.combatIntent.state !== BOT_COMBAT_INTENT_STATES.HOLDING_ANGLE
    && currentBot.combatIntent.state !== BOT_COMBAT_INTENT_STATES.TAKING_COVER
    && (currentBot.lastHitTick !== null && tick - currentBot.lastHitTick < 40
      || currentBot.combatIntent.state === BOT_COMBAT_INTENT_STATES.FLINCHING
      || currentBot.combatIntent.state === BOT_COMBAT_INTENT_STATES.ACQUIRING_TARGET);

  if (shouldTakeCover && currentBot.coverPosition === null) {
    const coverResult = findNearestCover({ origin, threatDirection, blockers });
    if (coverResult) {
      currentBot = Object.freeze({
        ...currentBot,
        coverPosition: coverResult.position,
        combatIntent: Object.freeze({
          state: BOT_COMBAT_INTENT_STATES.TAKING_COVER,
          targetSlotIndex: visibleTarget.slotIndex,
          lastSeenTick: tick,
          desiredRange: Math.min(visibleTarget.distance, selectedWeapon?.range.falloffStart ?? playstyle.engagementRange),
          targetAcquiredTick,
        }),
      });
      return Object.freeze({ matchState, weaponState, bot: currentBot, metrics });
    }
  }

  // ── 6. Still moving to cover ──
  if (currentBot.combatIntent.state === BOT_COMBAT_INTENT_STATES.TAKING_COVER) {
    return Object.freeze({ matchState, weaponState, bot: currentBot, metrics });
  }

  // ── 7. Reaction delay ──
  if (tick - targetAcquiredTick < effectiveReactionTicks) {
    currentBot = Object.freeze({
      ...currentBot,
      combatIntent: Object.freeze({
        state: BOT_COMBAT_INTENT_STATES.ACQUIRING_TARGET,
        targetSlotIndex: visibleTarget.slotIndex,
        lastSeenTick: tick,
        desiredRange: Math.min(visibleTarget.distance, selectedWeapon?.range.falloffStart ?? playstyle.engagementRange),
        targetAcquiredTick,
      }),
    });
    return Object.freeze({ matchState, weaponState, bot: currentBot, metrics });
  }

  // ── 8. Engagement range check ──
  if (visibleTarget.distance > playstyle.engagementRange) {
    currentBot = Object.freeze({
      ...currentBot,
      combatIntent: Object.freeze({
        ...currentBot.combatIntent,
        state: BOT_COMBAT_INTENT_STATES.ACQUIRING_TARGET,
        targetSlotIndex: visibleTarget.slotIndex,
        lastSeenTick: tick,
        targetAcquiredTick,
      }),
    });
    return Object.freeze({ matchState, weaponState, bot: currentBot, metrics });
  }

  // ── 9. Burst fire control ──
  const isRifle = selectedWeapon?.category === 'rifle';
  const isSniper = selectedWeapon?.category === 'sniper';
  const isSMG = selectedWeapon?.category === 'smg';
  const isShotgun = selectedWeapon?.category === 'shotgun';

  const burstLimit = isSniper ? 1
    : isShotgun ? 1
    : isRifle ? playstyle.burstLength
    : isSMG ? Math.min(playstyle.burstLength, 10)
    : 3;

  if (currentBot.burstShotsFired > 0 && tick - currentBot.lastBurstTick > BOT_BURST_RESET_TICKS) {
    currentBot = Object.freeze({ ...currentBot, burstShotsFired: 0 });
  }

  if (currentBot.burstShotsFired >= burstLimit && isRifle) {
    currentBot = Object.freeze({ ...currentBot, burstShotsFired: 0 });
    return Object.freeze({ matchState, weaponState, bot: currentBot, metrics });
  }

  // ── 10. Fire! ──
  const aim = createBotAimDirection({ origin, target: visibleTarget.position, difficulty: currentBot.difficulty, slotIndex, tick });
  const moving = state.controllersBySlotIndex[slotIndex]?.movement?.blocked === false && currentBot.coverPosition === null;

  const combatResult = applyCombatShot(matchState, {
    shooterSlotIndex: slotIndex,
    weaponState,
    controllersBySlotIndex: state.controllersBySlotIndex,
    nowMs,
    seed: slotIndex * 1009 + tick,
    moving,
    origin,
    direction: aim.direction,
  });

  if (combatResult.ok) {
    metrics = addMetric(metrics, 'shotsFired');
    if (combatResult.shot.hit) metrics = addMetric(metrics, 'shotsHit');
    if (combatResult.damage?.killed) metrics = addMetric(metrics, 'kills');
    if (currentBot.difficulty.id === BOT_DIFFICULTIES.EASY.id) metrics = addMetric(metrics, 'easyAimErrorRadians', aim.errorRadians);
    if (currentBot.difficulty.id === BOT_DIFFICULTIES.HARD.id) metrics = addMetric(metrics, 'hardAimErrorRadians', aim.errorRadians);
    matchState = combatResult.matchState;
    weaponState = combatResult.weaponState;

    currentBot = Object.freeze({
      ...currentBot,
      burstShotsFired: (currentBot.burstShotsFired || 0) + 1,
      lastBurstTick: tick,
      combatIntent: Object.freeze({
        ...currentBot.combatIntent,
        state: BOT_COMBAT_INTENT_STATES.HOLDING_ANGLE,
        targetSlotIndex: visibleTarget.slotIndex,
        lastSeenTick: tick,
        targetAcquiredTick,
      }),
    });
  }

  // ── 11. Low health retreat ──
  if (player.health <= BOT_RETREAT_HEALTH && currentBot.combatIntent.state !== BOT_COMBAT_INTENT_STATES.DISENGAGING) {
    if (playstyle.aggression < 0.8 || !combatResult?.damage?.killed) {
      currentBot = Object.freeze({
        ...currentBot,
        state: BOT_STATE_MACHINE_STATES.RETREATING_RELOADING,
        coverPosition: null,
        combatIntent: Object.freeze({
          ...currentBot.combatIntent,
          state: BOT_COMBAT_INTENT_STATES.DISENGAGING,
        }),
      });
    }
  }

  return Object.freeze({ matchState, weaponState, bot: currentBot, metrics });
};

// ─── MAIN SIMULATION FUNCTIONS ───────────────────────────────────────────────

const createControllersForPlayers = (players) => Object.freeze(Object.fromEntries(players.map((player) => {
  return [player.slotIndex, createPlayerControllerState({
    position: MAP_SPAWN_POINTS[player.slotIndex]?.position,
    activeWeaponId: player.loadout?.activeWeaponId ?? DEFAULT_LOADOUT.activeWeaponId,
  })];
})));

export function createBotAiSimulation({ matchState, controllersBySlotIndex, weaponStatesBySlotIndex, tick = matchState?.tick ?? 0 } = {}) {
  const seededPlayers = matchState.players.map((player) => {
    if (player.slotType !== SLOT_TYPES.BOT) return player;
    const loadout = selectBotLoadout({
      slotIndex: player.slotIndex,
      difficultyId: player.bot?.difficultyId ?? DEFAULT_BOT_DIFFICULTY_ID,
      playstyleId: player.bot?.playstyleId,
    });
    return Object.freeze({
      ...player,
      armor: loadout.equipmentIds.includes(WEAPONS.KEVLAR.id) ? COMBAT_DEFAULTS.maxArmor : player.armor,
      loadout,
    });
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

export function advanceBotAiTick(state, { blockers = MAP_COLLISION_VOLUMES } = {}) {
  const tick = state.tick + 1;
  const nowMs = Math.round(tick * BOT_TICK_MS);
  let previousPlayers = state.matchState.players;
  let matchState = advanceRespawnTimers(Object.freeze({ ...state.matchState, tick }), { nowMs });
  let controllersBySlotIndex = { ...state.controllersBySlotIndex };
  let weaponStatesBySlotIndex = { ...state.weaponStatesBySlotIndex };
  let metrics = state.metrics;

  // Respawn detection
  for (const player of matchState.players) {
    const beforePlayer = previousPlayers[player.slotIndex];
    if (beforePlayer?.lifeState === PLAYER_LIFE_STATES.RESPAWNING && player.lifeState === PLAYER_LIFE_STATES.ALIVE) {
      metrics = addMetric(metrics, 'respawns');
      const spawnPosition = MAP_SPAWN_POINTS[player.slotIndex]?.position
        ?? WAYPOINTS_BY_ID[player.bot?.currentWaypointId]?.position
        ?? controllersBySlotIndex[player.slotIndex]?.position;
      controllersBySlotIndex[player.slotIndex] = createPlayerControllerState({
        position: spawnPosition,
        activeWeaponId: player.loadout.activeWeaponId,
      });
      weaponStatesBySlotIndex[player.slotIndex] = createWeaponState(player.loadout.activeWeaponId);
      if (player.bot) {
        const homeWp = getHomeZoneWaypoint(player.bot.homeZoneId);
        matchState = withBotForSlot(matchState, player.slotIndex, {
          state: BOT_STATE_MACHINE_STATES.NAVIGATING,
          stateEnteredTick: tick,
          lastHealth: 100,
          burstShotsFired: 0,
          lastBurstTick: 0,
          coverPosition: null,
          lastHitTick: null,
          lastHitDirection: null,
          currentWaypointId: getNearestWaypointId(spawnPosition),
          targetWaypointId: homeWp,
          route: findWaypointRoute(getNearestWaypointId(spawnPosition), homeWp),
          movement: Object.freeze({ routeIndex: 0, blockedTicks: 0, lastPosition: null, unstuckCount: 0 }),
          combatIntent: Object.freeze({
            state: BOT_COMBAT_INTENT_STATES.NONE,
            targetSlotIndex: null,
            lastSeenTick: null,
            desiredRange: 18,
            targetAcquiredTick: null,
          }),
        });
      }
    }
    if (beforePlayer?.lifeState === PLAYER_LIFE_STATES.ALIVE && player.lifeState === PLAYER_LIFE_STATES.RESPAWNING) {
      metrics = addMetric(metrics, 'deaths');
    }
  }
  previousPlayers = matchState.players;

  // Process each bot
  for (const player of matchState.players) {
    if (player.slotType !== SLOT_TYPES.BOT || !player.bot) continue;

    if (player.lifeState !== PLAYER_LIFE_STATES.ALIVE) {
      matchState = withBotForSlot(matchState, player.slotIndex, { state: BOT_STATE_MACHINE_STATES.RESPAWNING });
      continue;
    }

    let currentBot = player.bot;

    // ── Hit detection ──
    if (player.health < currentBot.lastHealth) {
      const origin = getControllerPosition(controllersBySlotIndex, player.slotIndex);
      let nearestEnemy = null;
      let nearestDist = Infinity;
      for (const otherPlayer of matchState.players) {
        if (otherPlayer.slotIndex === player.slotIndex) continue;
        if (otherPlayer.lifeState !== PLAYER_LIFE_STATES.ALIVE) continue;
        const otherPos = getControllerPosition(controllersBySlotIndex, otherPlayer.slotIndex);
        const dist = distance2d(origin, otherPos);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = otherPos;
        }
      }
      const hitDir = nearestEnemy
        ? normalize2d({ x: origin.x - nearestEnemy.x, z: origin.z - nearestEnemy.z })
        : { x: 0, z: 1 };

      currentBot = Object.freeze({
        ...currentBot,
        lastHealth: player.health,
        lastHitTick: tick,
        lastHitDirection: hitDir,
        combatIntent: Object.freeze({
          ...currentBot.combatIntent,
          state: BOT_COMBAT_INTENT_STATES.FLINCHING,
        }),
      });
      matchState = withBotForSlot(matchState, player.slotIndex, currentBot);
    } else {
      currentBot = Object.freeze({ ...currentBot, lastHealth: player.health });
      matchState = withBotForSlot(matchState, player.slotIndex, currentBot);
    }

    // ── Movement ──
    const controller = controllersBySlotIndex[player.slotIndex]
      ?? createPlayerControllerState({ activeWeaponId: player.loadout.activeWeaponId });
    const movementResult = advanceBotMovement({
      bot: currentBot,
      controller,
      slotIndex: player.slotIndex,
      tick,
      activeWeaponId: player.loadout.activeWeaponId,
      collisionVolumes: blockers,
    });
    controllersBySlotIndex[player.slotIndex] = movementResult.controller;
    metrics = addMetric(metrics, 'movementDistance', movementResult.movedDistance);
    if (movementResult.unstuck) metrics = addMetric(metrics, 'unstuckEvents');
    matchState = withBotForSlot(matchState, player.slotIndex, movementResult.bot);

    // ── Combat ──
    const combatResult = advanceBotCombat({
      state: Object.freeze({ ...state, matchState, controllersBySlotIndex, weaponStatesBySlotIndex, metrics }),
      slotIndex: player.slotIndex,
      bot: movementResult.bot,
      nowMs,
      tick,
      blockers,
    });
    matchState = withBotForSlot(combatResult.matchState, player.slotIndex, combatResult.bot);
    weaponStatesBySlotIndex[player.slotIndex] = combatResult.weaponState;
    metrics = combatResult.metrics;

    // ── Death detection ──
    for (const nextPlayer of matchState.players) {
      const previousPlayer = previousPlayers[nextPlayer.slotIndex];
      if (previousPlayer?.lifeState === PLAYER_LIFE_STATES.ALIVE && nextPlayer.lifeState === PLAYER_LIFE_STATES.RESPAWNING) {
        metrics = addMetric(metrics, 'deaths');
      }
    }
    previousPlayers = matchState.players;
  }

  return Object.freeze({
    ...state,
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
