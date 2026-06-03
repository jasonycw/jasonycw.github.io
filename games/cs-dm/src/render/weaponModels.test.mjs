import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FALLBACK_WEAPON_MODEL,
  WEAPON_MODEL_LAYERS,
  WEAPON_MODEL_REGISTRY,
  WEAPON_MODEL_ROLES,
  buildWeaponLayerModel,
  deriveWeaponSwitchMetadata,
  getWeaponHudLabel,
  getWeaponModel,
  summarizeViewModelCameraVisibility,
} from './weaponModels.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const requiredRoleWeapons = Object.freeze({
  [WEAPON_MODEL_ROLES.MELEE]: 'knife',
  [WEAPON_MODEL_ROLES.PISTOL]: 'glock18',
  [WEAPON_MODEL_ROLES.RIFLE]: 'ak47',
  [WEAPON_MODEL_ROLES.SNIPER]: 'awp',
  [WEAPON_MODEL_ROLES.SMG]: 'mp5',
  [WEAPON_MODEL_ROLES.SHOTGUN]: 'm3',
  [WEAPON_MODEL_ROLES.MACHINE_GUN]: 'm249',
});

const assertVector = (value, label) => {
  assert.equal(Number.isFinite(value.x), true, `${label}.x should be finite`);
  assert.equal(Number.isFinite(value.y), true, `${label}.y should be finite`);
  assert.equal(Number.isFinite(value.z), true, `${label}.z should be finite`);
};

