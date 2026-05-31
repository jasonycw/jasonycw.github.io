import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMBAT_DEFAULTS, DEFAULT_LOADOUT, MATCH_PHASES, PLAYER_LIFE_STATES, WEAPONS } from '../config/index.js';
import { createMatchState, createOfflineSlots } from '../core/index.js';
import { createWeaponState } from '../weapons/index.js';
import { applyCombatShot, applyDamage, advanceRespawnTimers } from './combat.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const withPlayers = (players) => createMatchState({ phase: MATCH_PHASES.RUNNING, players: Object.freeze(players) });

const setPlayer = (players, slotIndex, fields) => Object.freeze(players.map((player, index) => index === slotIndex ? Object.freeze({ ...player, ...fields }) : player));

const customLoadout = Object.freeze({
  primaryWeaponId: WEAPONS.AWP.id,
  secondaryWeaponId: WEAPONS.DEAGLE.id,
  equipmentIds: Object.freeze([WEAPONS.KNIFE.id, WEAPONS.KEVLAR.id]),
  activeWeaponId: WEAPONS.AWP.id,
});

const tests = [
  ['combat shot applies hitscan damage, death, score, respawn, and loadout persistence', () => {
    const basePlayers = createOfflineSlots('Sharpshooter');
    const matchState = withPlayers(setPlayer(basePlayers, 1, {
      loadout: customLoadout,
      health: COMBAT_DEFAULTS.maxHealth,
      armor: 0,
      spawnProtectionUntilMs: 0,
    }));
    const shotResult = applyCombatShot(matchState, {
      shooterSlotIndex: 0,
      weaponState: createWeaponState(WEAPONS.AWP.id),
      nowMs: COMBAT_DEFAULTS.spawnProtectionMs + 1,
      seed: 5,
      controllersBySlotIndex: Object.freeze({
        0: Object.freeze({ position: Object.freeze({ x: 0, y: 0, z: 0 }) }),
        1: Object.freeze({ position: Object.freeze({ x: 0, y: 0, z: 30 }), radius: 2 }),
      }),
      direction: { x: 0, y: 0, z: 1 },
    });

    assert.equal(shotResult.ok, true);
    assert.equal(shotResult.shot.hit.targetId, '1');
    assert.equal(shotResult.matchState.players[1].lifeState, PLAYER_LIFE_STATES.RESPAWNING);
    assert.equal(shotResult.matchState.players[1].health, 0);
    assert.equal(shotResult.matchState.players[0].score.kills, 1);
    assert.equal(shotResult.matchState.players[1].score.deaths, 1);
    assert.deepEqual(shotResult.matchState.players[1].loadout, customLoadout);

    const respawned = advanceRespawnTimers(shotResult.matchState, { nowMs: shotResult.matchState.players[1].respawnAtMs });
    assert.equal(respawned.players[1].lifeState, PLAYER_LIFE_STATES.ALIVE);
    assert.equal(respawned.players[1].health, COMBAT_DEFAULTS.maxHealth);
    assert.equal(respawned.players[1].spawnProtectionUntilMs, shotResult.matchState.players[1].respawnAtMs + COMBAT_DEFAULTS.spawnProtectionMs);
    assert.deepEqual(respawned.players[1].loadout, customLoadout);

    writeEvidence('task-18-respawn-loadout.txt', [
      'PASS T18 death respawn loadout persistence',
      `killerKills=${respawned.players[0].score.kills}`,
      `victimDeaths=${respawned.players[1].score.deaths}`,
      `victimLifeState=${respawned.players[1].lifeState}`,
      `loadout=${respawned.players[1].loadout.primaryWeaponId}/${respawned.players[1].loadout.secondaryWeaponId}/${respawned.players[1].loadout.activeWeaponId}`,
      `spawnProtectionUntilMs=${respawned.players[1].spawnProtectionUntilMs}`,
    ]);
  }],

  ['spawn protection ignores damage until expiry and firing breaks attacker protection', () => {
    const protectedPlayer = Object.freeze({
      ...createOfflineSlots('Protected')[1],
      health: COMBAT_DEFAULTS.maxHealth,
      armor: 0,
      spawnProtectionUntilMs: 5000,
    });
    const ignored = applyDamage(protectedPlayer, { damage: 99, nowMs: 4999, attackerSlotIndex: 0 });
    const applied = applyDamage(protectedPlayer, { damage: 40, nowMs: 5000, attackerSlotIndex: 0 });

    assert.equal(ignored.ignored, 'spawn-protected');
    assert.equal(ignored.player.health, COMBAT_DEFAULTS.maxHealth);
    assert.equal(applied.ignored, null);
    assert.equal(applied.player.health, 60);

    const matchState = withPlayers(setPlayer(createOfflineSlots('Breaker'), 1, { spawnProtectionUntilMs: 0 }));
    const shotResult = applyCombatShot(matchState, {
      shooterSlotIndex: 0,
      weaponState: createWeaponState(DEFAULT_LOADOUT.activeWeaponId),
      nowMs: 10,
      seed: 3,
      controllersBySlotIndex: Object.freeze({
        0: Object.freeze({ position: Object.freeze({ x: 0, y: 0, z: 0 }) }),
        1: Object.freeze({ position: Object.freeze({ x: 0, y: 0, z: 30 }), radius: 2 }),
      }),
      direction: { x: 0, y: 0, z: 1 },
    });

    assert.equal(shotResult.ok, true);
    assert.equal(shotResult.matchState.players[0].spawnProtectionUntilMs, 0);
    assert.equal(shotResult.matchState.players[0].spawnProtectionBreakReason, 'fire');

    writeEvidence('task-18-spawn-protection.txt', [
      'PASS T18 spawn protection',
      `ignoredBeforeExpiry=${ignored.ignored}`,
      `healthBeforeExpiry=${ignored.player.health}`,
      `healthAfterExpiry=${applied.player.health}`,
      `breakCondition=${shotResult.matchState.players[0].spawnProtectionBreakReason}`,
    ]);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS combat gameplay - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL combat gameplay - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
