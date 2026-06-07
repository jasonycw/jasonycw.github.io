import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { INPUT_BUTTONS } from '../core/index.js';
import { getConfiguredMouseLookDelta } from '../input/index.js';
import { MAP_COLLISION_VOLUMES } from '../map/index.js';
import { buildMapRenderGeometry, mapToScenePosition } from '../render/mapGeometry.js';
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

    assert.equal(moving.position.z < start.position.z, true);
    assert.equal(Math.hypot(moving.velocity.x, moving.velocity.z) <= moving.movement.maxSpeed + 0.000001, true);
    assert.equal(Math.hypot(coasting.velocity.x, coasting.velocity.z) < Math.hypot(moving.velocity.x, moving.velocity.z), true);
  }],

  ['maps yaw-zero WASD to symmetric world directions from open ground', () => {
    const start = createPlayerControllerState({ position: { x: 30, y: 0, z: 30 }, yaw: 0, activeWeaponId: WEAPONS.KNIFE.id });
    const directions = [
      Object.freeze({ button: INPUT_BUTTONS.FORWARD, axis: 'z', sign: -1 }),
      Object.freeze({ button: INPUT_BUTTONS.BACK, axis: 'z', sign: 1 }),
      Object.freeze({ button: INPUT_BUTTONS.RIGHT, axis: 'x', sign: 1 }),
      Object.freeze({ button: INPUT_BUTTONS.LEFT, axis: 'x', sign: -1 }),
    ];

    directions.forEach(({ button, axis, sign }) => {
      const moved = runFrames(start, { buttons: [button], activeWeaponId: WEAPONS.KNIFE.id, deltaSeconds: 1 / 60, collisionVolumes: [] }, 8);
      const delta = moved.position[axis] - start.position[axis];
      const otherAxis = axis === 'x' ? 'z' : 'x';

      assert.equal(Math.sign(delta), sign, `${button} should move ${axis} with sign ${sign}`);
      assert.equal(Math.abs(moved.position[otherAxis] - start.position[otherAxis]) < 0.000001, true, `${button} should not drift on ${otherAxis}`);
    });
  }],

  ['applies mouse-look deltas with pitch clamp', () => {
    const state = simulatePlayerMovementStep(createPlayerControllerState(), {
      look: { yawDelta: 100, pitchDelta: 5000 },
      deltaSeconds: 1 / 60,
    });

    assert.equal(state.view.yaw, 0.2);
    assert.equal(state.view.pitch, PLAYER_MOVEMENT_DEFAULTS.maxPitch);
  }],

  ['applies configured mouse look deltas before movement sensitivity', () => {
    const defaultInverted = simulatePlayerMovementStep(createPlayerControllerState(), {
      look: getConfiguredMouseLookDelta({ yawDelta: 40, pitchDelta: 40 }),
      deltaSeconds: 1 / 60,
    });
    const standardHalfSensitivity = simulatePlayerMovementStep(createPlayerControllerState(), {
      look: getConfiguredMouseLookDelta({ yawDelta: 40, pitchDelta: 40 }, { sensitivity: 0.5, invertY: false }),
      deltaSeconds: 1 / 60,
    });

    assert.equal(defaultInverted.view.yaw, -0.08);
    assert.equal(defaultInverted.view.pitch, -0.08);
    assert.equal(standardHalfSensitivity.view.yaw, -0.04);
    assert.equal(standardHalfSensitivity.view.pitch, 0.04);
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

    assert.equal(knife.movement.maxSpeed, 7.5);
    assert.equal(awp.movement.maxSpeed, 6);
    assert.equal(knife.position.z < awp.position.z, true);

    writeEvidence('task-11-weapon-speed.txt', [
      'T11 weapon speed evidence',
      `knifeMaxSpeed=${knife.movement.maxSpeed}`,
      `awpMaxSpeed=${awp.movement.maxSpeed}`,
      `knifeForwardZ=${knife.position.z}`,
      `awpForwardZ=${awp.position.z}`,
      `heavierWeaponSlower=${knife.position.z < awp.position.z}`,
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
    assert.equal(crouching.movement.maxSpeed, 3.375);

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

  ['runs matching gravity-driven tap and held Space arcs after initial jump impulse', () => {
    const start = createPlayerControllerState({ position: { x: 30, y: 0, z: 30 } });
    const jumped = simulatePlayerMovementStep(start, {
      buttons: [],
      jumpPressed: true,
      deltaSeconds: 1 / 60,
      collisionVolumes: [],
    });
    const released = simulatePlayerMovementStep(jumped, {
      buttons: [],
      deltaSeconds: 1 / 60,
      collisionVolumes: [],
    });
    let falling = released.velocity.y < jumped.velocity.y;
    let peakY = Math.max(jumped.position.y, released.position.y);
    let landed = released;

    for (let frame = 0; frame < 120 && !landed.movement.grounded; frame += 1) {
      const next = simulatePlayerMovementStep(landed, { buttons: [], deltaSeconds: 1 / 60, collisionVolumes: [] });
      falling = falling || next.velocity.y < 0;
      peakY = Math.max(peakY, next.position.y);
      landed = next;
    }

    assert.equal(jumped.position.y > start.position.y, true);
    assert.equal(released.position.y > jumped.position.y, true);
    assert.equal(peakY > released.position.y, true);
    assert.equal(falling, true);
    const tapArc = [jumped];
    let tapState = jumped;
    let heldState = simulatePlayerMovementStep(start, {
      buttons: [INPUT_BUTTONS.JUMP],
      deltaSeconds: 1 / 60,
      collisionVolumes: [],
    });
    const heldArc = [heldState];
    for (let frame = 0; frame < 36; frame += 1) {
      tapState = simulatePlayerMovementStep(tapState, { buttons: [], deltaSeconds: 1 / 60, collisionVolumes: [] });
      heldState = simulatePlayerMovementStep(heldState, { buttons: [INPUT_BUTTONS.JUMP], deltaSeconds: 1 / 60, collisionVolumes: [] });
      tapArc.push(tapState);
      heldArc.push(heldState);
    }

    assert.equal(landed.position.y, 0);
    assert.equal(landed.movement.grounded, true);
    assert.equal(landed.movement.jumping, false);
    assert.deepEqual(heldArc.map((frame) => frame.position.y), tapArc.map((frame) => frame.position.y));
    assert.deepEqual(heldArc.map((frame) => frame.velocity.y), tapArc.map((frame) => frame.velocity.y));
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
    const midDoorVolume = MAP_COLLISION_VOLUMES.find((volume) => volume.center.x === 56 && volume.center.z === 50);
    const start = createPlayerControllerState({ position: { x: 56, y: 0, z: 58.2 }, activeWeaponId: WEAPONS.KNIFE.id });
    const blocked = runFrames(start, { buttons: [INPUT_BUTTONS.FORWARD], activeWeaponId: WEAPONS.KNIFE.id, deltaSeconds: 1 / 60, collisionVolumes: MAP_COLLISION_VOLUMES }, 90);

    assert.equal(Boolean(midDoorVolume), true, 'named Mid Doors blocker should exist');
    assert.equal(blocked.movement.blocked, true);
    assert.equal(blocked.position.z > midDoorVolume.center.z, true);
  }],

  ['blocks movement against the same mid-door volume rendered as visible geometry', () => {
    const geometry = buildMapRenderGeometry();
    const midDoorBlocker = geometry.blockers.find((blocker) => blocker.id === 'mid-doors-collision');
    const visibleCenter = mapToScenePosition(midDoorBlocker.collisionVolume.center);
    const start = createPlayerControllerState({ position: { x: 56, y: 0, z: 58.2 }, activeWeaponId: WEAPONS.KNIFE.id });
    const blocked = runFrames(start, { buttons: [INPUT_BUTTONS.FORWARD], activeWeaponId: WEAPONS.KNIFE.id, deltaSeconds: 1 / 60, collisionVolumes: [midDoorBlocker.collisionVolume] }, 90);

    assert.equal(Boolean(midDoorBlocker), true, 'mid-door collision should be rendered as visible blocker geometry');
    assert.equal(midDoorBlocker.mapCenter, midDoorBlocker.collisionVolume.center);
    assert.equal(midDoorBlocker.position.x, visibleCenter.x);
    assert.equal(midDoorBlocker.position.z, visibleCenter.z);
    assert.equal(blocked.movement.blocked, true);
    assert.equal(blocked.position.z > midDoorBlocker.collisionVolume.center.z, true);
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
