import { FACTIONS } from '../config/index.js';
import { PLAYER_MOVEMENT_DEFAULTS } from '../player/index.js';

const freezeDeep = (value) => {
  if (Array.isArray(value)) {
    value.forEach(freezeDeep);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
  }
  return Object.freeze(value);
};

const box = (id, role, size, position, colorToken, extras = {}) => Object.freeze({
  id,
  role,
  shape: 'box',
  size: Object.freeze(size),
  position: Object.freeze(position),
  colorToken,
  ...extras,
});

const cylinder = (id, role, radiusTop, radiusBottom, height, position, colorToken, extras = {}) => Object.freeze({
  id,
  role,
  shape: 'cylinder',
  radiusTop,
  radiusBottom,
  height,
  position: Object.freeze(position),
  colorToken,
  ...extras,
});

export const PLAYER_MODEL_IDS = Object.freeze({
  CT_RANGER: 'ct-ranger',
  T_RAIDER: 't-raider',
});

export const PLAYER_MODEL_STATES = freezeDeep({
  IDLE: { id: 'idle', label: 'Idle', loop: true, speedScale: 1, pose: { stance: 'standing', weaponReady: true } },
  RUN: { id: 'run', label: 'Run', loop: true, speedScale: 1.35, pose: { stance: 'standing', stride: 'wide' } },
  CROUCH: { id: 'crouch', label: 'Crouch', loop: true, speedScale: 0.7, pose: { stance: 'crouched', height: PLAYER_MOVEMENT_DEFAULTS.crouchingHeight } },
  JUMP: { id: 'jump', label: 'Jump', loop: false, speedScale: 1, pose: { stance: 'airborne', verticalBias: 1 } },
  FALL: { id: 'fall', label: 'Fall', loop: true, speedScale: 1, pose: { stance: 'airborne', verticalBias: -1 } },
  AIM: { id: 'aim', label: 'Aim', loop: true, speedScale: 0.85, pose: { stance: 'braced', weaponReady: true } },
  FIRE: { id: 'fire', label: 'Fire', loop: false, speedScale: 1.8, pose: { stance: 'braced', muzzleFlash: true } },
  DEATH: { id: 'death', label: 'Death', loop: false, speedScale: 0.6, pose: { stance: 'falling', lifeState: 'dead' } },
  RESPAWN: { id: 'respawn', label: 'Respawn', loop: false, speedScale: 1.1, pose: { stance: 'standing', lifeState: 'respawning' } },
});

export const PLAYER_MODEL_HITBOX = freezeDeep({
  radius: PLAYER_MOVEMENT_DEFAULTS.collisionRadius,
  standingHeight: PLAYER_MOVEMENT_DEFAULTS.standingHeight,
  crouchingHeight: PLAYER_MOVEMENT_DEFAULTS.crouchingHeight,
});

