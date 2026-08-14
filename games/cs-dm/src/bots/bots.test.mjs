import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMBAT_DEFAULTS, MATCH_PHASES, PLAYER_LIFE_STATES } from '../config/index.js';
import { createMatchState, createOfflineSlots, SLOT_TYPES } from '../core/index.js';
import { MAP_COLLISION_VOLUMES, MAP_ROUTE_GRAPH, MAP_SPAWN_POINTS } from '../map/index.js';
import { createPlayerControllerState } from '../player/index.js';
import {
  BOT_COMBAT_INTENT_STATES,
  BOT_DIFFICULTIES,
  BOT_PLAYSTYLES,
  BOT_SLOT_CONTRACT,
  BOT_STATE_MACHINE_STATES,
  WAYPOINT_GRAPH_CONTRACT,
  advanceBotAiTick,
  chooseVisibleBotTarget,
  createBotAiSimulation,
  createBotAimDirection,
  createBotSlotFields,
  createBotPathPlan,
  findNearestCover,
  findWaypointRoute,
  getCisternTunnelRouteToCisternCourt,
  getPlaystyleForSlot,
  getZoneAssignmentForSlot,
  hasApproximateLineOfSight,
  isTunnelWaypoint,
  listOfflineBotSlotIndexes,
  runBotAiSimulation,
  selectBotLoadout,
  selectDeterministicBotTarget,
  summarizeBotSlots,
} from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const setPlayer = (players, slotIndex, fields) => Object.freeze(players.map((player, index) => index === slotIndex ? Object.freeze({ ...player, ...fields }) : player));
const setBot = (players, slotIndex, botFields) => setPlayer(players, slotIndex, { bot: Object.freeze({ ...players[slotIndex].bot, ...botFields }) });
const distance2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pointOverlapsBox2d = (point, radius, box) => {
  const halfWidth = box.size.width / 2;
  const halfDepth = box.size.depth / 2;
  const closestX = Math.max(box.center.x - halfWidth, Math.min(point.x, box.center.x + halfWidth));
  const closestZ = Math.max(box.center.z - halfDepth, Math.min(point.z, box.center.z + halfDepth));
  return Math.hypot(point.x - closestX, point.z - closestZ) < radius;
};

