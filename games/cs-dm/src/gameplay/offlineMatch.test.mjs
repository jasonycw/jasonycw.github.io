import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMBAT_DEFAULTS, LOCAL_PLAYER_SLOT_INDEX, MATCH_PHASES, PLAYER_LIFE_STATES, SLOT_TYPES, WEAPONS } from '../config/index.js';
import { selectBuyPurchase } from '../ui/buyMenu.js';
import { startReload } from '../weapons/index.js';
import {
  advanceOfflineMatchTick,
  buyOfflineWeapon,
  createOfflineMatch,
  deriveOfflineMatchHud,
  forceOfflineKill,
  MATCH_OVERLAY_STATES,
  OFFLINE_MATCH_PHASE,
  runOfflineSmokeSimulation,
  summarizeOfflineMatch,
  summarizeOfflineMenuConsistency,
} from './offlineMatch.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

let localLoadoutPersistenceEvidence = 'localLoadoutPersistence=not-run';

const advanceUntil = (state, predicate, maxTicks = 600) => {
  let nextState = state;
  for (let tick = 0; tick < maxTicks && !predicate(nextState); tick += 1) {
    nextState = advanceOfflineMatchTick(nextState);
  }
  return nextState;
};

const tests = [
  ['starts a 16-player roundless FFA match with T13 scoreboard rows', () => {
    const state = createOfflineMatch({ localPlayerName: 'Verifier' });
    const hud = deriveOfflineMatchHud(state);
    const summary = summarizeOfflineMatch(state);

    assert.equal(state.matchState.phase, MATCH_PHASES.RUNNING);
    assert.equal(state.matchState.mode, OFFLINE_MATCH_PHASE);
    assert.equal(state.matchState.players.length, 16);
    assert.equal(summary.botCount, 15);
    assert.equal(hud.scoreboard.length, 16);
    assert.equal(state.matchState.players[0].slotType, SLOT_TYPES.LOCAL);
    assert.equal(state.matchState.players.filter((player) => player.slotType === SLOT_TYPES.BOT).length, 15);
  }],

  ['runs accelerated deterministic two-minute smoke with bot shots kills and respawns', () => {
    let state = createOfflineMatch({ localPlayerName: 'Smoke' });
    state = Object.freeze({
      ...state,
      matchState: Object.freeze({
        ...state.matchState,
        players: Object.freeze(state.matchState.players.map((player) => Object.freeze({ ...player, spawnProtectionUntilMs: 0 }))),
      }),
    });

    const finalState = runOfflineSmokeSimulation(state, { seconds: 120 });
    const summary = summarizeOfflineMatch(finalState);

    assert.equal(finalState.tick, 7200);
    assert.equal(summary.playerCount, 16);
    assert.equal(summary.botShotsFired > 0, true);
    assert.equal(summary.totalKills > 0, true);
    assert.equal(summary.totalDeaths > 0, true);
    assert.equal(summary.botRespawns > 0, true);
    assert.equal(summary.phase, MATCH_PHASES.RUNNING);
    assert.equal(summary.mode, OFFLINE_MATCH_PHASE);

    writeEvidence('task-25-offline-smoke.txt', [
      'PASS T25 accelerated offline smoke',
      `ticks=${finalState.tick}`,
      `players=${summary.playerCount}`,
      `scoreboardRows=${summary.scoreboardRows}`,
      `botShotsFired=${summary.botShotsFired}`,
      `totalKills=${summary.totalKills}`,
      `totalDeaths=${summary.totalDeaths}`,
      `botRespawns=${summary.botRespawns}`,
      `phase=${summary.phase}`,
      `mode=${summary.mode}`,
    ]);
  }],

  ['local player can buy shoot die respawn and keep loadout', () => {
    let state = createOfflineMatch({ localPlayerName: 'Buyer' });
    const purchase = selectBuyPurchase(state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout, WEAPONS.AWP.id);
    assert.equal(purchase.ok, true);
    state = buyOfflineWeapon(state, WEAPONS.AWP.id).state;
    assert.equal(state.matchState.players[0].loadout.activeWeaponId, WEAPONS.AWP.id);

    state = Object.freeze({
      ...state,
      controllersBySlotIndex: Object.freeze({
        ...state.controllersBySlotIndex,
        0: Object.freeze({ ...state.controllersBySlotIndex[0], position: Object.freeze({ x: 0, y: 0, z: 0 }), velocity: Object.freeze({ x: 0, y: 0, z: 0 }), view: Object.freeze({ yaw: 0, pitch: 0 }) }),
        1: Object.freeze({ ...state.controllersBySlotIndex[1], position: Object.freeze({ x: 0, y: 0, z: 30 }), radius: 20 }),
      }),
      matchState: Object.freeze({
        ...state.matchState,
        players: Object.freeze(state.matchState.players.map((player, index) => Object.freeze({ ...player, spawnProtectionUntilMs: index <= 1 ? 0 : player.spawnProtectionUntilMs }))),
      }),
    });

    state = advanceOfflineMatchTick(state, { localInput: { fire: true, seed: 52, look: { yawDelta: 0, pitchDelta: -145 } } });
    assert.equal(state.lastLocalShot !== null, true);
    assert.equal(state.weaponStatesBySlotIndex[0].shotsFired, 1);
    state = forceOfflineKill(state, { killerSlotIndex: 0, victimSlotIndex: 1 });
    assert.equal(state.matchState.players[0].score.kills, 1);

    state = forceOfflineKill(state, { killerSlotIndex: 1, victimSlotIndex: 0 });
    assert.equal(state.matchState.players[0].lifeState, PLAYER_LIFE_STATES.RESPAWNING);
    state = advanceUntil(state, (nextState) => nextState.matchState.players[0].lifeState === PLAYER_LIFE_STATES.ALIVE && nextState.nowMs >= COMBAT_DEFAULTS.respawnDelayMs);

    assert.equal(state.matchState.players[0].lifeState, PLAYER_LIFE_STATES.ALIVE);
    assert.equal(state.matchState.players[0].loadout.activeWeaponId, WEAPONS.AWP.id);
    assert.equal(state.matchState.players[0].health, COMBAT_DEFAULTS.maxHealth);
    localLoadoutPersistenceEvidence = `localLoadoutPersistence=${state.matchState.players[0].lifeState}/${state.matchState.players[0].loadout.primaryWeaponId}/${state.matchState.players[0].loadout.secondaryWeaponId}/${state.matchState.players[0].loadout.activeWeaponId}`;
  }],

  ['keeps HUD and overlay state consistent when local death happens with menus open', () => {
    let state = createOfflineMatch({ localPlayerName: 'MenuDeath' });
    const beforeDeath = summarizeOfflineMenuConsistency(state, { overlayState: MATCH_OVERLAY_STATES.BUY });
    state = forceOfflineKill(state, { killerSlotIndex: 1, victimSlotIndex: LOCAL_PLAYER_SLOT_INDEX });
    const duringRespawn = summarizeOfflineMenuConsistency(state, { overlayState: MATCH_OVERLAY_STATES.SETTINGS });
    state = advanceUntil(state, (nextState) => nextState.matchState.players[LOCAL_PLAYER_SLOT_INDEX].lifeState === PLAYER_LIFE_STATES.ALIVE && nextState.nowMs >= COMBAT_DEFAULTS.respawnDelayMs);
    const afterRespawn = summarizeOfflineMenuConsistency(state, { overlayState: MATCH_OVERLAY_STATES.SCOREBOARD });

    assert.equal(beforeDeath.consistent, true);
    assert.equal(duringRespawn.consistent, true);
    assert.equal(duringRespawn.localLifeState, PLAYER_LIFE_STATES.RESPAWNING);
    assert.equal(duringRespawn.hudHealth, 0);
    assert.equal(afterRespawn.consistent, true);
    assert.equal(afterRespawn.localLifeState, PLAYER_LIFE_STATES.ALIVE);
    assert.equal(afterRespawn.scoreboardRows, 16);

    writeEvidence('task-29-menu-death-respawn.txt', [
      'T29 menu/death/respawn consistency evidence',
      'before=' + beforeDeath.overlayState + '/' + beforeDeath.localLifeState + '/consistent:' + beforeDeath.consistent + '/rows:' + beforeDeath.scoreboardRows,
      'during=' + duringRespawn.overlayState + '/' + duringRespawn.localLifeState + '/hudHealth:' + duringRespawn.hudHealth + '/consistent:' + duringRespawn.consistent + '/rows:' + duringRespawn.scoreboardRows,
      'after=' + afterRespawn.overlayState + '/' + afterRespawn.localLifeState + '/hudHealth:' + afterRespawn.hudHealth + '/consistent:' + afterRespawn.consistent + '/rows:' + afterRespawn.scoreboardRows,
      'HUD derives from match state while overlays are open; respawn restores alive local state and exact 16 scoreboard rows.',
    ]);
  }],

  ['allows buy weapon switch during reload by resetting local weapon state deterministically', () => {
    let state = createOfflineMatch({ localPlayerName: 'ReloadBuyer' });
    const firstShotState = Object.freeze({
      ...state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX],
      ammoInMagazine: state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].ammoInMagazine - 1,
    });
    const reload = startReload(firstShotState, state.nowMs);
    assert.equal(reload.ok, true);

    state = Object.freeze({
      ...state,
      weaponStatesBySlotIndex: Object.freeze({
        ...state.weaponStatesBySlotIndex,
        [LOCAL_PLAYER_SLOT_INDEX]: reload.state,
      }),
    });
    assert.equal(state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].isReloading, true);

    state = buyOfflineWeapon(state, WEAPONS.AWP.id).state;
    assert.equal(state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout.activeWeaponId, WEAPONS.AWP.id);
    assert.equal(state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].weaponId, WEAPONS.AWP.id);
    assert.equal(state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].isReloading, false);
    assert.equal(state.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].activeWeaponId ?? state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout.activeWeaponId, WEAPONS.AWP.id);
  }],
  ['stays running free-play with no team winner after many kills', () => {
    let state = createOfflineMatch({ localPlayerName: 'Roundless' });
    for (let index = 0; index < 50; index += 1) {
      state = forceOfflineKill(state, { killerSlotIndex: 0, victimSlotIndex: (index % 15) + 1 });
    }

    const summary = summarizeOfflineMatch(state);
    const hud = deriveOfflineMatchHud(state);
    assert.equal(summary.totalKills, 50);
    assert.equal(summary.totalDeaths, 50);
    assert.equal(summary.phase, MATCH_PHASES.RUNNING);
    assert.equal(summary.mode, OFFLINE_MATCH_PHASE);
    assert.equal(summary.hasRoundWinner, false);
    assert.equal(hud.scoreboard.length, 16);

    writeEvidence('task-25-ffa-roundless.txt', [
      'PASS T25 FFA roundless flow',
      `scoreboardRows=${hud.scoreboard.length}`,
      `totalKills=${summary.totalKills}`,
      `totalDeaths=${summary.totalDeaths}`,
      `phase=${summary.phase}`,
      `mode=${summary.mode}`,
      `hasRoundWinner=${summary.hasRoundWinner}`,
      localLoadoutPersistenceEvidence,
      `scoreboardExact16=${hud.scoreboard.map((row) => `${row.slotIndex}:${row.name}:${row.slotType}:${row.lifeState}:${row.score.kills}/${row.score.deaths}`).join(' | ')}`,
      `localLoadout=${summary.localLoadout.primaryWeaponId}/${summary.localLoadout.secondaryWeaponId}/${summary.localLoadout.activeWeaponId}`,
    ]);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS offline match - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL offline match - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
