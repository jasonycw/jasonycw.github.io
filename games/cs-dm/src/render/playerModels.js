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
    silhouette: 'helmeted tactical vest blocks with broad shoulders, blue visor, radio mast, and backpack mass',
    hitbox: PLAYER_MODEL_HITBOX,
    palette: {
      visor: '#88d8ff',
      helmet: '#1f3944',
      armor: '#274f63',
      fabric: '#43515a',
      accent: '#d6b36a',
      boots: '#151b20',
      gear: '#202a2f',
      skin: '#b58c6f',
    },
    parts: [
      box('ct-left-boot', 'boots', { x: 0.3, y: 0.16, z: 0.34 }, { x: -0.24, y: 0.08, z: 0.02 }, 'boots'),
      box('ct-right-boot', 'boots', { x: 0.3, y: 0.16, z: 0.34 }, { x: 0.24, y: 0.08, z: 0.02 }, 'boots'),
      box('ct-left-leg', 'legs', { x: 0.28, y: 0.58, z: 0.3 }, { x: -0.22, y: 0.45, z: 0 }, 'fabric'),
      box('ct-right-leg', 'legs', { x: 0.28, y: 0.58, z: 0.3 }, { x: 0.22, y: 0.45, z: 0 }, 'fabric'),
      box('ct-vest', 'torso', { x: 0.82, y: 0.7, z: 0.42 }, { x: 0, y: 1.05, z: 0 }, 'armor'),
      box('ct-chest-plate', 'armor-detail', { x: 0.56, y: 0.42, z: 0.08 }, { x: 0, y: 1.1, z: 0.25 }, 'gear'),
      box('ct-belt', 'armor-detail', { x: 0.86, y: 0.1, z: 0.46 }, { x: 0, y: 0.72, z: 0 }, 'gear'),
      box('ct-shoulders', 'shoulders', { x: 1.08, y: 0.18, z: 0.46 }, { x: 0, y: 1.35, z: 0 }, 'armor'),
      box('ct-left-arm', 'arms', { x: 0.2, y: 0.58, z: 0.22 }, { x: -0.58, y: 1.02, z: 0.1 }, 'fabric', { rotation: { x: 0.18, y: 0, z: -0.18 } }),
      box('ct-right-arm', 'arms', { x: 0.2, y: 0.58, z: 0.22 }, { x: 0.58, y: 1.02, z: 0.12 }, 'fabric', { rotation: { x: 0.22, y: 0, z: 0.18 } }),
      box('ct-left-glove', 'hands', { x: 0.18, y: 0.16, z: 0.18 }, { x: -0.55, y: 0.74, z: 0.24 }, 'boots'),
      box('ct-right-glove', 'hands', { x: 0.18, y: 0.16, z: 0.18 }, { x: 0.55, y: 0.74, z: 0.24 }, 'boots'),
      cylinder('ct-neck', 'neck', 0.16, 0.18, 0.18, { x: 0, y: 1.52, z: 0 }, 'fabric', { segments: 8 }),
      cylinder('ct-head', 'head', 0.24, 0.26, 0.26, { x: 0, y: 1.68, z: 0 }, 'skin', { segments: 10 }),
      cylinder('ct-helmet', 'headgear', 0.3, 0.34, 0.28, { x: 0, y: 1.78, z: 0 }, 'helmet', { segments: 12 }),
      box('ct-helmet-brow', 'headgear', { x: 0.56, y: 0.08, z: 0.16 }, { x: 0, y: 1.84, z: 0.2 }, 'helmet'),
      box('ct-visor', 'face', { x: 0.4, y: 0.1, z: 0.04 }, { x: 0, y: 1.75, z: 0.31 }, 'visor'),
      box('ct-chin-guard', 'face', { x: 0.32, y: 0.08, z: 0.08 }, { x: 0, y: 1.58, z: 0.27 }, 'gear'),
      box('ct-radio-mast', 'silhouette', { x: 0.04, y: 0.38, z: 0.04 }, { x: -0.4, y: 1.7, z: -0.12 }, 'accent'),
      box('ct-radio-pack', 'silhouette', { x: 0.24, y: 0.34, z: 0.16 }, { x: -0.32, y: 1.08, z: -0.36 }, 'gear'),
      box('ct-backpack', 'silhouette', { x: 0.5, y: 0.58, z: 0.2 }, { x: 0, y: 1.02, z: -0.36 }, 'gear'),
      box('ct-left-knee-pad', 'armor-detail', { x: 0.28, y: 0.12, z: 0.34 }, { x: -0.22, y: 0.66, z: 0.04 }, 'gear'),
      box('ct-right-knee-pad', 'armor-detail', { x: 0.28, y: 0.12, z: 0.34 }, { x: 0.22, y: 0.66, z: 0.04 }, 'gear'),
      box('ct-utility-pouch', 'armor-detail', { x: 0.18, y: 0.22, z: 0.16 }, { x: 0.46, y: 0.82, z: 0.2 }, 'accent'),
    ],
  },
  [PLAYER_MODEL_IDS.T_RAIDER]: {
    id: PLAYER_MODEL_IDS.T_RAIDER,
    faction: FACTIONS.TERRORISTS,
    displayName: 'Sand Raider',
    silhouette: 'wrapped head, loose desert jacket, diagonal bandolier, scarf tail, and soft pack silhouette',
    hitbox: PLAYER_MODEL_HITBOX,
    palette: {
      scarf: '#d8b36f',
      jacket: '#765331',
      shirt: '#2d2922',
      sash: '#9b2f22',
      pants: '#4a4539',
      boots: '#1d1712',
      pack: '#5f3f25',
      skin: '#b37a55',
      ammo: '#d2a348',
    },
    parts: [
      box('t-left-boot', 'boots', { x: 0.3, y: 0.16, z: 0.36 }, { x: -0.22, y: 0.08, z: 0.02 }, 'boots'),
      box('t-right-boot', 'boots', { x: 0.3, y: 0.16, z: 0.36 }, { x: 0.22, y: 0.08, z: 0.02 }, 'boots'),
      box('t-left-pants', 'legs', { x: 0.28, y: 0.6, z: 0.34 }, { x: -0.2, y: 0.46, z: 0 }, 'pants'),
      box('t-right-pants', 'legs', { x: 0.28, y: 0.6, z: 0.34 }, { x: 0.2, y: 0.46, z: 0 }, 'pants'),
      box('t-shirt', 'torso', { x: 0.72, y: 0.68, z: 0.38 }, { x: 0, y: 1.04, z: 0 }, 'shirt'),
      box('t-jacket', 'coat', { x: 0.9, y: 0.58, z: 0.44 }, { x: 0, y: 1.03, z: -0.02 }, 'jacket'),
      box('t-open-jacket-left', 'coat', { x: 0.18, y: 0.56, z: 0.1 }, { x: -0.24, y: 1.08, z: 0.25 }, 'jacket', { rotation: { x: 0, y: 0, z: 0.08 } }),
      box('t-open-jacket-right', 'coat', { x: 0.18, y: 0.56, z: 0.1 }, { x: 0.24, y: 1.08, z: 0.25 }, 'jacket', { rotation: { x: 0, y: 0, z: -0.08 } }),
      box('t-bandolier', 'silhouette', { x: 0.12, y: 0.86, z: 0.08 }, { x: 0.18, y: 1.08, z: 0.25 }, 'sash', { rotation: { x: 0, y: 0, z: -0.55 } }),
      box('t-bandolier-rounds', 'silhouette', { x: 0.1, y: 0.52, z: 0.12 }, { x: 0, y: 1.12, z: 0.34 }, 'ammo', { rotation: { x: 0, y: 0, z: -0.55 } }),
      box('t-left-arm', 'arms', { x: 0.22, y: 0.58, z: 0.22 }, { x: -0.56, y: 1.0, z: 0.1 }, 'jacket', { rotation: { x: 0.16, y: 0, z: -0.2 } }),
      box('t-right-arm', 'arms', { x: 0.22, y: 0.58, z: 0.22 }, { x: 0.56, y: 1.0, z: 0.12 }, 'jacket', { rotation: { x: 0.16, y: 0, z: 0.2 } }),
      box('t-left-hand', 'hands', { x: 0.18, y: 0.16, z: 0.18 }, { x: -0.55, y: 0.72, z: 0.24 }, 'skin'),
      box('t-right-hand', 'hands', { x: 0.18, y: 0.16, z: 0.18 }, { x: 0.55, y: 0.72, z: 0.24 }, 'skin'),
      cylinder('t-neck', 'neck', 0.15, 0.17, 0.16, { x: 0, y: 1.51, z: 0 }, 'scarf', { segments: 8 }),
      cylinder('t-face', 'head', 0.22, 0.24, 0.22, { x: 0, y: 1.66, z: 0.02 }, 'skin', { segments: 10 }),
      cylinder('t-wrapped-head', 'headgear', 0.3, 0.31, 0.32, { x: 0, y: 1.76, z: 0 }, 'scarf', { segments: 10 }),
      box('t-face-wrap', 'face', { x: 0.42, y: 0.1, z: 0.08 }, { x: 0, y: 1.64, z: 0.28 }, 'scarf'),
      box('t-scarf-tail', 'silhouette', { x: 0.14, y: 0.52, z: 0.12 }, { x: 0.34, y: 1.47, z: -0.2 }, 'scarf', { rotation: { x: 0, y: 0, z: -0.22 } }),
      box('t-soft-pack', 'silhouette', { x: 0.44, y: 0.48, z: 0.2 }, { x: -0.08, y: 0.98, z: -0.36 }, 'pack'),
      box('t-pack-roll', 'silhouette', { x: 0.42, y: 0.16, z: 0.16 }, { x: -0.08, y: 1.34, z: -0.42 }, 'pack'),
      box('t-head-wrap-band', 'headgear', { x: 0.48, y: 0.08, z: 0.08 }, { x: 0, y: 1.82, z: 0.24 }, 'jacket'),
      box('t-waist-sash', 'silhouette', { x: 0.76, y: 0.12, z: 0.42 }, { x: 0, y: 0.74, z: 0 }, 'sash'),
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

  const materialsCache = new Map();
  for (const part of variant.parts) {
    const geometry = createGeometry(THREE, part);
    let material = materialsCache.get(part.colorToken);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: variant.palette[part.colorToken], roughness: 0.9 });
      materialsCache.set(part.colorToken, material);
    }
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