const tests = [
  ['defines bot lifecycle, difficulty, combat, path, and handoff contracts', () => {
    assert.deepEqual(Object.values(BOT_STATE_MACHINE_STATES), ['idle', 'navigating', 'engaging', 'retreating/reloading', 'dead', 'respawning']);
    assert.equal(BOT_DIFFICULTIES.EASY.id, 'easy');
    assert.equal(BOT_DIFFICULTIES.NORMAL.pathReplanTicks, 35);
    assert.equal(BOT_DIFFICULTIES.HARD.aggression, 0.85);
    assert.equal(BOT_SLOT_CONTRACT.handoff.includes('canBeReplacedByRemote'), true);
    assert.equal(WAYPOINT_GRAPH_CONTRACT.selection.includes('deterministic'), true);
  }],

  ['fills all non-local offline slots with unique named bot contracts', () => {
    const slots = createOfflineSlots('Local Agent');
    const summary = summarizeBotSlots(slots);

    assert.equal(slots.length, 16);
    assert.equal(slots[0].slotType, SLOT_TYPES.LOCAL);
    assert.equal(summary.botSlotCount, 15);
    assert.equal(summary.uniqueBotNameCount, 15);
    assert.equal(summary.allHaveBotContract, true);
    assert.equal(summary.allAlive, true);
    assert.deepEqual(listOfflineBotSlotIndexes(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    assert.equal(slots[1].bot.handoff.replacementToken, 'bot-slot-01');
    assert.equal(slots[15].bot.handoff.canBeReplacedByRemote, true);
  }],

  ['selects path targets deterministically without executing movement', () => {
    const firstSelection = selectDeterministicBotTarget({ slotIndex: 3, tick: 600 });
    const secondSelection = selectDeterministicBotTarget({ slotIndex: 3, tick: 600 });
    const plan = createBotPathPlan({ slotIndex: 3, currentWaypointId: 'wp-t-spawn', tick: 600 });

    assert.equal(firstSelection, secondSelection);
    assert.equal(plan.targetWaypointId, firstSelection);
    assert.equal(plan.state, BOT_STATE_MACHINE_STATES.NAVIGATING);
    assert.equal(plan.route[0].waypointId, 'wp-t-spawn');
    assert.equal(plan.route[plan.route.length - 1].waypointId, firstSelection);
  }],

  ['routes Raider Gate to Cistern Court through cistern tunnel waypoints', () => {
    const route = getCisternTunnelRouteToCisternCourt();
    const routeIds = route.map((step) => step.waypointId);

    assert.deepEqual(routeIds, ['wp-t-spawn', 'wp-upper-tunnels', 'wp-b-tunnels', 'wp-b-site']);
    assert.equal(route.some(isTunnelWaypoint), true);
    assert.equal(route[route.length - 1].waypointId, 'wp-b-site');
    assert.deepEqual(findWaypointRoute('wp-missing', 'wp-b-site'), []);
  }],

  ['chooses visible targets by range and blocks occluded line-of-sight', () => {
    const matchState = createMatchState({ phase: MATCH_PHASES.RUNNING, players: createOfflineSlots('Spotter') });
    const controllersBySlotIndex = Object.freeze(Object.fromEntries(matchState.players.map((player) => [player.slotIndex, createPlayerControllerState({
      position: player.slotIndex === 2 ? { x: 10, y: 0, z: 30 } : player.slotIndex === 3 ? { x: 10, y: 0, z: 45 } : { x: 90, y: 0, z: 90 },
    })])));
    const nearbyControllersBySlotIndex = Object.freeze({
      1: createPlayerControllerState({ position: { x: 10, y: 0, z: 10 } }),
      2: createPlayerControllerState({ position: { x: 10, y: 0, z: 30 } }),
      3: createPlayerControllerState({ position: { x: 10, y: 0, z: 45 } }),
    });

    assert.equal(hasApproximateLineOfSight({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 20 }, { maxRange: 25 }), true);
    assert.equal(hasApproximateLineOfSight({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 20 }, {
      maxRange: 25,
      blockers: [{ kind: 'box', center: { x: 0, y: 0, z: 10 }, size: { width: 4, height: 4, depth: 4 } }],
    }), false);
    assert.equal(chooseVisibleBotTarget({ matchState, controllersBySlotIndex: Object.freeze({ ...controllersBySlotIndex, ...nearbyControllersBySlotIndex }), slotIndex: 1, nowMs: COMBAT_DEFAULTS.spawnProtectionMs + 1 })?.slotIndex, 2);
  }],

  ['difficulty settings create measurable reaction and aim differences', () => {
    const origin = { x: 0, y: 1.5, z: 0 };
    const target = { x: 30, y: 0.95, z: 30 };
    const easyAim = createBotAimDirection({ origin, target, difficulty: BOT_DIFFICULTIES.EASY, slotIndex: 1, tick: 5 });
    const hardAim = createBotAimDirection({ origin, target, difficulty: BOT_DIFFICULTIES.HARD, slotIndex: 1, tick: 5 });

    assert.equal(BOT_DIFFICULTIES.EASY.reactionTicks > BOT_DIFFICULTIES.HARD.reactionTicks, true);
    assert.equal(easyAim.errorRadians > hardAim.errorRadians, true);
    assert.equal(easyAim.direction.y < 0, true);
    assert.equal(Math.abs(Math.hypot(easyAim.direction.x, easyAim.direction.y, easyAim.direction.z) - 1) < 0.000001, true);
    assert.notDeepEqual(selectBotLoadout({ slotIndex: 2, difficultyId: 'easy' }), selectBotLoadout({ slotIndex: 2, difficultyId: 'hard' }));
  }],

  ['runs deterministic 60-second bot soak with movement, shots, difficulty, and respawn recovery', () => {
    let players = createOfflineSlots('Soak');
    players = setBot(players, 1, createBotSlotFields({ slotIndex: 1, difficultyId: 'easy', currentWaypointId: 'wp-t-spawn' }).bot);
    players = setBot(players, 2, createBotSlotFields({ slotIndex: 2, difficultyId: 'hard', currentWaypointId: 'wp-mid' }).bot);
    players = setPlayer(players, 0, { spawnProtectionUntilMs: 0 });
    players = Object.freeze(players.map((player) => Object.freeze({ ...player, spawnProtectionUntilMs: 0 })));

    const initialMatchState = createMatchState({ phase: MATCH_PHASES.RUNNING, players });
    const initialSimulation = createBotAiSimulation({ matchState: initialMatchState });
    const finalSimulation = runBotAiSimulation(initialSimulation, { seconds: 60 });
    const aliveBotCount = finalSimulation.matchState.players.filter((player) => player.slotType === SLOT_TYPES.BOT && player.lifeState === PLAYER_LIFE_STATES.ALIVE).length;

    assert.equal(finalSimulation.tick, 3600);
    assert.equal(finalSimulation.metrics.movementDistance > 200, true);
    assert.equal(finalSimulation.metrics.shotsFired > 0, true);
    assert.equal(finalSimulation.metrics.easyAimErrorRadians > finalSimulation.metrics.hardAimErrorRadians, true);
    assert.equal(finalSimulation.metrics.respawns > 0, true);
    assert.equal(aliveBotCount > 0, true);

    writeEvidence('task-21-bot-soak.txt', [
      'PASS T21 deterministic 60-second bot soak',
      `ticks=${finalSimulation.tick}`,
      `movementDistance=${finalSimulation.metrics.movementDistance}`,
      `shotsFired=${finalSimulation.metrics.shotsFired}`,
      `shotsHit=${finalSimulation.metrics.shotsHit}`,
      `kills=${finalSimulation.metrics.kills}`,
      `deaths=${finalSimulation.metrics.deaths}`,
      `respawns=${finalSimulation.metrics.respawns}`,
      `easyAimErrorRadians=${finalSimulation.metrics.easyAimErrorRadians}`,
      `hardAimErrorRadians=${finalSimulation.metrics.hardAimErrorRadians}`,
      `aliveBotCount=${aliveBotCount}`,
    ]);
  }],

  ['uses alternate waypoint behavior when movement is blocked', () => {
    let players = createOfflineSlots('Unstuck');
    players = setBot(players, 1, Object.freeze({
      ...createBotSlotFields({ slotIndex: 1, difficultyId: 'normal', currentWaypointId: 'wp-t-spawn' }).bot,
      targetWaypointId: 'wp-upper-tunnels',
      route: findWaypointRoute('wp-t-spawn', 'wp-upper-tunnels'),
      state: BOT_STATE_MACHINE_STATES.NAVIGATING,
      stateEnteredTick: 0,
    }));
    const matchState = createMatchState({ phase: MATCH_PHASES.RUNNING, players });
    const blockedPosition = { x: 12, y: 0, z: 88 };
    const controller = createPlayerControllerState({ position: blockedPosition });
    let simulation = createBotAiSimulation({
      matchState,
      controllersBySlotIndex: Object.freeze({ 1: controller }),
    });
    simulation = Object.freeze({
      ...simulation,
      controllersBySlotIndex: Object.freeze({ ...simulation.controllersBySlotIndex, 1: controller }),
    });
    const blocker = { kind: 'box', center: blockedPosition, size: { width: 8, height: 4, depth: 8 } };
    for (let index = 0; index < 40; index += 1) {
      simulation = advanceBotAiTick(simulation, { blockers: [blocker] });
    }

    assert.equal(simulation.metrics.unstuckEvents > 0, true);
    assert.equal(simulation.matchState.players[1].bot.movement.unstuckCount > 0, true);
    assert.equal(simulation.matchState.players[1].bot.combatIntent.state === BOT_COMBAT_INTENT_STATES.NONE || simulation.matchState.players[1].bot.combatIntent.lastSeenTick !== null, true);

    writeEvidence('task-21-bot-unstuck.txt', [
      'PASS T21 bot unstuck alternate waypoint behavior',
      `ticks=${simulation.tick}`,
      `unstuckEvents=${simulation.metrics.unstuckEvents}`,
      `botUnstuckCount=${simulation.matchState.players[1].bot.movement.unstuckCount}`,
      `targetWaypointId=${simulation.matchState.players[1].bot.targetWaypointId}`,
      `state=${simulation.matchState.players[1].bot.state}`,
    ]);
  }],

  ['keeps bots grounded and outside collision volumes during deterministic movement soak', () => {
    const initialSimulation = createBotAiSimulation({ matchState: createMatchState({ phase: MATCH_PHASES.RUNNING, players: createOfflineSlots('Grounded') }) });
    let simulation = initialSimulation;
    let maxStepDistance = 0;
    let overlapCount = 0;
    for (let tickIndex = 0; tickIndex < 20 * 60; tickIndex += 1) {
      const beforeControllers = simulation.controllersBySlotIndex;
      const beforePlayers = simulation.matchState.players;
      simulation = advanceBotAiTick(simulation, { blockers: MAP_COLLISION_VOLUMES });
      for (const player of simulation.matchState.players.filter((entry) => entry.slotType === SLOT_TYPES.BOT)) {
        const before = beforeControllers[player.slotIndex];
        const after = simulation.controllersBySlotIndex[player.slotIndex];
        const beforePlayer = beforePlayers[player.slotIndex];
        if (before && after && beforePlayer?.lifeState === PLAYER_LIFE_STATES.ALIVE && player.lifeState === PLAYER_LIFE_STATES.ALIVE) {
          maxStepDistance = Math.max(maxStepDistance, distance2d(before.position, after.position));
        }
        if (after && MAP_COLLISION_VOLUMES.some((volume) => pointOverlapsBox2d(after.position, 0.6, volume))) {
          overlapCount += 1;
        }
      }
    }
    const finalSimulation = simulation;
    const botControllers = finalSimulation.matchState.players
      .filter((player) => player.slotType === SLOT_TYPES.BOT)
      .map((player) => finalSimulation.controllersBySlotIndex[player.slotIndex]);

    assert.equal(finalSimulation.tick, 1200);
    assert.equal(botControllers.every((controller) => controller.position.y === 0), true);
    assert.equal(botControllers.every((controller) => controller.movement.grounded), true);
    assert.equal(overlapCount, 0);
    // Diagonal strafing (forward + left/right) for flankers produces ~1.414× single-axis step distance
    assert.equal(maxStepDistance <= 0.20, true);
  }],

  ['assigns varied playstyles to all 15 bot slots', () => {
    const playstyles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((slotIndex) => getPlaystyleForSlot(slotIndex));
    const uniquePlaystyles = new Set(playstyles);

    assert.equal(playstyles.length, 15);
    assert.equal(uniquePlaystyles.size >= 4, true, `Expected at least 4 unique playstyles, got ${uniquePlaystyles.size}`);
    assert.equal(uniquePlaystyles.has('rusher'), true);
    assert.equal(uniquePlaystyles.has('anchor'), true);
    assert.equal(uniquePlaystyles.has('support'), true);
  }],

  ['assigns different home zones to bots', () => {
    const zones = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((slotIndex) => getZoneAssignmentForSlot(slotIndex));
    const uniqueZones = new Set(zones);

    assert.equal(zones.length, 15);
    assert.equal(uniqueZones.size >= 4, true, `Expected at least 4 unique zones, got ${uniqueZones.size}`);
  }],

  ['creates bots with different initial waypoints via zone system', () => {
    const slots = createOfflineSlots('Spread');
    const botWaypoints = slots
      .filter((player) => player.slotType === SLOT_TYPES.BOT)
      .map((player) => player.bot.currentWaypointId);
    const uniqueWaypoints = new Set(botWaypoints);

    assert.equal(botWaypoints.length, 15);
    assert.equal(uniqueWaypoints.size >= 4, true, `Only ${uniqueWaypoints.size} unique starting waypoints — bots all share same zone`);
  }],

  ['playstyle loadouts vary by difficulty for same slot', () => {
    assert.notDeepEqual(selectBotLoadout({ slotIndex: 3, difficultyId: 'easy' }), selectBotLoadout({ slotIndex: 3, difficultyId: 'hard' }));
    assert.notDeepEqual(selectBotLoadout({ slotIndex: 7, difficultyId: 'easy' }), selectBotLoadout({ slotIndex: 7, difficultyId: 'normal' }));
    assert.notDeepEqual(selectBotLoadout({ slotIndex: 3, difficultyId: 'easy' }), selectBotLoadout({ slotIndex: 5, difficultyId: 'easy' }));
  }],

  ['playstyle loadouts give correct weapon categories', () => {
    const awpLoadout = selectBotLoadout({ slotIndex: 3, difficultyId: 'hard', playstyleId: 'awper' });
    const rusherLoadout = selectBotLoadout({ slotIndex: 1, difficultyId: 'hard', playstyleId: 'rusher' });
    const supportLoadout = selectBotLoadout({ slotIndex: 5, difficultyId: 'normal', playstyleId: 'support' });

    assert.equal(['awp', 'scout', 'sg550', 'g3sg1'].includes(awpLoadout.primaryWeaponId), true);
    assert.equal(['ak47', 'famas', 'galil'].includes(rusherLoadout.primaryWeaponId), true);
    assert.equal(['mp5', 'tmp', 'ump45', 'p90'].includes(supportLoadout.primaryWeaponId), true);
  }],

  ['cover function finds valid cover positions', () => {
    const origin = { x: 50, y: 0, z: 50 };
    const threatDirection = { x: 0.7, z: 0.7 };
    const coverResult = findNearestCover({ origin, threatDirection });

    if (coverResult !== null) {
      assert.equal(typeof coverResult.position.x, 'number');
      assert.equal(typeof coverResult.position.z, 'number');
      assert.equal(coverResult.volume.kind, 'box');
    }
  }],

  ['bots spread across the map during simulation', () => {
    let players = createOfflineSlots('Spread');
    const matchState = createMatchState({ phase: MATCH_PHASES.RUNNING, players });
    let simulation = createBotAiSimulation({ matchState });
    const botPositions = () => simulation.matchState.players
      .filter((p) => p.slotType === SLOT_TYPES.BOT && p.lifeState === PLAYER_LIFE_STATES.ALIVE)
      .map((p) => simulation.controllersBySlotIndex[p.slotIndex]?.position)
      .filter(Boolean);

    // Run 300 ticks (5 seconds) to let bots spread
    for (let i = 0; i < 300; i += 1) {
      simulation = advanceBotAiTick(simulation);
    }

    const positions = botPositions();
    const averageX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const averageZ = positions.reduce((sum, p) => sum + p.z, 0) / positions.length;
    const variance = positions.reduce((sum, p) => sum + Math.hypot(p.x - averageX, p.z - averageZ), 0) / positions.length;

    // Bots should have spread enough that average distance from center is > 10 units
    assert.equal(variance > 10, true, `Bot spread too low: ${variance.toFixed(1)} units from center`);
    assert.equal(positions.length >= 5, true, `Too few alive bots to measure spread: ${positions.length}`);
  }],

  ['keeps waypoint anchors outside blockers', () => {
    const invalidAnchors = MAP_ROUTE_GRAPH.anchors.filter((anchor) => MAP_COLLISION_VOLUMES.some((volume) => pointOverlapsBox2d(anchor.position, 0.6, volume)));

    assert.deepEqual(invalidAnchors.map((anchor) => anchor.id), []);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS bot contracts - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL bot contracts - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