export const PLAYER_MODEL_VARIANTS = freezeDeep({
  [PLAYER_MODEL_IDS.CT_RANGER]: {
    id: PLAYER_MODEL_IDS.CT_RANGER,
    faction: FACTIONS.COUNTER_TERRORISTS,
    displayName: 'Harbor Ranger',
    silhouette: 'helmeted armor blocks with shoulder radio mast',
    hitbox: PLAYER_MODEL_HITBOX,
    palette: {
      visor: '#88d8ff',
      helmet: '#1f3944',
      armor: '#274f63',
      fabric: '#43515a',
      accent: '#d6b36a',
      boots: '#151b20',
    },
    parts: [
      box('ct-boots', 'boots', { x: 0.78, y: 0.16, z: 0.34 }, { x: 0, y: 0.08, z: 0 }, 'boots'),
      box('ct-legs', 'legs', { x: 0.62, y: 0.58, z: 0.32 }, { x: 0, y: 0.45, z: 0 }, 'fabric'),
      box('ct-vest', 'torso', { x: 0.82, y: 0.7, z: 0.42 }, { x: 0, y: 1.05, z: 0 }, 'armor'),
      box('ct-shoulders', 'shoulders', { x: 1.06, y: 0.18, z: 0.46 }, { x: 0, y: 1.35, z: 0 }, 'armor'),
      cylinder('ct-neck', 'neck', 0.16, 0.18, 0.18, { x: 0, y: 1.52, z: 0 }, 'fabric', { segments: 8 }),
      cylinder('ct-helmet', 'head', 0.28, 0.32, 0.34, { x: 0, y: 1.72, z: 0 }, 'helmet', { segments: 8 }),
      box('ct-visor', 'face', { x: 0.4, y: 0.1, z: 0.04 }, { x: 0, y: 1.75, z: 0.31 }, 'visor'),
      box('ct-radio-mast', 'silhouette', { x: 0.04, y: 0.38, z: 0.04 }, { x: -0.4, y: 1.7, z: -0.12 }, 'accent'),
    ],
  },
  [PLAYER_MODEL_IDS.T_RAIDER]: {
    id: PLAYER_MODEL_IDS.T_RAIDER,
    faction: FACTIONS.TERRORISTS,
    displayName: 'Sand Raider',
    silhouette: 'wrapped head, loose jacket, diagonal bandolier',
    hitbox: PLAYER_MODEL_HITBOX,
    palette: {
      scarf: '#d8b36f',
      jacket: '#765331',
      shirt: '#2d2922',
      sash: '#9b2f22',
      pants: '#4a4539',
      boots: '#1d1712',
    },
    parts: [
      box('t-boots', 'boots', { x: 0.7, y: 0.16, z: 0.36 }, { x: 0, y: 0.08, z: 0 }, 'boots'),
      box('t-pants', 'legs', { x: 0.58, y: 0.6, z: 0.34 }, { x: 0, y: 0.46, z: 0 }, 'pants'),
      box('t-shirt', 'torso', { x: 0.72, y: 0.68, z: 0.38 }, { x: 0, y: 1.04, z: 0 }, 'shirt'),
      box('t-jacket', 'coat', { x: 0.9, y: 0.58, z: 0.44 }, { x: 0, y: 1.03, z: -0.02 }, 'jacket'),
      box('t-bandolier', 'silhouette', { x: 0.12, y: 0.86, z: 0.08 }, { x: 0.18, y: 1.08, z: 0.25 }, 'sash', { rotation: { x: 0, y: 0, z: -0.55 } }),
      cylinder('t-neck', 'neck', 0.15, 0.17, 0.16, { x: 0, y: 1.51, z: 0 }, 'scarf', { segments: 8 }),
      cylinder('t-wrapped-head', 'head', 0.27, 0.29, 0.32, { x: 0, y: 1.7, z: 0 }, 'scarf', { segments: 8 }),
      box('t-scarf-tail', 'silhouette', { x: 0.12, y: 0.48, z: 0.12 }, { x: 0.3, y: 1.47, z: -0.18 }, 'scarf'),
    ],
  },
});

export const PLAYER_MODEL_STATE_IDS = Object.freeze(Object.values(PLAYER_MODEL_STATES).map((state) => state.id));

export function getPlayerModelVariant(modelId) {
  return PLAYER_MODEL_VARIANTS[modelId] ?? PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.T_RAIDER];
}

export function getPlayerModelForFaction(faction) {
  return Object.values(PLAYER_MODEL_VARIANTS).find((variant) => variant.faction === faction) ?? PLAYER_MODEL_VARIANTS[PLAYER_MODEL_IDS.T_RAIDER];
}

export function createPlayerModelPrimitiveDescriptors(modelId) {
  const variant = getPlayerModelVariant(modelId);
  return Object.freeze(variant.parts.map((part) => Object.freeze({
    ...part,
    color: variant.palette[part.colorToken],
  })));
}

const applyTransform = (mesh, part) => {
  mesh.name = part.id;
  if (mesh.position?.set) {
    mesh.position.set(part.position.x, part.position.y, part.position.z);
  }
  if (part.rotation && mesh.rotation?.set) {
    mesh.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z);
  }
  mesh.userData = Object.freeze({ role: part.role, colorToken: part.colorToken });
};

const createGeometry = (THREE, part) => {
  if (part.shape === 'cylinder') {
    return new THREE.CylinderGeometry(part.radiusTop, part.radiusBottom, part.height, part.segments ?? 8);
  }
  return new THREE.BoxGeometry(part.size.x, part.size.y, part.size.z);
};

export function buildPlayerModel(THREE, modelId) {
  const variant = getPlayerModelVariant(modelId);
  const group = new THREE.Group();
  group.name = variant.id;
  group.userData = Object.freeze({
    faction: variant.faction,
    displayName: variant.displayName,
    hitbox: PLAYER_MODEL_HITBOX,
    states: PLAYER_MODEL_STATE_IDS,
  });

  for (const part of variant.parts) {
    const geometry = createGeometry(THREE, part);
    const material = new THREE.MeshStandardMaterial({ color: variant.palette[part.colorToken], roughness: 0.9 });
    const mesh = new THREE.Mesh(geometry, material);
    applyTransform(mesh, part);
    group.add(mesh);
  }

  return group;
}

export function summarizePlayerModelDebug() {
  return freezeDeep(Object.values(PLAYER_MODEL_VARIANTS).map((variant) => ({
    id: variant.id,
    faction: variant.faction,
    displayName: variant.displayName,
    silhouette: variant.silhouette,
    partCount: variant.parts.length,
    hitbox: variant.hitbox,
    states: PLAYER_MODEL_STATE_IDS,
  })));
}
