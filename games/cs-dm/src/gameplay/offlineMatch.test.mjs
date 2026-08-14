import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMBAT_DEFAULTS, LOCAL_PLAYER_SLOT_INDEX, MATCH_PHASES, PLAYER_LIFE_STATES, SLOT_TYPES, WEAPONS } from '../config/index.js';
import { INPUT_BUTTONS } from '../core/index.js';
import { getConfiguredMouseLookDelta } from '../input/index.js';
import { MAP_COLLISION_VOLUMES, MAP_SPAWN_POINTS, SPAWN_CLEARANCE_RADIUS, getSpawnCollisionOverlaps } from '../map/index.js';
import { PLAYER_MOVEMENT_DEFAULTS } from '../player/index.js';
import { selectBuyPurchase } from '../ui/buyMenu.js';
import { createWeaponState, startReload } from '../weapons/index.js';
import {
  advanceOfflineMatchTick,
  buyOfflineWeapon,
  createOfflineMatch,
  deriveOfflineMatchHud,
  forceOfflineKill,
  MATCH_OVERLAY_STATES,
  OFFLINE_MATCH_PHASE,
  reloadOfflineWeapon,
  runOfflineSmokeSimulation,
  summarizeOfflineMatch,
  summarizeOfflineMenuConsistency,
  switchOfflineWeaponSlot,
} from './offlineMatch.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

let localLoadoutPersistenceEvidence = 'localLoadoutPersistence=not-run';

const distance2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const pointOverlapsBox2d = (point, radius, box) => {
  const halfWidth = box.size.width / 2;
  const halfDepth = box.size.depth / 2;
  const closestX = Math.max(box.center.x - halfWidth, Math.min(point.x, box.center.x + halfWidth));
  const closestZ = Math.max(box.center.z - halfDepth, Math.min(point.z, box.center.z + halfDepth));
  return Math.hypot(point.x - closestX, point.z - closestZ) < radius;
};

