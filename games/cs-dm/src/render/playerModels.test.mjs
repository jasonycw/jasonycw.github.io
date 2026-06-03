import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FACTIONS } from '../config/index.js';
import { PLAYER_MOVEMENT_DEFAULTS } from '../player/index.js';
import {
  buildPlayerModel,
  createPlayerModelPrimitiveDescriptors,
  PLAYER_MODEL_HITBOX,
  PLAYER_MODEL_IDS,
  PLAYER_MODEL_STATE_IDS,
  PLAYER_MODEL_VARIANTS,
  summarizePlayerModelDebug,
} from './playerModels.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

class FakeGroup {
  constructor() {
    this.children = [];
    this.position = { set() {} };
    this.rotation = { set() {} };
  }

  add(child) {
    this.children.push(child);
  }
}

class FakeMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = { set: (x, y, z) => { this.positionValue = { x, y, z }; } };
    this.rotation = { set: (x, y, z) => { this.rotationValue = { x, y, z }; } };
  }
}

const FakeTHREE = Object.freeze({
  Group: FakeGroup,
  Mesh: FakeMesh,
  BoxGeometry: class FakeBoxGeometry {
    constructor(x, y, z) {
      this.kind = 'box';
      this.size = { x, y, z };
    }
  },
  CylinderGeometry: class FakeCylinderGeometry {
    constructor(radiusTop, radiusBottom, height, segments) {
      this.kind = 'cylinder';
      this.radiusTop = radiusTop;
      this.radiusBottom = radiusBottom;
      this.height = height;
      this.segments = segments;
    }
  },
  MeshStandardMaterial: class FakeMeshStandardMaterial {
    constructor(options) {
      this.options = options;
    }
  },
});

const requiredStateIds = ['idle', 'run', 'crouch', 'jump', 'fall', 'aim', 'fire', 'death', 'respawn'];

const tests = [
  ['exports two original faction-style variants with distinct palettes and silhouettes', () => {
    const variants = Object.values(PLAYER_MODEL_VARIANTS);
    assert.equal(variants.length >= 2, true);
    assert.equal(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.CT_RANGER].faction, FACTIONS.COUNTER_TERRORISTS);
    assert.equal(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.T_RAIDER].faction, FACTIONS.TERRORISTS);
    assert.notDeepEqual(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.CT_RANGER].palette, PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.T_RAIDER].palette);
    assert.notEqual(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.CT_RANGER].silhouette, PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.T_RAIDER].silhouette);
    assert.equal(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.CT_RANGER].parts.some((part) => part.id === 'ct-radio-mast'), true);
    assert.equal(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.CT_RANGER].parts.some((part) => part.id === 'ct-backpack'), true);
    assert.equal(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.CT_RANGER].parts.some((part) => part.id === 'ct-visor'), true);
    assert.equal(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.CT_RANGER].parts.some((part) => part.id === 'ct-chest-plate'), true);
    assert.equal(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.T_RAIDER].parts.some((part) => part.id === 't-scarf-tail'), true);
    assert.equal(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.T_RAIDER].parts.some((part) => part.id === 't-soft-pack'), true);
    assert.equal(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.T_RAIDER].parts.some((part) => part.id === 't-bandolier-rounds'), true);
    assert.equal(PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.T_RAIDER].parts.some((part) => part.id === 't-face-wrap'), true);
  }],

  ['keeps hitbox and collision dimensions identical across variants', () => {
    const hitboxes = Object.values(PLAYER_MODEL_VARIANTS).map((variant) => variant.hitbox);
    for (const hitbox of hitboxes) {
      assert.deepEqual(hitbox, PLAYER_MODEL_HITBOX);
      assert.equal(hitbox.radius, PLAYER_MOVEMENT_DEFAULTS.collisionRadius);
      assert.equal(hitbox.standingHeight, PLAYER_MOVEMENT_DEFAULTS.standingHeight);
      assert.equal(hitbox.crouchingHeight, PLAYER_MOVEMENT_DEFAULTS.crouchingHeight);
    }

    writeEvidence('task-16-hitboxes.txt', [
      'T16 hitbox evidence',
      `variants=${Object.keys(PLAYER_MODEL_VARIANTS).join(',')}`,
      `radius=${PLAYER_MODEL_HITBOX.radius}`,
      `standingHeight=${PLAYER_MODEL_HITBOX.standingHeight}`,
      `crouchingHeight=${PLAYER_MODEL_HITBOX.crouchingHeight}`,
      `allVariantsShareHitbox=${hitboxes.every((hitbox) => hitbox === PLAYER_MODEL_HITBOX)}`,
    ]);
  }],

  ['covers required animation and model state descriptors', () => {
    for (const stateId of requiredStateIds) {
      assert.equal(PLAYER_MODEL_STATE_IDS.includes(stateId), true, `${stateId} should exist`);
    }
  }],

  ['creates debug-verifiable primitive descriptors and model groups', () => {
    for (const variant of Object.values(PLAYER_MODEL_VARIANTS)) {
      const descriptors = createPlayerModelPrimitiveDescriptors(variant.id);
      const model = buildPlayerModel(FakeTHREE, variant.id);
      assert.equal(descriptors.length, variant.parts.length);
      assert.equal(descriptors.every((part) => part.color.startsWith('#')), true);
      assert.equal(model.name, variant.id);
      assert.equal(model.children.length, variant.parts.length);
      assert.equal(model.children.some((child) => child.userData.role === 'silhouette'), true);
      assert.deepEqual(model.userData.states, PLAYER_MODEL_STATE_IDS);
      assert.deepEqual(model.userData.hitbox, PLAYER_MODEL_HITBOX);
    }

    const debugSummary = summarizePlayerModelDebug();
    assert.equal(debugSummary.length, Object.keys(PLAYER_MODEL_VARIANTS).length);
    assert.equal(debugSummary.every((entry) => entry.partCount >= 20), true);

    writeEvidence('task-16-player-models.txt', [
      'T16 player model evidence',
      `variants=${debugSummary.map((entry) => `${entry.id}:${entry.faction}:${entry.partCount}`).join('|')}`,
      `states=${PLAYER_MODEL_STATE_IDS.join(',')}`,
      `ctSilhouette=${PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.CT_RANGER].silhouette}`,
      `tSilhouette=${PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.T_RAIDER].silhouette}`,
      'assets=generated Three.js primitive metadata only',
    ]);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS player models - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL player models - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
