import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BUY_CATEGORY_METADATA,
  completeReload,
  computeSpreadOffset,
  createWeaponState,
  fireWeapon,
  getWeaponSpeedModifier,
  GRENADE_SCOPE_NOTE,
  startReload,
  WEAPON_CATEGORIES,
  WEAPON_LIST,
  WEAPONS,
} from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const requiredCategories = Object.freeze([
  WEAPON_CATEGORIES.PISTOL,
  WEAPON_CATEGORIES.SHOTGUN,
  WEAPON_CATEGORIES.SMG,
  WEAPON_CATEGORIES.RIFLE,
  WEAPON_CATEGORIES.SNIPER,
  WEAPON_CATEGORIES.MACHINE_GUN,
  WEAPON_CATEGORIES.EQUIPMENT,
]);

const tests = [
  ['exports representative CS1.6-named weapon data for each category', () => {
    assert.equal(WEAPON_LIST.length >= 24, true);

    for (const category of requiredCategories) {
      assert.equal(WEAPON_LIST.some((weaponRecord) => weaponRecord.category === category), true, `${category} category should have at least one weapon`);
      assert.equal(BUY_CATEGORY_METADATA[category].id, category);
    }

    const expectedNames = ['Glock 18', 'USP', 'Desert Eagle', 'M3', 'XM1014', 'MP5 Navy', 'AK-47', 'M4A1', 'AWP', 'M249', 'Kevlar Vest'];
    for (const expectedName of expectedNames) {
      assert.equal(WEAPON_LIST.some((weaponRecord) => weaponRecord.name === expectedName), true, `${expectedName} should exist`);
    }

    assert.equal(GRENADE_SCOPE_NOTE.includes('omitted'), true);
  }],

  ['weapon data is complete for future buy, combat, and movement systems', () => {
    for (const weaponRecord of WEAPON_LIST) {
      assert.equal(typeof weaponRecord.id, 'string');
      assert.equal(typeof weaponRecord.name, 'string');
      assert.equal(requiredCategories.includes(weaponRecord.category), true, `${weaponRecord.id} should use a known category`);
      assert.equal(Number.isFinite(weaponRecord.cost), true, `${weaponRecord.id} should have cost metadata`);
      assert.equal(typeof weaponRecord.equipmentSlot, 'string', `${weaponRecord.id} should have equipment slot metadata`);
      assert.equal(Number.isFinite(weaponRecord.ammo.magazine), true, `${weaponRecord.id} should have magazine ammo`);
      assert.equal(Number.isFinite(weaponRecord.ammo.reserveMax), true, `${weaponRecord.id} should have reserve ammo`);
      assert.equal(Number.isFinite(weaponRecord.fireRate), true, `${weaponRecord.id} should have fireRate`);
      assert.equal(Number.isFinite(weaponRecord.reloadMs), true, `${weaponRecord.id} should have reloadMs`);
      assert.equal(Number.isFinite(weaponRecord.damage.close), true, `${weaponRecord.id} should have close damage`);
      assert.equal(Number.isFinite(weaponRecord.damage.far), true, `${weaponRecord.id} should have far damage`);
      assert.equal(Number.isFinite(weaponRecord.speedModifier), true, `${weaponRecord.id} should have speedModifier`);
    }

    writeEvidence('task-10-weapon-data.txt', [
      'PASS T10 weapon data validates',
      `weaponCount=${WEAPON_LIST.length}`,
      `categories=${requiredCategories.join(',')}`,
      `grenades=${GRENADE_SCOPE_NOTE}`,
    ]);
  }],

  ['firing consumes ammo and deterministic hitscan returns repeatable spread', () => {
    const firstState = createWeaponState(WEAPONS.AK47.id);
    const shotOptions = {
      nowMs: 0,
      seed: 1337,
      origin: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: 1 },
      targets: [{ id: 'target-a', position: { x: 0.2, y: 0.2, z: 30 }, radius: 1.5 }],
    };
    const firstShot = fireWeapon(firstState, shotOptions);
    const repeatedShot = fireWeapon(firstState, shotOptions);

    assert.equal(firstShot.ok, true);
    assert.equal(firstShot.state.ammoInMagazine, WEAPONS.AK47.ammo.magazine - 1);
    assert.deepEqual(firstShot.shot.spreadOffset, repeatedShot.shot.spreadOffset);
    assert.equal(firstShot.shot.hit.targetId, 'target-a');
    assert.equal(firstShot.shot.damage > 0, true);

    const coolingDown = fireWeapon(firstShot.state, { nowMs: 10, seed: 1337 });
    assert.equal(coolingDown.ok, false);
    assert.equal(coolingDown.reason, 'cooldown');
  }],

  ['reload transfers reserve ammo only after reload time completes', () => {
    const firstShot = fireWeapon(createWeaponState(WEAPONS.USP.id), { nowMs: 0, seed: 7 });
    const reloadStarted = startReload(firstShot.state, 1000);
    const tooEarly = completeReload(reloadStarted.state, 1000 + WEAPONS.USP.reloadMs - 1);
    const reloadComplete = completeReload(reloadStarted.state, 1000 + WEAPONS.USP.reloadMs);

    assert.equal(reloadStarted.ok, true);
    assert.equal(tooEarly.ok, false);
    assert.equal(tooEarly.reason, 'reload-not-ready');
    assert.equal(reloadComplete.ok, true);
    assert.equal(reloadComplete.state.ammoInMagazine, WEAPONS.USP.ammo.magazine);
    assert.equal(reloadComplete.state.reserveAmmo, WEAPONS.USP.ammo.reserveMax - 1);
  }],

  ['empty Glock magazine blocks one extra shot with reload-required state', () => {
    let state = createWeaponState(WEAPONS.GLOCK18.id);
    let nowMs = 0;
    let shots = 0;

    while (state.ammoInMagazine > 0) {
      const result = fireWeapon(state, { nowMs, seed: 99 });
      assert.equal(result.ok, true);
      state = result.state;
      shots += 1;
      nowMs = state.nextFireAtMs;
    }

    const extraShot = fireWeapon(state, { nowMs, seed: 99 });
    assert.equal(shots, WEAPONS.GLOCK18.ammo.magazine);
    assert.equal(state.ammoInMagazine, 0);
    assert.equal(extraShot.ok, false);
    assert.equal(extraShot.reason, 'reload-required');
    assert.equal(extraShot.shot, null);

    writeEvidence('task-10-empty-mag.txt', [
      'PASS T10 empty magazine blocks firing',
      `weapon=${WEAPONS.GLOCK18.name}`,
      `shotsFired=${shots}`,
      `extraShotOk=${extraShot.ok}`,
      `extraShotReason=${extraShot.reason}`,
    ]);
  }],

  ['weapon speed modifiers are deterministic and heavier weapons are slower', () => {
    assert.equal(getWeaponSpeedModifier(WEAPONS.KNIFE.id), 1);
    assert.equal(getWeaponSpeedModifier(WEAPONS.AWP.id) < getWeaponSpeedModifier(WEAPONS.GLOCK18.id), true);
    assert.equal(getWeaponSpeedModifier(WEAPONS.M249.id) < getWeaponSpeedModifier(WEAPONS.AK47.id), true);
    assert.deepEqual(
      computeSpreadOffset(WEAPONS.M4A1, { seed: 42, shotIndex: 3, moving: true }),
      computeSpreadOffset(WEAPONS.M4A1, { seed: 42, shotIndex: 3, moving: true }),
    );
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS weapon mechanics - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL weapon mechanics - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
