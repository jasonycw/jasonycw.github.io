import assert from 'node:assert/strict';

import {
  compareFfaScoreboardRows,
  deriveHudData,
  deriveHudPlayer,
  deriveScoreboardRows,
} from './hudData.js';
import { PLAYER_LIFE_STATES, SLOT_TYPES } from '../config/index.js';

const players = Object.freeze([
  Object.freeze({ slotIndex: 0, slotType: SLOT_TYPES.LOCAL, name: 'Local', lifeState: PLAYER_LIFE_STATES.ALIVE, health: 100, armor: 50, loadout: { activeWeaponId: 'ak47' }, score: { kills: 4, deaths: 1 } }),
  Object.freeze({ slotIndex: 1, slotType: SLOT_TYPES.BOT, name: 'Alpha', lifeState: PLAYER_LIFE_STATES.ALIVE, health: 80, armor: 25, loadout: { activeWeaponId: 'glock18' }, score: { kills: 6, deaths: 2 } }),
  Object.freeze({ slotIndex: 2, slotType: SLOT_TYPES.BOT, name: 'Bravo', lifeState: PLAYER_LIFE_STATES.ALIVE, health: 65, armor: 0, loadout: { activeWeaponId: 'mp5' }, score: { kills: 6, deaths: 1 } }),
  Object.freeze({ slotIndex: 3, slotType: SLOT_TYPES.BOT, name: 'Charlie', lifeState: PLAYER_LIFE_STATES.ALIVE, health: 40, armor: 75, loadout: { activeWeaponId: 'awp' }, score: { kills: 6, deaths: 1 } }),
]);

const tests = [
  ['derives scoreboard rows with deterministic FFA ordering', () => {
    const rows = deriveScoreboardRows(players);

    assert.equal(rows[0].name, 'Bravo');
    assert.equal(rows[1].name, 'Charlie');
    assert.equal(rows[2].name, 'Alpha');
    assert.equal(rows[0].score.kills, 6);
    assert.equal(rows[0].score.deaths, 1);
    assert.equal(rows[1].score.kills, 6);
    assert.equal(rows[1].score.deaths, 1);
    assert.equal(rows[2].score.kills, 6);
    assert.equal(rows[2].score.deaths, 2);
  }],

  ['derives dead local player HUD safely', () => {
    const hud = deriveHudPlayer(Object.freeze({ slotIndex: 0, slotType: SLOT_TYPES.LOCAL, name: 'Local', lifeState: PLAYER_LIFE_STATES.RESPAWNING, health: 0, armor: 0, loadout: { activeWeaponId: 'ak47' }, score: { kills: 8, deaths: 3 } }));

    assert.equal(hud.lifeState, PLAYER_LIFE_STATES.RESPAWNING);
    assert.equal(hud.health, 0);
    assert.equal(hud.armor, 0);
    assert.equal(hud.loadout.activeWeaponId, 'ak47');
    assert.equal(hud.ammo.weaponId, 'ak47');
    assert.equal(hud.ammo.clip, 30);
    assert.equal(hud.ammo.reserve, 90);
    assert.equal(hud.ammo.ammoType, '762');
    assert.equal(hud.activeWeapon.hud.label, 'AK-47');
    assert.equal(hud.activeWeapon.viewmodel.layer.weaponId, 'ak47');
    assert.equal(hud.activeWeapon.firing.muzzleFlash.kind, 'placeholder-cone');
    assert.equal(hud.latency.ms, null);
    assert.equal(hud.respawnCountdown.ticksRemaining, null);
    assert.equal(hud.respawnCountdown.secondsRemaining, null);
  }],

  ['derives complete HUD data with local player and session clock', () => {
    const hud = deriveHudData(Object.freeze({ phase: 'running', tick: 144, players }), { localSlotIndex: 0 });

    assert.equal(hud.sessionClock.phase, 'running');
    assert.equal(hud.sessionClock.tick, 144);
    assert.equal(hud.radar.kind, 'placeholder');
    assert.equal(hud.localPlayer.name, 'Local');
    assert.equal(hud.scoreboard.length, 16);
  }],

  ['keeps comparator stable on name ties', () => {
    const sorted = [
      { name: 'Alpha', score: { kills: 5, deaths: 2 }, slotIndex: 2 },
      { name: 'alpha', score: { kills: 5, deaths: 2 }, slotIndex: 1 },
    ].sort(compareFfaScoreboardRows);

    assert.equal(sorted[0].slotIndex, 1);
    assert.equal(sorted[1].slotIndex, 2);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS hud data - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL hud data - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