const clearInitialSpawnProtection = (state) => Object.freeze({
  ...state,
  matchState: Object.freeze({
    ...state.matchState,
    players: Object.freeze(state.matchState.players.map((player) => Object.freeze({ ...player, spawnProtectionUntilMs: 0 }))),
  }),
});

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
        1: Object.freeze({ ...state.controllersBySlotIndex[1], position: Object.freeze({ x: 0, y: 0, z: -30 }), radius: 20 }),
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

  ['applies configured mouse look deltas to the live offline controller', () => {
    const state = createOfflineMatch({ localPlayerName: 'MouseLook' });
    const defaultInverted = advanceOfflineMatchTick(state, {
      localInput: {
        look: getConfiguredMouseLookDelta({ yawDelta: 40, pitchDelta: 40 }),
      },
    });
    const standardHalfSensitivity = advanceOfflineMatchTick(state, {
      localInput: {
        look: getConfiguredMouseLookDelta({ yawDelta: 40, pitchDelta: 40 }, { sensitivity: 0.5, invertY: false }),
      },
    });

    assert.equal(defaultInverted.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].view.yaw, -0.08);
    assert.equal(defaultInverted.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].view.pitch, -0.08);
    assert.equal(standardHalfSensitivity.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].view.yaw, -0.04);
    assert.equal(standardHalfSensitivity.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].view.pitch, 0.04);
  }],

  ['carries a queued local jump tap into the offline controller state', () => {
    const state = createOfflineMatch({ localPlayerName: 'JumpTap' });
    const jumped = advanceOfflineMatchTick(state, {
      localInput: {
        buttons: [],
        jumpPressed: true,
      },
    });
    const released = advanceOfflineMatchTick(jumped);
    const legacyButtonJump = advanceOfflineMatchTick(state, {
      localInput: {
        buttons: [INPUT_BUTTONS.JUMP],
      },
    });

    const heldNext = advanceOfflineMatchTick(legacyButtonJump, {
      localInput: {
        buttons: [INPUT_BUTTONS.JUMP],
      },
    });
    const tapNext = advanceOfflineMatchTick(jumped);

    assert.equal(jumped.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].movement.jumping, true);
    assert.equal(jumped.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].movement.grounded, false);
    assert.equal(jumped.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].position.y > state.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].position.y, true);
    assert.equal(released.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].position.y > jumped.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].position.y, true);
    assert.equal(legacyButtonJump.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].movement.jumping, true);
    assert.equal(heldNext.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].position.y, tapNext.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].position.y);
    assert.equal(heldNext.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].velocity.y, tapNext.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].velocity.y);
  }],

  ['records local firing feedback when the weapon fires without a hit target', () => {
    let state = createOfflineMatch({ localPlayerName: 'MissFeedback' });
    state = Object.freeze({
      ...state,
      matchState: Object.freeze({
        ...state.matchState,
        players: Object.freeze(state.matchState.players.map((player, index) => Object.freeze({
          ...player,
          lifeState: index === LOCAL_PLAYER_SLOT_INDEX ? PLAYER_LIFE_STATES.ALIVE : PLAYER_LIFE_STATES.RESPAWNING,
          spawnProtectionUntilMs: 0,
        }))),
      }),
    });

    const fired = advanceOfflineMatchTick(state, { localInput: { fire: true, seed: 71 } });
    assert.equal(fired.lastLocalShot !== null, true);
    assert.equal(fired.lastLocalShot.hit, null);
    assert.equal(fired.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].shotsFired, 1);

    const cooldownBlocked = advanceOfflineMatchTick(fired, { localInput: { fire: true, seed: 72 } });
    assert.equal(cooldownBlocked.lastLocalShot, null);
    assert.equal(cooldownBlocked.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].shotsFired, 1);
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

  ['switches primary secondary and knife slots without losing purchased loadout', () => {
    let state = createOfflineMatch({ localPlayerName: 'Switcher' });
    state = buyOfflineWeapon(state, WEAPONS.AWP.id).state;
    state = buyOfflineWeapon(state, WEAPONS.USP.id).state;

    const primary = switchOfflineWeaponSlot(state, 'primary');
    assert.equal(primary.ok, true);
    assert.equal(primary.state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout.primaryWeaponId, WEAPONS.AWP.id);
    assert.equal(primary.state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout.secondaryWeaponId, WEAPONS.USP.id);
    assert.equal(primary.state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout.activeWeaponId, WEAPONS.AWP.id);
    assert.equal(primary.state.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].activeWeaponId, WEAPONS.AWP.id);
    assert.equal(primary.state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].weaponId, WEAPONS.AWP.id);

    const secondary = switchOfflineWeaponSlot(primary.state, 'secondary');
    assert.equal(secondary.ok, true);
    assert.equal(secondary.state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout.primaryWeaponId, WEAPONS.AWP.id);
    assert.equal(secondary.state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout.secondaryWeaponId, WEAPONS.USP.id);
    assert.equal(secondary.state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout.activeWeaponId, WEAPONS.USP.id);

    const knife = switchOfflineWeaponSlot(secondary.state, 'knife');
    assert.equal(knife.ok, true);
    assert.equal(knife.state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout.activeWeaponId, WEAPONS.KNIFE.id);
    assert.equal(knife.state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout.primaryWeaponId, WEAPONS.AWP.id);
    assert.equal(knife.state.matchState.players[LOCAL_PLAYER_SLOT_INDEX].loadout.secondaryWeaponId, WEAPONS.USP.id);
  }],

  ['reloads active local weapon and HUD follows live ammo state', () => {
    let state = createOfflineMatch({ localPlayerName: 'Reloader' });
    const spentState = Object.freeze({ ...state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX], ammoInMagazine: 12 });
    state = Object.freeze({
      ...state,
      weaponStatesBySlotIndex: Object.freeze({ ...state.weaponStatesBySlotIndex, [LOCAL_PLAYER_SLOT_INDEX]: spentState }),
    });

    const reload = reloadOfflineWeapon(state);
    assert.equal(reload.ok, true);
    assert.equal(reload.state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].isReloading, true);
    let hud = deriveOfflineMatchHud(reload.state);
    assert.equal(hud.localPlayer.ammo.clip, 12);
    assert.equal(hud.localPlayer.ammo.isReloading, true);

    const completed = advanceOfflineMatchTick(Object.freeze({ ...reload.state, tick: 200, nowMs: reload.state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].reloadCompleteAtMs }));
    hud = deriveOfflineMatchHud(completed);
    assert.equal(completed.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].isReloading, false);
    assert.equal(hud.localPlayer.ammo.clip, WEAPONS.AK47.ammo.magazine);
    assert.equal(hud.localPlayer.ammo.reserve, WEAPONS.AK47.ammo.reserveMax - (WEAPONS.AK47.ammo.magazine - 12));
  }],

  ['completes a reload on an idle grounded tick without local input', () => {
    let state = createOfflineMatch({ localPlayerName: 'IdleReload' });
    const spentState = Object.freeze({ ...state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX], ammoInMagazine: 11 });
    state = Object.freeze({
      ...state,
      weaponStatesBySlotIndex: Object.freeze({ ...state.weaponStatesBySlotIndex, [LOCAL_PLAYER_SLOT_INDEX]: spentState }),
    });

    const reload = reloadOfflineWeapon(state);
    assert.equal(reload.ok, true);
    const completed = advanceOfflineMatchTick(Object.freeze({
      ...reload.state,
      tick: 301,
      nowMs: reload.state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].reloadCompleteAtMs,
    }));
    const hud = deriveOfflineMatchHud(completed);

    assert.equal(completed.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].isReloading, false);
    assert.equal(completed.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].ammoInMagazine, WEAPONS.AK47.ammo.magazine);
    assert.equal(completed.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].reserveAmmo, WEAPONS.AK47.ammo.reserveMax - (WEAPONS.AK47.ammo.magazine - 11));
    assert.equal(hud.localPlayer.ammo.clip, WEAPONS.AK47.ammo.magazine);
    assert.equal(hud.localPlayer.ammo.reserve, WEAPONS.AK47.ammo.reserveMax - (WEAPONS.AK47.ammo.magazine - 11));
    assert.equal(hud.localPlayer.ammo.isReloading, false);
  }],

  ['starts reload from browser-like R local input path and completes after delay', () => {
    let state = createOfflineMatch({ localPlayerName: 'BrowserReloader' });
    state = advanceOfflineMatchTick(state, { localInput: { fire: true, seed: 91 } });
    assert.equal(state.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].ammoInMagazine, WEAPONS.AK47.ammo.magazine - 1);

    const reloading = advanceOfflineMatchTick(state, { localInput: { reload: true } });
    let hud = deriveOfflineMatchHud(reloading);

    assert.equal(reloading.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].isReloading, true);
    assert.equal(hud.localPlayer.ammo.isReloading, true);
    assert.equal(hud.localPlayer.ammo.clip, WEAPONS.AK47.ammo.magazine - 1);

    const completed = advanceOfflineMatchTick(Object.freeze({
      ...reloading,
      tick: 500,
      nowMs: reloading.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].reloadCompleteAtMs,
    }));
    hud = deriveOfflineMatchHud(completed);

    assert.equal(completed.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].isReloading, false);
    assert.equal(hud.localPlayer.ammo.clip, WEAPONS.AK47.ammo.magazine);
    assert.equal(hud.localPlayer.ammo.reserve, WEAPONS.AK47.ammo.reserveMax - 1);
  }],

  ['local firing can kill an aimed bot and update live kill feedback state', () => {
    let state = clearInitialSpawnProtection(createOfflineMatch({ localPlayerName: 'Killer' }));
    state = Object.freeze({
      ...state,
      controllersBySlotIndex: Object.freeze({
        ...state.controllersBySlotIndex,
        [LOCAL_PLAYER_SLOT_INDEX]: Object.freeze({ ...state.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX], position: Object.freeze({ x: 0, y: 0, z: 0 }), velocity: Object.freeze({ x: 0, y: 0, z: 0 }), view: Object.freeze({ yaw: 0, pitch: 0 }) }),
        1: Object.freeze({ ...state.controllersBySlotIndex[1], position: Object.freeze({ x: 0, y: 0, z: -12 }), radius: 1.25 }),
      }),
      weaponStatesBySlotIndex: Object.freeze({
        ...state.weaponStatesBySlotIndex,
        [LOCAL_PLAYER_SLOT_INDEX]: createWeaponState(WEAPONS.AWP.id),
      }),
      matchState: Object.freeze({
        ...state.matchState,
        players: Object.freeze(state.matchState.players.map((player, index) => index === LOCAL_PLAYER_SLOT_INDEX
          ? Object.freeze({ ...player, loadout: Object.freeze({ ...player.loadout, primaryWeaponId: WEAPONS.AWP.id, activeWeaponId: WEAPONS.AWP.id }), spawnProtectionUntilMs: 0 })
          : Object.freeze({ ...player, lifeState: index === 1 ? PLAYER_LIFE_STATES.ALIVE : PLAYER_LIFE_STATES.RESPAWNING, health: index === 1 ? 20 : player.health, armor: index === 1 ? 0 : player.armor, spawnProtectionUntilMs: 0 }))),
      }),
    });

    const fired = advanceOfflineMatchTick(state, { localInput: { fire: true, seed: 3 } });
    assert.equal(fired.lastLocalShot !== null, true);
    assert.equal(fired.lastLocalShot.hit.targetId, '1');
    assert.equal(fired.matchState.players[LOCAL_PLAYER_SLOT_INDEX].score.kills, 1);
    assert.equal(fired.matchState.players[1].lifeState, PLAYER_LIFE_STATES.RESPAWNING);
    assert.equal(fired.weaponStatesBySlotIndex[LOCAL_PLAYER_SLOT_INDEX].ammoInMagazine, WEAPONS.AWP.ammo.magazine - 1);
    assert.equal(fired.visualFeedbackBySlotIndex[1].recentDamageAtMs, fired.nowMs);
    assert.equal(fired.visualFeedbackBySlotIndex[1].recentDeathAtMs, fired.nowMs);
    assert.equal(fired.visualFeedbackBySlotIndex[1].recentDamage > 0, true);
  }],

  ['browser-like key and click spam queues one fixed tick without accelerating bots', () => {
    const state = createOfflineMatch({ localPlayerName: 'SpamGuard' });
    const advanced = advanceOfflineMatchTick(state, { localInput: { buttons: [INPUT_BUTTONS.FORWARD], fire: true, reload: true } });

    assert.equal(advanced.tick, state.tick + 1);
    assert.equal(advanced.nowMs, Math.round(advanced.tick * (1000 / 60)));
    assert.equal(advanced.metrics.movementDistance < 15, true);
  }],

  ['runs three deterministic T34 two-minute offline QA passes with active bots and local respawns', () => {
    const runConfigs = [
      Object.freeze({ label: 'seed-1-ak47-forward', name: 'T34 Alpha', weaponId: WEAPONS.AK47.id, yawDelta: 0, button: 'forward', seedOffset: 1000 }),
      Object.freeze({ label: 'seed-2-m4a1-strafe', name: 'T34 Bravo', weaponId: WEAPONS.M4A1.id, yawDelta: 140, button: 'right', seedOffset: 2000 }),
      Object.freeze({ label: 'seed-3-awp-hold', name: 'T34 Charlie', weaponId: WEAPONS.AWP.id, yawDelta: -120, button: null, seedOffset: 3000 }),
    ];
    const evidence = ['PASS T34 deterministic offline tuning QA', 'durationSeconds=120', 'tickRate=60', `respawnDelayMs=${COMBAT_DEFAULTS.respawnDelayMs}`, `spawnProtectionMs=${COMBAT_DEFAULTS.spawnProtectionMs}`];

    for (const config of runConfigs) {
      let state = createOfflineMatch({ localPlayerName: config.name });
      state = clearInitialSpawnProtection(buyOfflineWeapon(state, config.weaponId).state);
      const localInputs = Array.from({ length: 120 * 60 }, (_, tickIndex) => (tickIndex % 30 === 0 ? Object.freeze({
        buttons: config.button ? [config.button] : [],
        fire: true,
        seed: config.seedOffset + tickIndex,
        look: { yawDelta: config.yawDelta, pitchDelta: 0 },
      }) : null));
      let forcedLocalRespawns = 0;
      for (let tickIndex = 0; tickIndex < 120 * 60; tickIndex += 1) {
        if (tickIndex === 1200 || tickIndex === 3600) {
          state = forceOfflineKill(state, { killerSlotIndex: 1, victimSlotIndex: LOCAL_PLAYER_SLOT_INDEX });
          forcedLocalRespawns += 1;
        }
        state = advanceOfflineMatchTick(state, { localInput: localInputs[tickIndex] ?? null });
      }
      const finalState = state;
      const summary = summarizeOfflineMatch(finalState);
      const localPlayer = finalState.matchState.players[LOCAL_PLAYER_SLOT_INDEX];
      const botPlayers = finalState.matchState.players.filter((player) => player.slotType === SLOT_TYPES.BOT);
      const scoringRows = finalState.matchState.players.filter((player) => player.score.kills > 0 || player.score.deaths > 0).length;

      assert.equal(finalState.tick, 7200, `${config.label} should complete exactly 120 seconds`);
      assert.equal(summary.phase, MATCH_PHASES.RUNNING);
      assert.equal(summary.mode, OFFLINE_MATCH_PHASE);
      assert.equal(summary.botShotsFired > 10, true, `${config.label} should produce bot shooting`);
      assert.equal(summary.totalKills > 0, true, `${config.label} should produce kills`);
      assert.equal(summary.totalDeaths > 0, true, `${config.label} should produce deaths`);
      assert.equal(summary.botRespawns > 0, true, `${config.label} should produce respawns`);
      assert.equal(scoringRows > 1, true, `${config.label} should change the scoreboard`);
      assert.equal(botPlayers.some((player) => player.score.kills > 0), true, `${config.label} should have bot kills`);
      assert.equal(botPlayers.some((player) => player.score.deaths > 0), true, `${config.label} should have bot deaths`);
      assert.equal(forcedLocalRespawns, 2, `${config.label} should exercise repeated local respawns`);
      assert.equal(localPlayer.score.deaths >= forcedLocalRespawns, true, `${config.label} should record repeated local deaths`);
      assert.equal(localPlayer.lifeState, PLAYER_LIFE_STATES.ALIVE, `${config.label} should finish with local player playable`);

      evidence.push(`${config.label}: ticks=${finalState.tick} botShotsFired=${summary.botShotsFired} kills=${summary.totalKills} deaths=${summary.totalDeaths} botRespawns=${summary.botRespawns} localDeaths=${localPlayer.score.deaths} forcedLocalRespawns=${forcedLocalRespawns} scoringRows=${scoringRows} finalLocalState=${localPlayer.lifeState} activeWeapon=${localPlayer.loadout.activeWeaponId}`);
    }

    evidence.push('Browser Playwright PNG evidence was not used for T34 because deterministic Node runs are the accepted QA surface for this task.');
    writeEvidence('task-34-offline-tuning.txt', evidence);
  }],

  ['validates T34 respawns across all spawn points without wall or occupied-slot overlap', () => {
    const spawnOverlaps = getSpawnCollisionOverlaps();
    assert.deepEqual(spawnOverlaps, []);

    const minimumAllowedSpawnDistance = (SPAWN_CLEARANCE_RADIUS * 2) + PLAYER_MOVEMENT_DEFAULTS.collisionRadius;
    let minimumObservedDistance = Number.POSITIVE_INFINITY;
    for (let first = 0; first < MAP_SPAWN_POINTS.length; first += 1) {
      for (let second = first + 1; second < MAP_SPAWN_POINTS.length; second += 1) {
        minimumObservedDistance = Math.min(minimumObservedDistance, distance2d(MAP_SPAWN_POINTS[first].position, MAP_SPAWN_POINTS[second].position));
      }
    }
    assert.equal(minimumObservedDistance > minimumAllowedSpawnDistance, true);

    const respawnChecks = [];
    for (let cycle = 0; cycle < 7; cycle += 1) {
      for (const spawnPoint of MAP_SPAWN_POINTS) {
        const slotIndex = Number(spawnPoint.id.slice(-2));
        let state = createOfflineMatch({ localPlayerName: `Spawn${cycle}` });
        state = forceOfflineKill(state, { killerSlotIndex: slotIndex === LOCAL_PLAYER_SLOT_INDEX ? 1 : LOCAL_PLAYER_SLOT_INDEX, victimSlotIndex: slotIndex });
        state = advanceUntil(state, (nextState) => nextState.matchState.players[slotIndex].lifeState === PLAYER_LIFE_STATES.ALIVE && nextState.nowMs >= COMBAT_DEFAULTS.respawnDelayMs, 360);
        const wallOverlap = MAP_COLLISION_VOLUMES.some((volume) => pointOverlapsBox2d(spawnPoint.position, PLAYER_MOVEMENT_DEFAULTS.collisionRadius, volume));

        assert.equal(state.matchState.players[slotIndex].lifeState, PLAYER_LIFE_STATES.ALIVE);
        assert.equal(state.matchState.players[slotIndex].spawnId, spawnPoint.id);
        assert.equal(wallOverlap, false, `${spawnPoint.id} should not overlap collision volumes`);
        respawnChecks.push(`${spawnPoint.id}@${spawnPoint.position.x},${spawnPoint.position.z}`);
      }
    }

    assert.equal(respawnChecks.length >= 100, true);
    writeEvidence('task-34-spawn-validity.txt', [
      'PASS T34 spawn validity simulation',
      `respawnChecks=${respawnChecks.length}`,
      `spawnPoints=${MAP_SPAWN_POINTS.length}`,
      `wallCollisionOverlaps=${spawnOverlaps.length}`,
      `minimumSpawnDistance=${minimumObservedDistance.toFixed(3)}`,
      `minimumAllowedDistance=${minimumAllowedSpawnDistance.toFixed(3)}`,
      `sample=${respawnChecks.slice(0, 16).join(' | ')}`,
    ]);
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
