import { INPUT_BUTTONS } from '../core/index.js';
import { MAP_COLLISION_VOLUMES } from '../map/index.js';
import { getWeaponSpeedModifier, WEAPONS } from '../weapons/index.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Number(value.toFixed(6));
const freezeVector = (vector) => Object.freeze({ x: round(vector.x), y: round(vector.y), z: round(vector.z) });

export const PLAYER_MOVEMENT_DEFAULTS = Object.freeze({
  baseMaxSpeed: 7.5,
  acceleration: 56,
  airAcceleration: 16,
  groundFriction: 14,
  gravity: 20,
  jumpSpeed: 6.5,
  mouseSensitivity: 0.002,
  minPitch: -1.35,
  maxPitch: 1.35,
  standingHeight: 1.8,
  crouchingHeight: 1.05,
  collisionRadius: 0.6,
  crouchSpeedModifier: 0.45,
});

export const PLAYER_MOVEMENT_CONTRACT = Object.freeze({
  position: '{ x, y, z } map-space position with y as vertical offset',
  velocity: '{ x, y, z } deterministic movement velocity',
  view: '{ yaw, pitch } mouse-look angles in radians',
  activeWeaponId: 'known weapon id used for speed scaling',
  movement: '{ grounded, jumping, crouching, height, maxSpeed, blocked } renderer/gameplay consumable movement state',
});

export function createPlayerControllerState({
  position = { x: 10, y: 0, z: 88 },
  velocity = { x: 0, y: 0, z: 0 },
  yaw = 0,
  pitch = 0,
  activeWeaponId = WEAPONS.KNIFE.id,
  grounded = true,
  crouching = false,
  jumping = false,
} = {}) {
  const maxSpeed = PLAYER_MOVEMENT_DEFAULTS.baseMaxSpeed * getWeaponSpeedModifier(activeWeaponId) * (crouching ? PLAYER_MOVEMENT_DEFAULTS.crouchSpeedModifier : 1);

  return Object.freeze({
    position: freezeVector(position),
    velocity: freezeVector(velocity),
    view: Object.freeze({ yaw: round(yaw), pitch: round(clamp(pitch, PLAYER_MOVEMENT_DEFAULTS.minPitch, PLAYER_MOVEMENT_DEFAULTS.maxPitch)) }),
    activeWeaponId,
    movement: Object.freeze({
      grounded,
      jumping,
      crouching,
      height: crouching ? PLAYER_MOVEMENT_DEFAULTS.crouchingHeight : PLAYER_MOVEMENT_DEFAULTS.standingHeight,
      maxSpeed: round(maxSpeed),
      blocked: false,
    }),
  });
}

const normalizeHorizontal = (vector) => {
  const length = Math.hypot(vector.x, vector.z);
  return length === 0 ? { x: 0, z: 0 } : { x: vector.x / length, z: vector.z / length };
};

const getWishDirection = (buttons, yaw) => {
  const pressed = new Set(buttons);
  const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const wish = { x: 0, z: 0 };

  if (pressed.has(INPUT_BUTTONS.FORWARD)) {
    wish.x += forward.x;
    wish.z += forward.z;
  }
  if (pressed.has(INPUT_BUTTONS.BACK)) {
    wish.x -= forward.x;
    wish.z -= forward.z;
  }
  if (pressed.has(INPUT_BUTTONS.RIGHT)) {
    wish.x += right.x;
    wish.z += right.z;
  }
  if (pressed.has(INPUT_BUTTONS.LEFT)) {
    wish.x -= right.x;
    wish.z -= right.z;
  }

  return normalizeHorizontal(wish);
};

const accelerate = (velocity, wishDirection, acceleration, maxSpeed, deltaSeconds) => {
  if (wishDirection.x === 0 && wishDirection.z === 0) {
    return velocity;
  }

  const currentSpeed = velocity.x * wishDirection.x + velocity.z * wishDirection.z;
  const addSpeed = maxSpeed - currentSpeed;
  if (addSpeed <= 0) {
    return velocity;
  }

  const accelerationSpeed = Math.min(acceleration * deltaSeconds * maxSpeed, addSpeed);
  return {
    x: velocity.x + wishDirection.x * accelerationSpeed,
    y: velocity.y,
    z: velocity.z + wishDirection.z * accelerationSpeed,
  };
};

const applyFriction = (velocity, deltaSeconds) => {
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed === 0) {
    return velocity;
  }

  const nextSpeed = Math.max(0, speed - PLAYER_MOVEMENT_DEFAULTS.groundFriction * deltaSeconds * speed);
  const scale = nextSpeed / speed;
  return { x: velocity.x * scale, y: velocity.y, z: velocity.z * scale };
};

const clampHorizontalSpeed = (velocity, maxSpeed) => {
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed <= maxSpeed || speed === 0) {
    return velocity;
  }

  const scale = maxSpeed / speed;
  return { x: velocity.x * scale, y: velocity.y, z: velocity.z * scale };
};