const tests = [
  ['exports representative original low-poly models for each weapon role', () => {
    for (const [role, weaponId] of Object.entries(requiredRoleWeapons)) {
      const result = getWeaponModel(weaponId);

      assert.equal(result.ok, true, `${weaponId} should resolve`);
      assert.equal(result.warning, null);
      assert.equal(result.model.role, role);
      assert.equal(result.model.weaponId, weaponId);
      assert.equal(result.model.originalAssetNote.includes('Original generated'), true);
      assert.equal(result.model.layers.world.parts.length >= 4, true, `${weaponId} world silhouette should have parts`);
      assert.equal(result.model.layers.viewmodel.parts.length >= 4, true, `${weaponId} viewmodel silhouette should have parts`);
    }

    writeEvidence('task-17-weapon-switch.txt', [
      'PASS T17 weapon switch model coverage',
      `roles=${Object.keys(requiredRoleWeapons).join(',')}`,
      `weapons=${Object.values(requiredRoleWeapons).join(',')}`,
      `ak47Hud=${getWeaponHudLabel('ak47')}`,
      `ak47SwitchRaiseMs=${deriveWeaponSwitchMetadata('ak47').switch.raiseMs}`,
      `ak47MuzzleHook=${JSON.stringify(deriveWeaponSwitchMetadata('ak47').viewmodel.hooks.muzzle)}`,
    ]);
  }],

  ['builders return immutable world and viewmodel descriptors with firing hooks', () => {
    const world = buildWeaponLayerModel('awp', WEAPON_MODEL_LAYERS.WORLD);
    const viewmodel = buildWeaponLayerModel('awp', WEAPON_MODEL_LAYERS.VIEWMODEL);
    const switchMetadata = deriveWeaponSwitchMetadata('awp');

    assert.equal(world.kind, 'low-poly-world-silhouette');
    assert.equal(viewmodel.kind, 'low-poly-viewmodel-silhouette');
    assert.equal(world.weaponName, 'AWP');
    assert.equal(viewmodel.parts.some((entry) => entry.id === 'vm-scope'), true);
    assertVector(switchMetadata.viewmodel.hooks.muzzle, 'muzzle');
    assertVector(switchMetadata.firing.kickOffset, 'kickOffset');
    assert.equal(switchMetadata.firing.muzzleFlash.kind, 'placeholder-cone');
    assert.equal(Number.isFinite(switchMetadata.pose.recoil.pitch), true);
    assert.equal(Number.isFinite(switchMetadata.pose.bob.amplitude), true);
    assert.equal(switchMetadata.reload.path.length >= 3, true);
    assert.equal(Object.isFrozen(switchMetadata), true);
  }],

  ['missing model falls back to safe placeholder with warning data', () => {
    const missing = getWeaponModel('not-a-weapon');
    const layer = buildWeaponLayerModel('not-a-weapon', WEAPON_MODEL_LAYERS.VIEWMODEL);
    const switchMetadata = deriveWeaponSwitchMetadata('not-a-weapon');

    assert.equal(missing.ok, false);
    assert.equal(missing.model, FALLBACK_WEAPON_MODEL);
    assert.equal(missing.warning.code, 'weapon-model-missing');
    assert.equal(missing.warning.weaponId, 'not-a-weapon');
    assert.equal(layer.kind, 'safe-placeholder-viewmodel-silhouette');
    assert.equal(layer.warning.code, 'weapon-model-missing');
    assert.equal(switchMetadata.hud.label, 'Unknown Weapon');
    assert.equal(switchMetadata.warning.message.includes('safe placeholder'), true);

    writeEvidence('task-17-model-fallback.txt', [
      'PASS T17 missing model fallback',
      `ok=${missing.ok}`,
      `warning=${missing.warning.code}`,
      `weaponId=${missing.warning.weaponId}`,
      `layer=${layer.kind}`,
      `hud=${switchMetadata.hud.label}`,
    ]);
  }],

  ['registry is linked to canonical weapon labels and exposes HUD switch metadata', () => {
    assert.equal(WEAPON_MODEL_REGISTRY.glock18.weaponName, 'Glock 18');
    assert.equal(WEAPON_MODEL_REGISTRY.ak47.weaponName, 'AK-47');
    assert.equal(WEAPON_MODEL_REGISTRY.m249.weaponName, 'M249');
    assert.equal(getWeaponHudLabel('mp5'), 'MP5 Navy');
    assert.equal(deriveWeaponSwitchMetadata('m3').hud.weaponId, 'm3');
    assert.equal(deriveWeaponSwitchMetadata('m3').viewmodel.layer.layer, WEAPON_MODEL_LAYERS.VIEWMODEL);
  }],

  ['known unmodelled weapons reuse role silhouettes while preserving HUD identity', () => {
    const usp = getWeaponModel('usp');
    const m4a1 = deriveWeaponSwitchMetadata('m4a1');

    assert.equal(usp.ok, true);
    assert.equal(usp.warning.code, 'weapon-model-role-fallback');
    assert.equal(usp.warning.modelWeaponId, 'glock18');
    assert.equal(m4a1.hud.label, 'M4A1');
    assert.equal(m4a1.weaponId, 'm4a1');
    assert.equal(m4a1.warning.code, 'weapon-model-role-fallback');
    assert.equal(m4a1.viewmodel.layer.weaponId, 'ak47');
  }],

  ['viewmodel camera alignment keeps AK Glock and knife silhouettes in frustum', () => {
    const summaries = ['ak47', 'glock18', 'knife'].map((weaponId) => summarizeViewModelCameraVisibility(weaponId));

    assert.deepEqual(summaries[0].alignment.coordinateContract, { screenRight: '+X', up: '+Y', forward: '-Z' });
    summaries.forEach((summary) => {
      assert.equal(summary.visiblePartCount >= 3, true, `${summary.weaponId} should have multiple visible parts`);
      assert.equal(summary.parts.some((entry) => entry.depth > summary.alignment.camera.near), true, `${summary.weaponId} should be in front of the near plane`);
      const switchMetadata = deriveWeaponSwitchMetadata(summary.requestedWeaponId);
      assert.equal(switchMetadata.viewmodel.hooks.muzzle.z < switchMetadata.pose.origin.z, true, `${summary.weaponId} muzzle should sit forward on -Z from the lower-right origin`);
      assert.equal(switchMetadata.firing.kickOffset.z > 0, true, `${summary.weaponId} recoil should kick back toward the camera on +Z`);
    });
    assert.equal(deriveWeaponSwitchMetadata('ak47').viewmodel.layer.parts.find((entry) => entry.id === 'vm-barrel').rotation.x > 1, true, 'AK barrel cylinder should be rotated to face -Z');
    assert.equal(deriveWeaponSwitchMetadata('glock18').viewmodel.layer.parts.find((entry) => entry.id === 'vm-barrel').rotation.x > 1, true, 'Glock barrel cylinder should be rotated to face -Z');
    assert.equal(summaries[0].parts.some((entry) => entry.id.includes('curved-magazine') && entry.visible), true, 'AK magazine should be visible');
    assert.equal(summaries[1].parts.some((entry) => entry.id.includes('frame') && entry.visible), true, 'Glock frame should be visible');
    assert.equal(summaries[2].parts.some((entry) => entry.id.includes('blade') && entry.visible), true, 'Knife blade should be visible');

    writeEvidence('task-viewmodel-camera-visibility.txt', [
      'PASS CS DM viewmodel camera visibility',
      ...summaries.map((summary) => `${summary.requestedWeaponId}->${summary.weaponId}: visibleParts=${summary.visiblePartCount} depths=${summary.parts.map((entry) => `${entry.id}:${entry.depth}`).join('|')}`),
      'Surface: camera-attached Three.js primitive viewmodel, not CSS overlay art',
    ]);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS weapon models - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL weapon models - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
