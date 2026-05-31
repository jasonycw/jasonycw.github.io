import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { INPUT_BUTTONS } from '../core/index.js';
import { MAP_COLLISION_VOLUMES } from '../map/index.js';
import { WEAPONS } from '../weapons/index.js';
import {
  createPlayerControllerState,
  PLAYER_MOVEMENT_CONTRACT,
  PLAYER_MOVEMENT_DEFAULTS,
  simulatePlayerMovement,
  simulatePlayerMovementStep,
} from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const runFrames = (state, frame, count) => simulatePlayerMovement(
  state,
  Array.from({ length: count }, () => frame),
);

const tests = [
  ['exports an explicit player movement contract and initial state', () => {
    const state = createPlayerControllerState();

    assert.equal(PLAYER_MOVEMENT_CONTRACT.activeWeaponId.includes('speed'), true);
    assert.equal(state.position.x, 10);
    assert.equal(state.movement.grounded, true);
    assert.equal(state.movement.crouching, false);
    assert.equal(state.movement.jumping, false);
    assert.equal(state.movement.height, PLAYER_MOVEMENT_DEFAULTS.standingHeight);
    assert.equal(state.activeWeaponId, WEAPONS.KNIFE.id);
  }],

  ['accelerates with WASD input and applies ground friction when input stops', () => {
    const start = createPlayerControllerState({ position: { x: 30, y: 0, z: 30 }, activeWeaponId: WEAPONS.KNIFE.id });
    const moving = runFrames(start, { buttons: [INPUT_BUTTONS.FORWARD], deltaSeconds: 1 / 60 }, 20);
    const coasting = runFrames(moving, { buttons: [], deltaSeconds: 1 / 60 }, 20);

    assert.equal(moving.position.z > start.position.z, true);
    assert.equal(Math.hypot(moving.velocity.x, moving.velocity.z) <= moving.movement.maxSpeed + 0.000001, true);
    assert.equal(Math.hypot(coasting.velocity.x, coasting.velocity.z) < Math.hypot(moving.velocity.x, moving.velocity.z), true);
  }],

  ['applies mouse-look deltas with pitch clamp', () => {
    const state = simulatePlayerMovementStep(createPlayerControllerState(), {
      look: { yawDelta: 100, pitchDelta: 5000 },
      deltaSeconds: 1 / 60,
    });

    assert.equal(state.view.yaw, 0.2);
    assert.equal(state.view.pitch, PLAYER_MOVEMENT_DEFAULTS.maxPitch);
  }],

  ['uses weapon speed modifiers so AWP is slower than knife', () => {
    const knife = runFrames(
      createPlayerControllerState({ position: { x: 30, y: 0, z: 30 }, activeWeaponId: WEAPONS.KNIFE.id }),
      { buttons: [INPUT_BUTTONS.FORWARD], activeWeaponId: WEAPONS.KNIFE.id, deltaSeconds: 1 / 60 },
      60,
    );
    const awp = runFrames(
      createPlayerControllerState({ position: { x: 30, y: 0, z: 30 }, activeWeaponId: WEAPONS.AWP.id }),
      { buttons: [INPUT_BUTTONS.FORWARD], activeWeaponId: WEAPONS.AWP.id, deltaSeconds: 1 / 60 },
      60,
    );

    assert.equal(knife.movement.maxSpeed, 7);
    assert.equal(awp.movement.maxSpeed, 5.46);
    assert.equal(knife.position.z > awp.position.z, true);

    writeEvidence('task-11-weapon-speed.txt', [
      'T11 weapon speed evidence',
      `knifeMaxSpeed=${knife.movement.maxSpeed}`,
      `awpMaxSpeed=${awp.movement.maxSpeed}`,
      `knifeForwardZ=${knife.position.z}`,
      `awpForwardZ=${awp.position.z}`,
      `heavierWeaponSlower=${knife.position.z > awp.position.z}`,
    ]);
  }],

  ['represents jump and crouch states for renderer and gameplay consumers', () => {
    const jumping = simulatePlayerMovementStep(createPlayerControllerState({ position: { x: 30, y: 0, z: 30 } }), {
      buttons: [INPUT_BUTTONS.JUMP],
      deltaSeconds: 1 / 60,
    });
    const crouching = simulatePlayerMovementStep(createPlayerControllerState({ position: { x: 30, y: 0, z: 30 } }), {
      buttons: [INPUT_BUTTONS.CROUCH, INPUT_BUTTONS.FORWARD],
      deltaSeconds: 1 / 60,
    });

    assert.equal(jumping.movement.jumping, true);
    assert.equal(jumping.movement.grounded, false);
    assert.equal(jumping.position.y > 0, true);
    assert.equal(crouching.movement.crouching, true);
    assert.equal(crouching.movement.height, PLAYER_MOVEMENT_DEFAULTS.crouchingHeight);
    assert.equal(crouching.movement.maxSpeed, 3.15);

    writeEvidence('task-11-jump-crouch.txt', [
      'T11 jump/crouch evidence',
      `jumping=${jumping.movement.jumping}`,
      `jumpGrounded=${jumping.movement.grounded}`,
      `jumpY=${jumping.position.y}`,
      `crouching=${crouching.movement.crouching}`,
      `crouchHeight=${crouching.movement.height}`,
      `crouchMaxSpeed=${crouching.movement.maxSpeed}`,
    ]);
  }],

  ['approximates air-control without resetting vertical jump velocity', () => {
    const airborne = simulatePlayerMovementStep(createPlayerControllerState({ position: { x: 30, y: 0, z: 30 } }), {
      buttons: [INPUT_BUTTONS.JUMP],
      deltaSeconds: 1 / 60,
    });
    const steered = runFrames(airborne, { buttons: [INPUT_BUTTONS.RIGHT], deltaSeconds: 1 / 60 }, 10);

    assert.equal(steered.position.x > airborne.position.x, true);
    assert.equal(steered.position.y > airborne.position.y, true);
    assert.equal(steered.movement.jumping, true);
  }],

  ['blocks player movement through T9 box collision volumes', () => {
    const start = createPlayerControllerState({ position: { x: 58, y: 0, z: 41.9 }, activeWeaponId: WEAPONS.KNIFE.id });
    const blocked = runFrames(start, { buttons: [INPUT_BUTTONS.FORWARD], activeWeaponId: WEAPONS.KNIFE.id, deltaSeconds: 1 / 60, collisionVolumes: MAP_COLLISION_VOLUMES }, 90);

    assert.equal(blocked.movement.blocked, true);
    assert.equal(blocked.position.z < 42.8, true);
    assert.equal(blocked.position.z < MAP_COLLISION_VOLUMES[4].center.z, true);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS player movement - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL player movement - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
