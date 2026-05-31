import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_LOADOUT, WEAPON_CATEGORIES, WEAPONS } from '../config/index.js';
import {
  BUY_MODE,
  getBuyCategories,
  getBuyWeaponsForCategory,
  getLoadoutWeaponSwitchMetadata,
  getLoadoutWeaponLabel,
  selectBuyPurchase,
} from './buyMenu.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const tests = [
  ['derives configured buy categories in weapon metadata order', () => {
    const categories = getBuyCategories();

    assert.equal(categories.length, 7);
    assert.deepEqual(categories.map((category) => category.id), [
      WEAPON_CATEGORIES.PISTOL,
      WEAPON_CATEGORIES.SHOTGUN,
      WEAPON_CATEGORIES.SMG,
      WEAPON_CATEGORIES.RIFLE,
      WEAPON_CATEGORIES.SNIPER,
      WEAPON_CATEGORIES.MACHINE_GUN,
      WEAPON_CATEGORIES.EQUIPMENT,
    ]);
  }],

  ['lists rifle weapons from canonical T10 records', () => {
    const rifles = getBuyWeaponsForCategory(WEAPON_CATEGORIES.RIFLE);

    assert.equal(rifles.some((weapon) => weapon.id === WEAPONS.AK47.id), true);
    assert.equal(rifles.every((weapon) => weapon.buyCategory === WEAPON_CATEGORIES.RIFLE), true);
  }],

  ['selects AK-47 as a free deathmatch primary purchase', () => {
    const startingLoadout = Object.freeze({
      ...DEFAULT_LOADOUT,
      primaryWeaponId: WEAPONS.MP5.id,
      activeWeaponId: WEAPONS.MP5.id,
    });
    const result = selectBuyPurchase(startingLoadout, WEAPONS.AK47.id);

    assert.equal(result.ok, true);
    assert.equal(result.reason, 'free-buy-selected');
    assert.deepEqual(result.mode, BUY_MODE);
    assert.equal(result.selectedWeapon.name, 'AK-47');
    assert.equal(result.loadout.primaryWeaponId, WEAPONS.AK47.id);
    assert.equal(result.loadout.activeWeaponId, WEAPONS.AK47.id);
    assert.equal(getLoadoutWeaponLabel(result.loadout), 'AK-47');
    assert.equal(result.switchMetadata.hud.label, 'AK-47');
    assert.equal(result.switchMetadata.viewmodel.layer.weaponId, WEAPONS.AK47.id);
    assert.equal(getLoadoutWeaponSwitchMetadata(result.loadout).firing.muzzleFlash.kind, 'placeholder-cone');

    writeEvidence('task-19-buy-rifle.txt', [
      'T19 buy rifle evidence',
      'Scenario: select AK-47 from Rifles in deathmatch free-buy mode',
      `Result ok: ${result.ok}`,
      `Reason: ${result.reason}`,
      `Mode: ${result.mode.kind}`,
      `Primary: ${result.loadout.primaryWeaponId}`,
      `Active HUD label: ${getLoadoutWeaponLabel(result.loadout)}`,
      `Viewmodel: ${result.switchMetadata.viewmodel.layer.kind}`,
    ]);
  }],

  ['selects non-AK primary secondary sniper and equipment purchases', () => {
    const m4 = selectBuyPurchase(DEFAULT_LOADOUT, WEAPONS.M4A1.id);
    const awp = selectBuyPurchase(m4.loadout, WEAPONS.AWP.id);
    const usp = selectBuyPurchase(awp.loadout, WEAPONS.USP.id);
    const kevlar = selectBuyPurchase(usp.loadout, WEAPONS.KEVLAR.id);

    assert.equal(m4.ok, true);
    assert.equal(m4.loadout.primaryWeaponId, WEAPONS.M4A1.id);
    assert.equal(m4.loadout.activeWeaponId, WEAPONS.M4A1.id);
    assert.equal(getLoadoutWeaponLabel(m4.loadout), 'M4A1');

    assert.equal(awp.ok, true);
    assert.equal(awp.loadout.primaryWeaponId, WEAPONS.AWP.id);
    assert.equal(awp.loadout.activeWeaponId, WEAPONS.AWP.id);
    assert.equal(getLoadoutWeaponLabel(awp.loadout), 'AWP');

    assert.equal(usp.ok, true);
    assert.equal(usp.loadout.secondaryWeaponId, WEAPONS.USP.id);
    assert.equal(usp.loadout.activeWeaponId, WEAPONS.USP.id);
    assert.equal(getLoadoutWeaponLabel(usp.loadout), 'USP');

    assert.equal(kevlar.ok, true);
    assert.deepEqual(kevlar.loadout.equipmentIds, [WEAPONS.KNIFE.id, WEAPONS.KEVLAR.id]);
    assert.equal(kevlar.loadout.activeWeaponId, WEAPONS.USP.id);

    writeEvidence('task-19-non-ak-buy.txt', [
      'T19 non-AK buy evidence',
      'Scenario: select M4A1, AWP, USP, and Kevlar in deathmatch free-buy mode',
      `M4A1 primary active: ${m4.loadout.activeWeaponId}`,
      `AWP primary active: ${awp.loadout.activeWeaponId}`,
      `USP secondary active: ${usp.loadout.activeWeaponId}`,
      `Equipment after Kevlar: ${kevlar.loadout.equipmentIds.join(',')}`,
      `Final HUD label: ${getLoadoutWeaponLabel(kevlar.loadout)}`,
    ]);
  }],

  ['invalid purchase keeps current loadout unchanged', () => {
    const startingLoadout = Object.freeze({
      primaryWeaponId: WEAPONS.M4A1.id,
      secondaryWeaponId: WEAPONS.USP.id,
      equipmentIds: Object.freeze([WEAPONS.KNIFE.id, WEAPONS.KEVLAR.id]),
      activeWeaponId: WEAPONS.M4A1.id,
    });
    const result = selectBuyPurchase(startingLoadout, 'not-a-real-weapon');

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid-weapon');
    assert.equal(result.error.length > 0, true);
    assert.deepEqual(result.loadout, startingLoadout);
    assert.equal(getLoadoutWeaponLabel(result.loadout), 'M4A1');

    writeEvidence('task-19-invalid-buy.txt', [
      'T19 invalid buy evidence',
      'Scenario: select an unknown weapon id',
      `Result ok: ${result.ok}`,
      `Reason: ${result.reason}`,
      `Visible error: ${result.error}`,
      `Primary preserved: ${result.loadout.primaryWeaponId}`,
      `Active HUD label preserved: ${getLoadoutWeaponLabel(result.loadout)}`,
    ]);
  }],

  ['equipment purchases are free and replace only matching equipment slot', () => {
    const armored = selectBuyPurchase(DEFAULT_LOADOUT, WEAPONS.KEVLAR.id);
    const helmet = selectBuyPurchase(armored.loadout, WEAPONS.KEVLAR_HELMET.id);

    assert.equal(armored.ok, true);
    assert.equal(helmet.ok, true);
    assert.equal(helmet.loadout.primaryWeaponId, DEFAULT_LOADOUT.primaryWeaponId);
    assert.equal(helmet.loadout.activeWeaponId, DEFAULT_LOADOUT.activeWeaponId);
    assert.deepEqual(helmet.loadout.equipmentIds, [WEAPONS.KNIFE.id, WEAPONS.KEVLAR_HELMET.id]);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS buy menu - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL buy menu - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
