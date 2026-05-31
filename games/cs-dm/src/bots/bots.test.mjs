import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMBAT_DEFAULTS, MATCH_PHASES, PLAYER_LIFE_STATES } from '../config/index.js';
import { createMatchState, createOfflineSlots, SLOT_TYPES } from '../core/index.js';
import { MAP_SPAWN_POINTS } from '../map/index.js';
import { createPlayerControllerState } from '../player/index.js';
import {
  BOT_COMBAT_INTENT_STATES,
  BOT_DIFFICULTIES,
  BOT_SLOT_CONTRACT,
  BOT_STATE_MACHINE_STATES,
  WAYPOINT_GRAPH_CONTRACT,
  advanceBotAiTick,
  chooseVisibleBotTarget,
  createBotAiSimulation,
  createBotAimDirection,
  createBotSlotFields,
  createBotPathPlan,
  findWaypointRoute,
  getDust2TunnelRouteToBSite,
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

const tests = [
  ['defines bot lifecycle, difficulty, combat, path, and handoff contracts', () => {
    assert.deepEqual(Object.values(BOT_STATE_MACHINE_STATES), ['idle', 'navigating', 'engaging', 'retreating/reloading', 'dead', 'respawning']);
    assert.equal(BOT_DIFFICULTIES.EASY.id, 'easy');
    assert.equal(BOT_DIFFICULTIES.NORMAL.pathReplanTicks, 45);
    assert.equal(BOT_DIFFICULTIES.HARD.aggression, 0.75);
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

  ['routes T Spawn to B Site through Dust2 tunnel waypoints', () => {
    const route = getDust2TunnelRouteToBSite();
    const routeIds = route.map((step) => step.waypointId);

    assert.deepEqual(routeIds, ['wp-t-spawn', 'wp-upper-tunnels', 'wp-b-site']);
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
    const origin = { x: 0, y: 0, z: 0 };
    const target = { x: 30, y: 0, z: 30 };
    const easyAim = createBotAimDirection({ origin, target, difficulty: BOT_DIFFICULTIES.EASY, slotIndex: 1, tick: 5 });
    const hardAim = createBotAimDirection({ origin, target, difficulty: BOT_DIFFICULTIES.HARD, slotIndex: 1, tick: 5 });

    assert.equal(BOT_DIFFICULTIES.EASY.reactionTicks > BOT_DIFFICULTIES.HARD.reactionTicks, true);
    assert.equal(easyAim.errorRadians > hardAim.errorRadians, true);
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
    const controller = createPlayerControllerState({ position: MAP_SPAWN_POINTS[1].position });
    let simulation = createBotAiSimulation({
      matchState,
      controllersBySlotIndex: Object.freeze({ 1: controller }),
    });
    simulation = Object.freeze({
      ...simulation,
      controllersBySlotIndex: Object.freeze({ ...simulation.controllersBySlotIndex, 1: controller }),
    });
    const blocker = { kind: 'box', center: MAP_SPAWN_POINTS[1].position, size: { width: 8, height: 4, depth: 8 } };
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