const circleIntersectsBoxProjection = (position, radius, box) => {
  const halfWidth = box.size.width / 2;
  const halfDepth = box.size.depth / 2;
  const closestX = clamp(position.x, box.center.x - halfWidth, box.center.x + halfWidth);
  const closestZ = clamp(position.z, box.center.z - halfDepth, box.center.z + halfDepth);
  return Math.hypot(position.x - closestX, position.z - closestZ) < radius;
};

const collidesAt = (position, radius, collisionVolumes) => collisionVolumes.some((volume) => volume.kind === 'box' && circleIntersectsBoxProjection(position, radius, volume));

const resolveHorizontalCollision = (fromPosition, toPosition, radius, collisionVolumes) => {
  let position = { ...toPosition };
  let blockedX = false;
  let blockedZ = false;

  if (collidesAt(position, radius, collisionVolumes)) {
    const xOnly = { ...toPosition, z: fromPosition.z };
    const zOnly = { ...toPosition, x: fromPosition.x };

    if (!collidesAt(xOnly, radius, collisionVolumes)) {
      position = xOnly;
      blockedZ = true;
    } else if (!collidesAt(zOnly, radius, collisionVolumes)) {
      position = zOnly;
      blockedX = true;
    } else {
      position = { ...fromPosition };
      blockedX = true;
      blockedZ = true;
    }
  }

  return Object.freeze({ position, blockedX, blockedZ, blocked: blockedX || blockedZ });
};

export function simulatePlayerMovementStep(state, {
  buttons = [],
  jumpPressed,
  look = { yawDelta: 0, pitchDelta: 0 },
  activeWeaponId = state.activeWeaponId,
  deltaSeconds = 1 / 60,
  collisionVolumes = MAP_COLLISION_VOLUMES,
} = {}) {
  const pressed = new Set(buttons);
  const jumpPressedThisFrame = jumpPressed ?? pressed.has(INPUT_BUTTONS.JUMP);
  const crouching = pressed.has(INPUT_BUTTONS.CROUCH);
  const maxSpeed = PLAYER_MOVEMENT_DEFAULTS.baseMaxSpeed * getWeaponSpeedModifier(activeWeaponId) * (crouching ? PLAYER_MOVEMENT_DEFAULTS.crouchSpeedModifier : 1);
  const yaw = state.view.yaw + (look.yawDelta || 0) * PLAYER_MOVEMENT_DEFAULTS.mouseSensitivity;
  const pitch = clamp(state.view.pitch + (look.pitchDelta || 0) * PLAYER_MOVEMENT_DEFAULTS.mouseSensitivity, PLAYER_MOVEMENT_DEFAULTS.minPitch, PLAYER_MOVEMENT_DEFAULTS.maxPitch);
  const wishDirection = getWishDirection(buttons, yaw);
  const groundedAtStart = state.movement.grounded;
  let velocity = { ...state.velocity };

  if (groundedAtStart && wishDirection.x === 0 && wishDirection.z === 0) {
    velocity = applyFriction(velocity, deltaSeconds);
  }

  velocity = accelerate(
    velocity,
    wishDirection,
    groundedAtStart ? PLAYER_MOVEMENT_DEFAULTS.acceleration : PLAYER_MOVEMENT_DEFAULTS.airAcceleration,
    maxSpeed,
    deltaSeconds,
  );
  velocity = clampHorizontalSpeed(velocity, maxSpeed);

  let jumping = state.movement.jumping && !groundedAtStart;
  if (groundedAtStart && jumpPressedThisFrame && !crouching) {
    velocity.y = PLAYER_MOVEMENT_DEFAULTS.jumpSpeed;
    jumping = true;
  }

  velocity.y -= PLAYER_MOVEMENT_DEFAULTS.gravity * deltaSeconds;

  const nextVerticalPosition = state.position.y + velocity.y * deltaSeconds;
  let grounded = false;
  let y = nextVerticalPosition;
  if (nextVerticalPosition <= 0) {
    y = 0;
    velocity.y = 0;
    grounded = true;
    jumping = false;
  }

  const desiredPosition = {
    x: state.position.x + velocity.x * deltaSeconds,
    y,
    z: state.position.z + velocity.z * deltaSeconds,
  };
  const collision = resolveHorizontalCollision(state.position, desiredPosition, PLAYER_MOVEMENT_DEFAULTS.collisionRadius, collisionVolumes);

  if (collision.blockedX) {
    velocity.x = 0;
  }
  if (collision.blockedZ) {
    velocity.z = 0;
  }

  return Object.freeze({
    position: freezeVector({ ...collision.position, y }),
    velocity: freezeVector(velocity),
    view: Object.freeze({ yaw: round(yaw), pitch: round(pitch) }),
    activeWeaponId,
    movement: Object.freeze({
      grounded,
      jumping,
      crouching,
      height: crouching ? PLAYER_MOVEMENT_DEFAULTS.crouchingHeight : PLAYER_MOVEMENT_DEFAULTS.standingHeight,
      maxSpeed: round(maxSpeed),
      blocked: collision.blocked,
    }),
  });
}

export function simulatePlayerMovement(state, frames) {
  return frames.reduce((nextState, frame) => simulatePlayerMovementStep(nextState, frame), state);
}
