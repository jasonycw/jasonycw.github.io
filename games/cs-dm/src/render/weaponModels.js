import { WEAPON_CATEGORIES, getWeaponById } from '../weapons/index.js';

export const WEAPON_MODEL_ROLES = Object.freeze({
  PISTOL: 'pistol',
  RIFLE: 'rifle',
  SNIPER: 'sniper',
  SMG: 'smg',
  SHOTGUN: 'shotgun',
  MACHINE_GUN: 'machine-gun',
  MELEE: 'melee',
});

export const WEAPON_MODEL_LAYERS = Object.freeze({
  WORLD: 'world',
  VIEWMODEL: 'viewmodel',
});

const freezeDeep = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
};

const vector = (x = 0, y = 0, z = 0) => Object.freeze({ x, y, z });

export const VIEWMODEL_CAMERA_ALIGNMENT = freezeDeep({
  coordinateContract: Object.freeze({ screenRight: '+X', up: '+Y', forward: '-Z' }),
  rotation: vector(0, 0, 0),
  scale: 0.76,
  camera: Object.freeze({ fovDegrees: 68, aspect: 16 / 9, near: 0.1 }),
  orthographic: Object.freeze({ left: -1.6, right: 1.6, top: 0.9, bottom: -0.9 }),
});

const part = ({ id, shape, material, size, position, rotation = vector(), detail = '' }) => freezeDeep({
  id,
  shape,
  material,
  size: vector(size.x, size.y, size.z),
  position: vector(position.x, position.y, position.z),
  rotation: vector(rotation.x, rotation.y, rotation.z),
  detail,
});

const buildParts = (partSpecs) => Object.freeze(partSpecs.map(part));

const createHooks = ({ muzzle, shellEject, leftHand, rightHand, magazine, reloadPath }) => freezeDeep({
  muzzle: vector(muzzle.x, muzzle.y, muzzle.z),
  shellEject: vector(shellEject.x, shellEject.y, shellEject.z),
  hands: Object.freeze({
    left: vector(leftHand.x, leftHand.y, leftHand.z),
    right: vector(rightHand.x, rightHand.y, rightHand.z),
  }),
  magazine: vector(magazine.x, magazine.y, magazine.z),
  reloadPath: Object.freeze(reloadPath.map((step) => freezeDeep({
    label: step.label,
    offset: vector(step.offset.x, step.offset.y, step.offset.z),
    durationMs: step.durationMs,
  }))),
});

const createPose = ({ origin, switchRaiseMs, fireKick, recoil, bob, muzzleFlashScale }) => freezeDeep({
  origin: vector(origin.x, origin.y, origin.z),
  switch: Object.freeze({ raiseMs: switchRaiseMs, lowerMs: Math.round(switchRaiseMs * 0.7) }),
  firing: Object.freeze({
    muzzleFlash: Object.freeze({ kind: 'placeholder-cone', scale: muzzleFlashScale, durationMs: 48 }),
    kickOffset: vector(fireKick.x, fireKick.y, fireKick.z),
  }),
  recoil: Object.freeze({ pitch: recoil.pitch, yaw: recoil.yaw, settleMs: recoil.settleMs }),
  bob: Object.freeze({ amplitude: bob.amplitude, frequency: bob.frequency, sprintMultiplier: bob.sprintMultiplier }),
});

const createModel = ({ weaponId, role, silhouette, worldParts, viewmodelParts, hooks, pose }) => {
  const weapon = getWeaponById(weaponId);

  if (!weapon) {
    throw new Error(`Cannot register weapon model for unknown weapon id: ${weaponId}`);
  }

  return freezeDeep({
    weaponId: weapon.id,
    weaponName: weapon.name,
    category: weapon.category,
    role,
    originalAssetNote: 'Original generated low-poly primitive metadata; no copied Counter-Strike meshes, textures, or sprites.',
    silhouette,
    layers: Object.freeze({
      [WEAPON_MODEL_LAYERS.WORLD]: Object.freeze({ kind: 'low-poly-world-silhouette', parts: buildParts(worldParts) }),
      [WEAPON_MODEL_LAYERS.VIEWMODEL]: Object.freeze({ kind: 'low-poly-viewmodel-silhouette', parts: buildParts(viewmodelParts) }),
    }),
    hooks,
    pose,
    hud: Object.freeze({ label: weapon.name, weaponId: weapon.id, role }),
  });
};

const sharedReloadPath = Object.freeze([
  Object.freeze({ label: 'release-magazine', offset: vector(0, -0.12, -0.04), durationMs: 180 }),
  Object.freeze({ label: 'insert-magazine', offset: vector(0, 0.1, 0.03), durationMs: 260 }),
  Object.freeze({ label: 'settle', offset: vector(0, 0, 0), durationMs: 140 }),
]);

const fallbackHooks = createHooks({
  muzzle: vector(0.28, -0.12, -1.02),
  shellEject: vector(0.44, -0.04, -0.44),
  leftHand: vector(0.12, -0.46, -0.54),
  rightHand: vector(0.46, -0.58, -0.08),
  magazine: vector(0.34, -0.62, -0.24),
  reloadPath: sharedReloadPath,
});

const fallbackPose = createPose({
  origin: vector(0.2, -0.1, -0.58),
  switchRaiseMs: 220,
  fireKick: vector(0, 0.02, 0.05),
  recoil: { pitch: 0.6, yaw: 0.2, settleMs: 120 },
  bob: { amplitude: 0.018, frequency: 7.5, sprintMultiplier: 1.4 },
  muzzleFlashScale: 0.7,
});

const modelDefinitions = Object.freeze([
  createModel({
    weaponId: 'knife',
    role: WEAPON_MODEL_ROLES.MELEE,
    silhouette: 'short tactical knife with blocky dark handle, bright clipped blade, and knuckle guard',
    worldParts: [
      { id: 'knife-handle', shape: 'box', material: 'ribbed-black', size: vector(0.36, 0.1, 0.14), position: vector(-0.16, -0.02, 0) },
      { id: 'knife-guard', shape: 'box', material: 'dark-bore', size: vector(0.08, 0.26, 0.18), position: vector(0.05, -0.02, 0) },
      { id: 'knife-blade', shape: 'box', material: 'warning-matte-gray', size: vector(0.58, 0.08, 0.08), position: vector(0.38, 0.02, 0), rotation: vector(0, 0, 0.06) },
      { id: 'knife-tip', shape: 'box', material: 'blued-steel', size: vector(0.18, 0.06, 0.06), position: vector(0.74, 0.04, 0), rotation: vector(0, 0, 0.18) },
    ],
    viewmodelParts: [
      { id: 'vm-knife-handle', shape: 'box', material: 'ribbed-black', size: vector(0.2, 0.18, 0.58), position: vector(0.42, -0.52, -0.24), rotation: vector(-0.2, 0.12, -0.08) },
      { id: 'vm-knife-pommel', shape: 'box', material: 'dark-bore', size: vector(0.24, 0.22, 0.16), position: vector(0.46, -0.58, 0.06), rotation: vector(-0.2, 0.12, -0.08) },
      { id: 'vm-knife-guard', shape: 'box', material: 'dark-bore', size: vector(0.44, 0.12, 0.12), position: vector(0.32, -0.42, -0.52), rotation: vector(0, 0.08, 0.08) },
      { id: 'vm-knife-spine', shape: 'box', material: 'blued-steel', size: vector(0.18, 0.1, 0.88), position: vector(0.18, -0.28, -0.98), rotation: vector(0.08, 0.04, 0.04) },
      { id: 'vm-knife-blade', shape: 'box', material: 'warning-matte-gray', size: vector(0.26, 0.08, 1.08), position: vector(0.24, -0.22, -1.04), rotation: vector(0.08, 0.04, 0.04) },
      { id: 'vm-knife-clipped-tip', shape: 'box', material: 'blued-steel', size: vector(0.18, 0.06, 0.26), position: vector(0.2, -0.18, -1.66), rotation: vector(0.18, 0.06, 0.16) },
    ],
    hooks: createHooks({ muzzle: vector(0.2, -0.18, -1.82), shellEject: vector(0.32, -0.42, -0.52), leftHand: vector(0.3, -0.78, -0.3), rightHand: vector(0.56, -0.84, 0.02), magazine: vector(0.42, -0.52, -0.24), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.62, -0.34, -0.32), switchRaiseMs: 130, fireKick: vector(0.014, 0.012, 0.034), recoil: { pitch: 0.18, yaw: 0.12, settleMs: 80 }, bob: { amplitude: 0.032, frequency: 9.4, sprintMultiplier: 1.8 }, muzzleFlashScale: 0.18 }),
  }),
  createModel({
    weaponId: 'glock18',
    role: WEAPON_MODEL_ROLES.PISTOL,
    silhouette: 'compact rectangular slide with short barrel and angled grip',
    worldParts: [
      { id: 'slide', shape: 'box', material: 'matte-gunmetal', size: vector(0.62, 0.16, 0.18), position: vector(0, 0.1, 0.02) },
      { id: 'frame', shape: 'box', material: 'charcoal-polymer', size: vector(0.5, 0.12, 0.14), position: vector(-0.02, -0.02, 0) },
      { id: 'barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.12, 0.12, 0.24), position: vector(0.36, 0.1, 0.02), rotation: vector(0, 1.5708, 0) },
      { id: 'grip', shape: 'box', material: 'ribbed-black', size: vector(0.16, 0.36, 0.14), position: vector(-0.14, -0.22, -0.02), rotation: vector(0, 0, -0.18) },
    ],
    viewmodelParts: [
      { id: 'vm-slide', shape: 'box', material: 'matte-gunmetal', size: vector(0.32, 0.22, 0.78), position: vector(0.38, -0.12, -0.64) },
      { id: 'vm-front-sight', shape: 'box', material: 'dark-bore', size: vector(0.08, 0.08, 0.12), position: vector(0.38, 0.02, -1.04) },
      { id: 'vm-frame', shape: 'box', material: 'charcoal-polymer', size: vector(0.26, 0.16, 0.62), position: vector(0.38, -0.3, -0.5) },
      { id: 'vm-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.14, 0.14, 0.36), position: vector(0.38, -0.12, -1.02), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-trigger-guard', shape: 'box', material: 'dark-bore', size: vector(0.22, 0.08, 0.18), position: vector(0.38, -0.42, -0.36), rotation: vector(0, 0, 0.06) },
      { id: 'vm-grip', shape: 'box', material: 'ribbed-black', size: vector(0.26, 0.52, 0.22), position: vector(0.46, -0.58, -0.16), rotation: vector(-0.18, 0, -0.08) },
      { id: 'vm-magazine-base', shape: 'box', material: 'charcoal-polymer', size: vector(0.28, 0.1, 0.24), position: vector(0.48, -0.84, -0.08), rotation: vector(-0.18, 0, -0.08) },
    ],
    hooks: createHooks({ muzzle: vector(0.38, -0.12, -1.24), shellEject: vector(0.55, -0.02, -0.56), leftHand: vector(0.16, -0.78, -0.24), rightHand: vector(0.52, -0.86, 0.02), magazine: vector(0.48, -0.76, -0.1), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.62, -0.32, -0.3), switchRaiseMs: 180, fireKick: vector(0, 0.018, 0.044), recoil: { pitch: 0.75, yaw: 0.24, settleMs: 105 }, bob: { amplitude: 0.018, frequency: 8.5, sprintMultiplier: 1.35 }, muzzleFlashScale: 0.58 }),
  }),
  createModel({
    weaponId: 'ak47',
    role: WEAPON_MODEL_ROLES.RIFLE,
    silhouette: 'long angular receiver, forward handguard, curved magazine, and fixed stock',
    worldParts: [
      { id: 'receiver', shape: 'box', material: 'oiled-black-steel', size: vector(0.86, 0.2, 0.2), position: vector(0.04, 0.02, 0) },
      { id: 'barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.72), position: vector(0.78, 0.04, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'handguard', shape: 'box', material: 'warm-wood', size: vector(0.42, 0.16, 0.22), position: vector(0.46, -0.02, 0) },
      { id: 'stock', shape: 'box', material: 'warm-wood', size: vector(0.48, 0.2, 0.2), position: vector(-0.56, 0, 0), rotation: vector(0, 0, -0.08) },
      { id: 'curved-magazine', shape: 'box', material: 'oiled-black-steel', size: vector(0.18, 0.46, 0.18), position: vector(0.02, -0.32, 0.02), rotation: vector(0, 0, 0.2) },
    ],
    viewmodelParts: [
      { id: 'vm-receiver', shape: 'box', material: 'oiled-black-steel', size: vector(0.36, 0.24, 0.96), position: vector(0.34, -0.2, -0.54) },
      { id: 'vm-receiver-cover', shape: 'box', material: 'matte-gunmetal', size: vector(0.28, 0.12, 0.62), position: vector(0.34, -0.06, -0.62) },
      { id: 'vm-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.1, 0.1, 0.98), position: vector(0.34, -0.16, -1.38), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-front-sight', shape: 'box', material: 'dark-bore', size: vector(0.18, 0.18, 0.12), position: vector(0.34, -0.02, -1.76) },
      { id: 'vm-handguard', shape: 'box', material: 'warm-wood', size: vector(0.48, 0.2, 0.56), position: vector(0.34, -0.28, -1.0) },
      { id: 'vm-stock-tail', shape: 'box', material: 'warm-wood', size: vector(0.42, 0.2, 0.38), position: vector(0.4, -0.24, 0.1), rotation: vector(-0.06, 0.08, -0.04) },
      { id: 'vm-pistol-grip', shape: 'box', material: 'warm-wood', size: vector(0.24, 0.48, 0.24), position: vector(0.44, -0.56, -0.24), rotation: vector(-0.2, 0, -0.08) },
      { id: 'vm-curved-magazine', shape: 'box', material: 'oiled-black-steel', size: vector(0.24, 0.58, 0.24), position: vector(0.3, -0.62, -0.5), rotation: vector(-0.22, 0, 0.08) },
      { id: 'vm-magazine-lip', shape: 'box', material: 'matte-gunmetal', size: vector(0.26, 0.14, 0.28), position: vector(0.3, -0.38, -0.46), rotation: vector(-0.1, 0, 0.04) },
      { id: 'vm-magazine-spine', shape: 'box', material: 'matte-gunmetal', size: vector(0.08, 0.48, 0.26), position: vector(0.19, -0.62, -0.51), rotation: vector(-0.22, 0, 0.08) },
      { id: 'vm-gas-tube', shape: 'box', material: 'warm-wood', size: vector(0.42, 0.08, 0.24), position: vector(0.34, -0.12, -0.98) },
      { id: 'vm-rear-sight', shape: 'box', material: 'dark-bore', size: vector(0.16, 0.12, 0.12), position: vector(0.34, 0.04, -0.48) },
      { id: 'vm-stock-cheek', shape: 'box', material: 'warm-wood', size: vector(0.3, 0.08, 0.24), position: vector(0.4, -0.1, 0.02), rotation: vector(-0.06, 0.08, -0.04) },
      { id: 'vm-muzzle-brake', shape: 'cylinder', material: 'matte-gunmetal', size: vector(0.14, 0.14, 0.16), position: vector(0.34, -0.16, -1.92), rotation: vector(1.5708, 0, 0) },
    ],
    hooks: createHooks({ muzzle: vector(0.34, -0.16, -1.92), shellEject: vector(0.58, -0.02, -0.46), leftHand: vector(0.16, -0.78, -0.92), rightHand: vector(0.54, -0.86, -0.12), magazine: vector(0.3, -0.78, -0.54), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.64, -0.34, -0.32), switchRaiseMs: 270, fireKick: vector(-0.006, 0.032, 0.082), recoil: { pitch: 1.25, yaw: 0.42, settleMs: 155 }, bob: { amplitude: 0.024, frequency: 7.2, sprintMultiplier: 1.5 }, muzzleFlashScale: 0.92 }),
  }),
  createModel({
    weaponId: 'awp',
    role: WEAPON_MODEL_ROLES.SNIPER,
    silhouette: 'oversized long barrel with raised scope and deep stock',
    worldParts: [
      { id: 'long-body', shape: 'box', material: 'forest-polymer', size: vector(1.08, 0.18, 0.18), position: vector(0, 0, 0) },
      { id: 'heavy-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.96), position: vector(0.92, 0.02, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'scope', shape: 'cylinder', material: 'black-glass', size: vector(0.18, 0.18, 0.5), position: vector(0.12, 0.26, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'stock', shape: 'box', material: 'forest-polymer', size: vector(0.54, 0.26, 0.2), position: vector(-0.72, -0.02, 0) },
      { id: 'short-magazine', shape: 'box', material: 'dark-bore', size: vector(0.18, 0.28, 0.16), position: vector(0, -0.28, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-long-body', shape: 'box', material: 'forest-polymer', size: vector(1.28, 0.24, 0.24), position: vector(0.34, -0.22, 0.42) },
      { id: 'vm-heavy-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.1, 0.1, 1.2), position: vector(1.42, -0.2, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-scope', shape: 'cylinder', material: 'black-glass', size: vector(0.22, 0.22, 0.62), position: vector(0.48, 0.08, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-stock', shape: 'box', material: 'forest-polymer', size: vector(0.48, 0.28, 0.24), position: vector(-0.44, -0.26, 0.34) },
      { id: 'vm-short-magazine', shape: 'box', material: 'dark-bore', size: vector(0.2, 0.36, 0.18), position: vector(0.26, -0.58, 0.32) },
    ],
    hooks: createHooks({ muzzle: vector(2.08, -0.2, 0.42), shellEject: vector(0.54, -0.02, 0.22), leftHand: vector(0.72, -0.5, 0.34), rightHand: vector(-0.04, -0.58, 0.12), magazine: vector(0.26, -0.62, 0.3), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.52, -0.48, -0.94), switchRaiseMs: 360, fireKick: vector(-0.012, 0.048, -0.12), recoil: { pitch: 2.8, yaw: 0.55, settleMs: 240 }, bob: { amplitude: 0.016, frequency: 5.9, sprintMultiplier: 1.35 }, muzzleFlashScale: 1.18 }),
  }),
  createModel({
    weaponId: 'mp5',
    role: WEAPON_MODEL_ROLES.SMG,
    silhouette: 'short tubular receiver, compact foregrip, straight magazine, and collapsed stock',
    worldParts: [
      { id: 'tube-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.72, 0.18, 0.18), position: vector(0.08, 0.04, 0) },
      { id: 'stub-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.36), position: vector(0.58, 0.04, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'foregrip', shape: 'box', material: 'charcoal-polymer', size: vector(0.28, 0.16, 0.2), position: vector(0.34, -0.1, 0) },
      { id: 'straight-magazine', shape: 'box', material: 'matte-gunmetal', size: vector(0.14, 0.48, 0.16), position: vector(0.02, -0.32, 0) },
      { id: 'stock-wire', shape: 'box', material: 'dark-bore', size: vector(0.34, 0.08, 0.12), position: vector(-0.42, 0.02, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-tube-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.9, 0.22, 0.24), position: vector(0.34, -0.22, 0.42) },
      { id: 'vm-stub-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.5), position: vector(1.02, -0.2, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-foregrip', shape: 'box', material: 'charcoal-polymer', size: vector(0.36, 0.2, 0.24), position: vector(0.66, -0.42, 0.38) },
      { id: 'vm-straight-magazine', shape: 'box', material: 'matte-gunmetal', size: vector(0.16, 0.58, 0.2), position: vector(0.28, -0.7, 0.32) },
      { id: 'vm-stock-wire', shape: 'box', material: 'dark-bore', size: vector(0.34, 0.08, 0.14), position: vector(-0.28, -0.22, 0.34) },
    ],
    hooks: createHooks({ muzzle: vector(1.3, -0.2, 0.42), shellEject: vector(0.46, -0.04, 0.22), leftHand: vector(0.64, -0.5, 0.34), rightHand: vector(0.02, -0.58, 0.12), magazine: vector(0.28, -0.78, 0.3), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.46, -0.44, -0.78), switchRaiseMs: 220, fireKick: vector(0.002, 0.022, -0.056), recoil: { pitch: 0.72, yaw: 0.36, settleMs: 115 }, bob: { amplitude: 0.026, frequency: 8.8, sprintMultiplier: 1.65 }, muzzleFlashScale: 0.68 }),
  }),
  createModel({
    weaponId: 'm3',
    role: WEAPON_MODEL_ROLES.SHOTGUN,
    silhouette: 'pump shotgun with underbarrel tube and chunky wood furniture',
    worldParts: [
      { id: 'receiver', shape: 'box', material: 'blued-steel', size: vector(0.62, 0.2, 0.2), position: vector(0, 0, 0) },
      { id: 'barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.86), position: vector(0.72, 0.08, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'mag-tube', shape: 'cylinder', material: 'blued-steel', size: vector(0.07, 0.07, 0.76), position: vector(0.68, -0.06, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'pump', shape: 'box', material: 'warm-wood', size: vector(0.34, 0.16, 0.24), position: vector(0.44, -0.18, 0) },
      { id: 'stock', shape: 'box', material: 'warm-wood', size: vector(0.52, 0.26, 0.22), position: vector(-0.54, -0.02, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-receiver', shape: 'box', material: 'blued-steel', size: vector(0.78, 0.24, 0.26), position: vector(0.22, -0.22, 0.42) },
      { id: 'vm-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 1.04), position: vector(1.02, -0.14, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-mag-tube', shape: 'cylinder', material: 'blued-steel', size: vector(0.08, 0.08, 0.92), position: vector(0.96, -0.32, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-pump', shape: 'box', material: 'warm-wood', size: vector(0.44, 0.2, 0.3), position: vector(0.62, -0.48, 0.38) },
      { id: 'vm-stock', shape: 'box', material: 'warm-wood', size: vector(0.4, 0.28, 0.24), position: vector(-0.38, -0.28, 0.34) },
    ],
    hooks: createHooks({ muzzle: vector(1.62, -0.14, 0.42), shellEject: vector(0.28, -0.04, 0.2), leftHand: vector(0.62, -0.54, 0.34), rightHand: vector(-0.04, -0.6, 0.12), magazine: vector(0.58, -0.34, 0.36), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.5, -0.48, -0.86), switchRaiseMs: 310, fireKick: vector(-0.006, 0.04, -0.1), recoil: { pitch: 2.15, yaw: 0.7, settleMs: 210 }, bob: { amplitude: 0.02, frequency: 6.4, sprintMultiplier: 1.42 }, muzzleFlashScale: 1.05 }),
  }),
  createModel({
    weaponId: 'm249',
    role: WEAPON_MODEL_ROLES.MACHINE_GUN,
    silhouette: 'heavy boxed receiver, belt drum, long barrel, and braced stock',
    worldParts: [
      { id: 'box-receiver', shape: 'box', material: 'olive-steel', size: vector(0.86, 0.28, 0.28), position: vector(0.04, 0, 0) },
      { id: 'heavy-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.1, 0.1, 0.9), position: vector(0.88, 0.06, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'heat-shroud', shape: 'box', material: 'perforated-black', size: vector(0.46, 0.18, 0.24), position: vector(0.52, 0.08, 0) },
      { id: 'ammo-box', shape: 'box', material: 'olive-canvas', size: vector(0.34, 0.42, 0.28), position: vector(0.08, -0.36, 0.04) },
      { id: 'stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.5, 0.24, 0.24), position: vector(-0.62, -0.02, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-box-receiver', shape: 'box', material: 'olive-steel', size: vector(1.04, 0.32, 0.34), position: vector(0.28, -0.24, 0.42) },
      { id: 'vm-heavy-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.11, 0.11, 1.12), position: vector(1.28, -0.16, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-heat-shroud', shape: 'box', material: 'perforated-black', size: vector(0.58, 0.22, 0.3), position: vector(0.78, -0.16, 0.42) },
      { id: 'vm-ammo-box', shape: 'box', material: 'olive-canvas', size: vector(0.4, 0.52, 0.34), position: vector(0.24, -0.76, 0.34) },
      { id: 'vm-stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.42, 0.28, 0.26), position: vector(-0.44, -0.28, 0.34) },
    ],
    hooks: createHooks({ muzzle: vector(1.9, -0.16, 0.42), shellEject: vector(0.44, -0.02, 0.18), leftHand: vector(0.72, -0.54, 0.34), rightHand: vector(-0.04, -0.62, 0.1), magazine: vector(0.24, -0.82, 0.32), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.58, -0.5, -0.92), switchRaiseMs: 420, fireKick: vector(-0.01, 0.036, -0.096), recoil: { pitch: 1.35, yaw: 0.82, settleMs: 190 }, bob: { amplitude: 0.014, frequency: 5.6, sprintMultiplier: 1.25 }, muzzleFlashScale: 1.04 }),
  }),
  createModel({
    weaponId: 'usp',
    role: WEAPON_MODEL_ROLES.PISTOL,
    silhouette: 'compact polymer-framed pistol with exposed hammer, short barrel, and raised front sight',
    worldParts: [
      { id: 'slide', shape: 'box', material: 'matte-gunmetal', size: vector(0.6, 0.18, 0.18), position: vector(0, 0.08, 0) },
      { id: 'barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.1, 0.1, 0.22), position: vector(0.38, 0.08, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'frame', shape: 'box', material: 'charcoal-polymer', size: vector(0.48, 0.14, 0.16), position: vector(-0.02, -0.04, 0) },
      { id: 'hammer', shape: 'box', material: 'dark-bore', size: vector(0.08, 0.1, 0.14), position: vector(-0.3, 0.1, 0) },
      { id: 'grip', shape: 'box', material: 'ribbed-black', size: vector(0.18, 0.34, 0.16), position: vector(-0.14, -0.24, 0), rotation: vector(0, 0, -0.16) },
    ],
    viewmodelParts: [
      { id: 'vm-slide', shape: 'box', material: 'matte-gunmetal', size: vector(0.3, 0.2, 0.76), position: vector(0.38, -0.12, -0.6) },
      { id: 'vm-slide-angles', shape: 'box', material: 'matte-gunmetal', size: vector(0.14, 0.12, 0.18), position: vector(0.38, 0.0, -0.36), rotation: vector(0, 0, 0.12) },
      { id: 'vm-front-sight', shape: 'box', material: 'dark-bore', size: vector(0.06, 0.1, 0.1), position: vector(0.38, 0.0, -1.02) },
      { id: 'vm-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.12, 0.12, 0.34), position: vector(0.38, -0.12, -1.0), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-frame', shape: 'box', material: 'charcoal-polymer', size: vector(0.24, 0.18, 0.6), position: vector(0.38, -0.3, -0.48) },
      { id: 'vm-hammer', shape: 'box', material: 'dark-bore', size: vector(0.14, 0.12, 0.1), position: vector(0.38, -0.04, -0.22) },
      { id: 'vm-trigger-guard', shape: 'box', material: 'dark-bore', size: vector(0.2, 0.08, 0.16), position: vector(0.38, -0.42, -0.34) },
      { id: 'vm-grip', shape: 'box', material: 'ribbed-black', size: vector(0.24, 0.5, 0.2), position: vector(0.46, -0.58, -0.14), rotation: vector(-0.16, 0, -0.06) },
      { id: 'vm-magazine-base', shape: 'box', material: 'charcoal-polymer', size: vector(0.26, 0.1, 0.22), position: vector(0.48, -0.82, -0.06), rotation: vector(-0.16, 0, -0.06) },
    ],
    hooks: createHooks({ muzzle: vector(0.38, -0.12, -1.22), shellEject: vector(0.54, 0.0, -0.54), leftHand: vector(0.16, -0.78, -0.22), rightHand: vector(0.52, -0.86, 0.04), magazine: vector(0.48, -0.74, -0.08), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.64, -0.32, -0.3), switchRaiseMs: 190, fireKick: vector(0, 0.022, 0.05), recoil: { pitch: 0.9, yaw: 0.28, settleMs: 110 }, bob: { amplitude: 0.018, frequency: 8.2, sprintMultiplier: 1.35 }, muzzleFlashScale: 0.62 }),
  }),
  createModel({
    weaponId: 'deagle',
    role: WEAPON_MODEL_ROLES.PISTOL,
    silhouette: 'oversized pistol with massive slide, long barrel with muzzle brake, and large wrap-around grip',
    worldParts: [
      { id: 'big-slide', shape: 'box', material: 'matte-gunmetal', size: vector(0.74, 0.22, 0.22), position: vector(0.04, 0.08, 0) },
      { id: 'long-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.38), position: vector(0.62, 0.08, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'muzzle-brake', shape: 'box', material: 'dark-bore', size: vector(0.16, 0.12, 0.22), position: vector(0.74, 0.06, 0) },
      { id: 'frame', shape: 'box', material: 'charcoal-polymer', size: vector(0.54, 0.16, 0.2), position: vector(0, -0.04, 0) },
      { id: 'big-grip', shape: 'box', material: 'ribbed-black', size: vector(0.24, 0.4, 0.22), position: vector(-0.16, -0.28, 0), rotation: vector(0, 0, -0.2) },
    ],
    viewmodelParts: [
      { id: 'vm-big-slide', shape: 'box', material: 'matte-gunmetal', size: vector(0.36, 0.26, 0.84), position: vector(0.36, -0.14, -0.6) },
      { id: 'vm-slide-top', shape: 'box', material: 'matte-gunmetal', size: vector(0.2, 0.12, 0.72), position: vector(0.36, 0.0, -0.58) },
      { id: 'vm-long-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.12, 0.12, 0.5), position: vector(0.36, -0.14, -1.22), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-muzzle-brake', shape: 'box', material: 'dark-bore', size: vector(0.24, 0.18, 0.18), position: vector(0.36, -0.12, -1.48) },
      { id: 'vm-brake-port', shape: 'box', material: 'dark-bore', size: vector(0.16, 0.08, 0.08), position: vector(0.36, -0.02, -1.48) },
      { id: 'vm-frame', shape: 'box', material: 'charcoal-polymer', size: vector(0.28, 0.2, 0.68), position: vector(0.36, -0.34, -0.44) },
      { id: 'vm-trigger-guard', shape: 'box', material: 'dark-bore', size: vector(0.26, 0.08, 0.2), position: vector(0.36, -0.46, -0.3) },
      { id: 'vm-big-grip', shape: 'box', material: 'ribbed-black', size: vector(0.3, 0.56, 0.3), position: vector(0.46, -0.64, -0.08), rotation: vector(-0.2, 0, -0.08) },
      { id: 'vm-magazine-base', shape: 'box', material: 'charcoal-polymer', size: vector(0.32, 0.1, 0.28), position: vector(0.48, -0.92, 0.0), rotation: vector(-0.2, 0, -0.08) },
    ],
    hooks: createHooks({ muzzle: vector(0.36, -0.14, -1.62), shellEject: vector(0.54, 0.0, -0.52), leftHand: vector(0.14, -0.82, -0.2), rightHand: vector(0.54, -0.9, 0.06), magazine: vector(0.5, -0.84, -0.02), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.66, -0.34, -0.32), switchRaiseMs: 220, fireKick: vector(0, 0.032, 0.068), recoil: { pitch: 1.7, yaw: 0.55, settleMs: 145 }, bob: { amplitude: 0.016, frequency: 7.5, sprintMultiplier: 1.3 }, muzzleFlashScale: 0.85 }),
  }),
  createModel({
    weaponId: 'p228',
    role: WEAPON_MODEL_ROLES.PISTOL,
    silhouette: 'compact DA/SA pistol with shorter slide, rounded trigger guard, and ergonomic grip',
    worldParts: [
      { id: 'short-slide', shape: 'box', material: 'matte-gunmetal', size: vector(0.56, 0.16, 0.18), position: vector(0, 0.08, 0) },
      { id: 'short-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.1, 0.1, 0.2), position: vector(0.34, 0.08, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'slim-frame', shape: 'box', material: 'charcoal-polymer', size: vector(0.44, 0.12, 0.14), position: vector(-0.02, -0.04, 0) },
      { id: 'compact-grip', shape: 'box', material: 'ribbed-black', size: vector(0.16, 0.32, 0.14), position: vector(-0.14, -0.22, 0), rotation: vector(0, 0, -0.14) },
    ],
    viewmodelParts: [
      { id: 'vm-short-slide', shape: 'box', material: 'matte-gunmetal', size: vector(0.28, 0.2, 0.7), position: vector(0.38, -0.14, -0.58) },
      { id: 'vm-slide-roof', shape: 'box', material: 'matte-gunmetal', size: vector(0.16, 0.1, 0.58), position: vector(0.38, -0.02, -0.56) },
      { id: 'vm-short-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.12, 0.12, 0.3), position: vector(0.38, -0.14, -0.94), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-slim-frame', shape: 'box', material: 'charcoal-polymer', size: vector(0.22, 0.16, 0.56), position: vector(0.38, -0.3, -0.44) },
      { id: 'vm-round-trigger-guard', shape: 'box', material: 'dark-bore', size: vector(0.24, 0.1, 0.16), position: vector(0.38, -0.4, -0.3), rotation: vector(0, 0, 0.08) },
      { id: 'vm-compact-grip', shape: 'box', material: 'ribbed-black', size: vector(0.24, 0.48, 0.2), position: vector(0.44, -0.56, -0.1), rotation: vector(-0.16, 0, -0.06) },
      { id: 'vm-magazine', shape: 'box', material: 'charcoal-polymer', size: vector(0.26, 0.08, 0.22), position: vector(0.46, -0.78, -0.04), rotation: vector(-0.16, 0, -0.06) },
    ],
    hooks: createHooks({ muzzle: vector(0.38, -0.14, -1.14), shellEject: vector(0.54, -0.02, -0.5), leftHand: vector(0.16, -0.76, -0.2), rightHand: vector(0.5, -0.84, 0.04), magazine: vector(0.46, -0.72, -0.06), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.62, -0.3, -0.28), switchRaiseMs: 180, fireKick: vector(0, 0.02, 0.048), recoil: { pitch: 0.85, yaw: 0.26, settleMs: 105 }, bob: { amplitude: 0.018, frequency: 8.4, sprintMultiplier: 1.35 }, muzzleFlashScale: 0.6 }),
  }),
  createModel({
    weaponId: 'elite',
    role: WEAPON_MODEL_ROLES.PISTOL,
    silhouette: 'twin Beretta-style pistols with open-top slides, ported barrels, and beavertail frames',
    worldParts: [
      { id: 'left-slide', shape: 'box', material: 'blued-steel', size: vector(0.66, 0.16, 0.14), position: vector(-0.14, 0.08, 0.08) },
      { id: 'right-slide', shape: 'box', material: 'blued-steel', size: vector(0.66, 0.16, 0.14), position: vector(-0.14, 0.08, -0.08) },
      { id: 'left-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.24), position: vector(0.22, 0.08, 0.08), rotation: vector(0, 1.5708, 0) },
      { id: 'right-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.24), position: vector(0.22, 0.08, -0.08), rotation: vector(0, 1.5708, 0) },
      { id: 'twin-frame', shape: 'box', material: 'ribbed-black', size: vector(0.5, 0.14, 0.34), position: vector(-0.16, -0.02, 0) },
      { id: 'left-grip', shape: 'box', material: 'ribbed-black', size: vector(0.16, 0.34, 0.12), position: vector(-0.36, -0.22, 0.1), rotation: vector(0, 0, -0.14) },
      { id: 'right-grip', shape: 'box', material: 'ribbed-black', size: vector(0.16, 0.34, 0.12), position: vector(-0.36, -0.22, -0.1), rotation: vector(0, 0, -0.14) },
    ],
    viewmodelParts: [
      { id: 'vm-left-slide', shape: 'box', material: 'blued-steel', size: vector(0.28, 0.2, 0.78), position: vector(0.3, -0.12, -0.72) },
      { id: 'vm-right-slide', shape: 'box', material: 'blued-steel', size: vector(0.28, 0.2, 0.78), position: vector(0.54, -0.12, -0.72) },
      { id: 'vm-left-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.1, 0.1, 0.36), position: vector(0.3, -0.12, -1.12), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-right-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.1, 0.1, 0.36), position: vector(0.54, -0.12, -1.12), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-left-frame', shape: 'box', material: 'ribbed-black', size: vector(0.22, 0.14, 0.6), position: vector(0.3, -0.28, -0.56) },
      { id: 'vm-right-frame', shape: 'box', material: 'ribbed-black', size: vector(0.22, 0.14, 0.6), position: vector(0.54, -0.28, -0.56) },
      { id: 'vm-twin-trigger-guard', shape: 'box', material: 'dark-bore', size: vector(0.48, 0.08, 0.2), position: vector(0.42, -0.38, -0.42) },
      { id: 'vm-left-grip', shape: 'box', material: 'ribbed-black', size: vector(0.24, 0.48, 0.16), position: vector(0.36, -0.54, -0.28), rotation: vector(-0.18, 0, -0.06) },
      { id: 'vm-right-grip', shape: 'box', material: 'ribbed-black', size: vector(0.24, 0.48, 0.16), position: vector(0.6, -0.54, -0.28), rotation: vector(-0.18, 0, -0.06) },
    ],
    hooks: createHooks({ muzzle: vector(0.42, -0.12, -1.36), shellEject: vector(0.64, 0.0, -0.6), leftHand: vector(0.16, -0.78, -0.3), rightHand: vector(0.64, -0.86, 0.02), magazine: vector(0.42, -0.76, -0.1), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.6, -0.34, -0.3), switchRaiseMs: 210, fireKick: vector(0.002, 0.02, 0.05), recoil: { pitch: 0.78, yaw: 0.38, settleMs: 110 }, bob: { amplitude: 0.02, frequency: 8.0, sprintMultiplier: 1.32 }, muzzleFlashScale: 0.6 }),
  }),
  createModel({
    weaponId: 'fiveseven',
    role: WEAPON_MODEL_ROLES.PISTOL,
    silhouette: 'angular slim-profile pistol with polymer frame, long angular slide, and pronounced muzzle',
    worldParts: [
      { id: 'angular-slide', shape: 'box', material: 'matte-gunmetal', size: vector(0.64, 0.16, 0.16), position: vector(0.02, 0.08, 0) },
      { id: 'long-muzzle', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.28), position: vector(0.44, 0.08, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'polymer-frame', shape: 'box', material: 'charcoal-polymer', size: vector(0.5, 0.12, 0.14), position: vector(0, -0.04, 0) },
      { id: 'slender-grip', shape: 'box', material: 'ribbed-black', size: vector(0.14, 0.34, 0.14), position: vector(-0.16, -0.24, 0), rotation: vector(0, 0, -0.14) },
    ],
    viewmodelParts: [
      { id: 'vm-angular-slide', shape: 'box', material: 'matte-gunmetal', size: vector(0.26, 0.2, 0.82), position: vector(0.38, -0.12, -0.62) },
      { id: 'vm-slide-angle', shape: 'box', material: 'matte-gunmetal', size: vector(0.18, 0.08, 0.18), position: vector(0.38, 0.0, -0.36), rotation: vector(0, 0, 0.16) },
      { id: 'vm-long-muzzle', shape: 'cylinder', material: 'dark-bore', size: vector(0.1, 0.1, 0.4), position: vector(0.38, -0.12, -1.08), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-front-sight', shape: 'box', material: 'dark-bore', size: vector(0.06, 0.08, 0.08), position: vector(0.38, 0.0, -1.08) },
      { id: 'vm-polymer-frame', shape: 'box', material: 'charcoal-polymer', size: vector(0.22, 0.16, 0.64), position: vector(0.38, -0.3, -0.46) },
      { id: 'vm-trigger-guard', shape: 'box', material: 'dark-bore', size: vector(0.2, 0.08, 0.16), position: vector(0.38, -0.4, -0.32) },
      { id: 'vm-slender-grip', shape: 'box', material: 'ribbed-black', size: vector(0.22, 0.5, 0.18), position: vector(0.44, -0.56, -0.1), rotation: vector(-0.16, 0, -0.06) },
      { id: 'vm-magazine', shape: 'box', material: 'charcoal-polymer', size: vector(0.24, 0.08, 0.2), position: vector(0.46, -0.8, -0.04), rotation: vector(-0.16, 0, -0.06) },
    ],
    hooks: createHooks({ muzzle: vector(0.38, -0.12, -1.3), shellEject: vector(0.54, 0.0, -0.54), leftHand: vector(0.16, -0.76, -0.2), rightHand: vector(0.5, -0.84, 0.04), magazine: vector(0.46, -0.74, -0.06), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.62, -0.3, -0.28), switchRaiseMs: 180, fireKick: vector(0, 0.016, 0.04), recoil: { pitch: 0.7, yaw: 0.22, settleMs: 100 }, bob: { amplitude: 0.02, frequency: 8.8, sprintMultiplier: 1.38 }, muzzleFlashScale: 0.55 }),
  }),
  createModel({
    weaponId: 'xm1014',
    role: WEAPON_MODEL_ROLES.SHOTGUN,
    silhouette: 'autoloading shotgun with box magazine, railed forend, and collapsible wire stock',
    worldParts: [
      { id: 'auto-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.7, 0.22, 0.22), position: vector(0.04, 0.02, 0) },
      { id: 'shotgun-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.78), position: vector(0.76, 0.08, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'box-magazine', shape: 'box', material: 'matte-gunmetal', size: vector(0.16, 0.44, 0.18), position: vector(0.04, -0.3, 0) },
      { id: 'railed-forend', shape: 'box', material: 'charcoal-polymer', size: vector(0.38, 0.18, 0.26), position: vector(0.5, -0.06, 0) },
      { id: 'collapsible-stock', shape: 'box', material: 'dark-bore', size: vector(0.4, 0.08, 0.14), position: vector(-0.42, 0.02, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-auto-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.84, 0.26, 0.28), position: vector(0.24, -0.22, 0.42) },
      { id: 'vm-shotgun-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 1.0), position: vector(1.08, -0.16, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-railed-forend', shape: 'box', material: 'charcoal-polymer', size: vector(0.46, 0.22, 0.32), position: vector(0.68, -0.42, 0.38) },
      { id: 'vm-rail-top', shape: 'box', material: 'dark-bore', size: vector(0.36, 0.06, 0.12), position: vector(0.66, -0.32, 0.42) },
      { id: 'vm-box-magazine', shape: 'box', material: 'matte-gunmetal', size: vector(0.18, 0.54, 0.24), position: vector(0.18, -0.66, 0.3) },
      { id: 'vm-wire-stock', shape: 'box', material: 'dark-bore', size: vector(0.36, 0.08, 0.12), position: vector(-0.32, -0.24, 0.34) },
      { id: 'vm-stock-buffer', shape: 'box', material: 'charcoal-polymer', size: vector(0.14, 0.12, 0.14), position: vector(-0.4, -0.24, 0.34) },
    ],
    hooks: createHooks({ muzzle: vector(1.62, -0.16, 0.42), shellEject: vector(0.36, -0.02, 0.2), leftHand: vector(0.66, -0.52, 0.34), rightHand: vector(0.0, -0.6, 0.12), magazine: vector(0.18, -0.72, 0.28), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.52, -0.48, -0.88), switchRaiseMs: 340, fireKick: vector(-0.008, 0.042, -0.1), recoil: { pitch: 2.0, yaw: 0.68, settleMs: 200 }, bob: { amplitude: 0.018, frequency: 6.2, sprintMultiplier: 1.38 }, muzzleFlashScale: 1.0 }),
  }),
  createModel({
    weaponId: 'tmp',
    role: WEAPON_MODEL_ROLES.SMG,
    silhouette: 'ultra-compact SMG with boxy receiver, integral foregrip, and long slim barrel',
    worldParts: [
      { id: 'boxy-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.5, 0.22, 0.2), position: vector(0, 0, 0) },
      { id: 'slim-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.06, 0.06, 0.5), position: vector(0.56, 0.06, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'foregrip', shape: 'box', material: 'charcoal-polymer', size: vector(0.2, 0.2, 0.18), position: vector(0.32, -0.16, 0) },
      { id: 'compact-magazine', shape: 'box', material: 'matte-gunmetal', size: vector(0.12, 0.38, 0.16), position: vector(0.02, -0.28, 0) },
      { id: 'end-cap', shape: 'box', material: 'charcoal-polymer', size: vector(0.12, 0.2, 0.18), position: vector(-0.34, 0.0, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-boxy-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.58, 0.26, 0.26), position: vector(0.34, -0.22, 0.42) },
      { id: 'vm-slim-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.07, 0.07, 0.62), position: vector(0.96, -0.2, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-barrel-tip', shape: 'cylinder', material: 'dark-bore', size: vector(0.06, 0.06, 0.16), position: vector(1.22, -0.2, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-foregrip', shape: 'box', material: 'charcoal-polymer', size: vector(0.28, 0.26, 0.2), position: vector(0.64, -0.44, 0.38) },
      { id: 'vm-compact-magazine', shape: 'box', material: 'matte-gunmetal', size: vector(0.14, 0.48, 0.2), position: vector(0.28, -0.64, 0.3) },
      { id: 'vm-end-cap', shape: 'box', material: 'charcoal-polymer', size: vector(0.14, 0.22, 0.24), position: vector(-0.04, -0.24, 0.36) },
      { id: 'vm-rear-sight', shape: 'box', material: 'dark-bore', size: vector(0.12, 0.08, 0.1), position: vector(0.44, -0.08, 0.42) },
    ],
    hooks: createHooks({ muzzle: vector(1.36, -0.2, 0.42), shellEject: vector(0.48, -0.02, 0.22), leftHand: vector(0.62, -0.52, 0.34), rightHand: vector(0.04, -0.6, 0.12), magazine: vector(0.28, -0.7, 0.28), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.48, -0.46, -0.8), switchRaiseMs: 220, fireKick: vector(0.002, 0.016, -0.048), recoil: { pitch: 0.55, yaw: 0.32, settleMs: 100 }, bob: { amplitude: 0.028, frequency: 9.2, sprintMultiplier: 1.7 }, muzzleFlashScale: 0.58 }),
  }),
  createModel({
    weaponId: 'mac10',
    role: WEAPON_MODEL_ROLES.SMG,
    silhouette: 'blocky compact SMG with rectangular receiver, protruding magazine well, slim barrel, and wire stock',
    worldParts: [
      { id: 'block-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.44, 0.24, 0.2), position: vector(0, 0, 0) },
      { id: 'slim-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.06, 0.06, 0.34), position: vector(0.56, 0.06, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'mag-well', shape: 'box', material: 'matte-gunmetal', size: vector(0.14, 0.22, 0.18), position: vector(0.08, -0.2, 0) },
      { id: 'magazine', shape: 'box', material: 'dark-bore', size: vector(0.12, 0.28, 0.14), position: vector(0.08, -0.44, 0) },
      { id: 'wire-stock', shape: 'box', material: 'dark-bore', size: vector(0.32, 0.08, 0.1), position: vector(-0.34, 0.06, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-block-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.52, 0.28, 0.26), position: vector(0.34, -0.22, 0.42) },
      { id: 'vm-slim-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.07, 0.07, 0.48), position: vector(0.92, -0.18, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-barrel-nut', shape: 'box', material: 'dark-bore', size: vector(0.14, 0.16, 0.14), position: vector(0.74, -0.18, 0.42) },
      { id: 'vm-mag-well', shape: 'box', material: 'matte-gunmetal', size: vector(0.16, 0.28, 0.2), position: vector(0.28, -0.46, 0.34) },
      { id: 'vm-magazine', shape: 'box', material: 'dark-bore', size: vector(0.14, 0.36, 0.18), position: vector(0.28, -0.72, 0.34) },
      { id: 'vm-wire-stock', shape: 'box', material: 'dark-bore', size: vector(0.34, 0.08, 0.1), position: vector(-0.14, -0.2, 0.34) },
      { id: 'vm-cocking-handle', shape: 'box', material: 'dark-bore', size: vector(0.08, 0.08, 0.1), position: vector(0.28, -0.04, 0.5) },
    ],
    hooks: createHooks({ muzzle: vector(1.22, -0.18, 0.42), shellEject: vector(0.52, -0.02, 0.2), leftHand: vector(0.52, -0.56, 0.34), rightHand: vector(0.02, -0.62, 0.1), magazine: vector(0.28, -0.78, 0.32), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.46, -0.46, -0.82), switchRaiseMs: 220, fireKick: vector(0.004, 0.022, -0.054), recoil: { pitch: 0.68, yaw: 0.42, settleMs: 115 }, bob: { amplitude: 0.024, frequency: 8.6, sprintMultiplier: 1.6 }, muzzleFlashScale: 0.62 }),
  }),
  createModel({
    weaponId: 'ump45',
    role: WEAPON_MODEL_ROLES.SMG,
    silhouette: 'angular polymer SMG with slim barrel, straight box magazine, and collapsible stock',
    worldParts: [
      { id: 'poly-receiver', shape: 'box', material: 'charcoal-polymer', size: vector(0.66, 0.22, 0.2), position: vector(0.04, 0.02, 0) },
      { id: 'slim-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.07, 0.07, 0.44), position: vector(0.62, 0.06, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'ang-forend', shape: 'box', material: 'charcoal-polymer', size: vector(0.32, 0.16, 0.24), position: vector(0.4, -0.08, 0) },
      { id: 'straight-mag', shape: 'box', material: 'matte-gunmetal', size: vector(0.14, 0.44, 0.16), position: vector(0.04, -0.3, 0) },
      { id: 'col-stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.36, 0.1, 0.14), position: vector(-0.42, 0.02, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-poly-receiver', shape: 'box', material: 'charcoal-polymer', size: vector(0.78, 0.26, 0.26), position: vector(0.34, -0.22, 0.42) },
      { id: 'vm-receiver-angle', shape: 'box', material: 'charcoal-polymer', size: vector(0.18, 0.14, 0.16), position: vector(0.46, -0.08, 0.42), rotation: vector(0, 0, -0.16) },
      { id: 'vm-slim-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.56), position: vector(1.02, -0.18, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-ang-forend', shape: 'box', material: 'charcoal-polymer', size: vector(0.38, 0.2, 0.28), position: vector(0.7, -0.42, 0.38) },
      { id: 'vm-straight-mag', shape: 'box', material: 'matte-gunmetal', size: vector(0.16, 0.54, 0.2), position: vector(0.28, -0.68, 0.3) },
      { id: 'vm-col-stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.34, 0.1, 0.14), position: vector(-0.24, -0.22, 0.34) },
      { id: 'vm-stock-buffer', shape: 'box', material: 'dark-bore', size: vector(0.12, 0.14, 0.16), position: vector(-0.38, -0.22, 0.34) },
    ],
    hooks: createHooks({ muzzle: vector(1.34, -0.18, 0.42), shellEject: vector(0.5, -0.02, 0.2), leftHand: vector(0.66, -0.52, 0.34), rightHand: vector(0.02, -0.6, 0.1), magazine: vector(0.28, -0.74, 0.28), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.48, -0.46, -0.82), switchRaiseMs: 240, fireKick: vector(0.002, 0.026, -0.058), recoil: { pitch: 0.82, yaw: 0.38, settleMs: 120 }, bob: { amplitude: 0.024, frequency: 8.2, sprintMultiplier: 1.55 }, muzzleFlashScale: 0.7 }),
  }),
  createModel({
    weaponId: 'p90',
    role: WEAPON_MODEL_ROLES.SMG,
    silhouette: 'bullpup SMG with top-mounted magazine, long wide receiver, and integral foregrip',
    worldParts: [
      { id: 'wide-receiver', shape: 'box', material: 'charcoal-polymer', size: vector(0.82, 0.26, 0.22), position: vector(0.06, 0.02, 0) },
      { id: 'barrel-shroud', shape: 'box', material: 'matte-gunmetal', size: vector(0.38, 0.2, 0.2), position: vector(0.64, 0.0, 0) },
      { id: 'top-magazine', shape: 'box', material: 'dark-bore', size: vector(0.48, 0.1, 0.2), position: vector(0.22, 0.28, 0) },
      { id: 'int-foregrip', shape: 'box', material: 'charcoal-polymer', size: vector(0.24, 0.16, 0.24), position: vector(0.46, -0.16, 0) },
      { id: 'stock-body', shape: 'box', material: 'charcoal-polymer', size: vector(0.38, 0.22, 0.2), position: vector(-0.44, 0.0, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-wide-receiver', shape: 'box', material: 'charcoal-polymer', size: vector(0.96, 0.3, 0.28), position: vector(0.32, -0.24, 0.42) },
      { id: 'vm-barrel-shroud', shape: 'box', material: 'matte-gunmetal', size: vector(0.46, 0.22, 0.22), position: vector(0.92, -0.22, 0.42) },
      { id: 'vm-muzzle-ring', shape: 'box', material: 'dark-bore', size: vector(0.16, 0.16, 0.12), position: vector(1.18, -0.22, 0.42) },
      { id: 'vm-top-magazine', shape: 'box', material: 'dark-bore', size: vector(0.56, 0.12, 0.24), position: vector(0.46, -0.06, 0.42) },
      { id: 'vm-mag-ridge', shape: 'box', material: 'dark-bore', size: vector(0.44, 0.08, 0.1), position: vector(0.48, 0.02, 0.42) },
      { id: 'vm-int-foregrip', shape: 'box', material: 'charcoal-polymer', size: vector(0.28, 0.22, 0.28), position: vector(0.66, -0.48, 0.38) },
      { id: 'vm-stock-body', shape: 'box', material: 'charcoal-polymer', size: vector(0.36, 0.24, 0.26), position: vector(-0.26, -0.26, 0.34) },
      { id: 'vm-rear-sight', shape: 'box', material: 'dark-bore', size: vector(0.18, 0.14, 0.08), position: vector(0.14, -0.06, 0.42) },
    ],
    hooks: createHooks({ muzzle: vector(1.32, -0.22, 0.42), shellEject: vector(0.62, -0.04, 0.18), leftHand: vector(0.64, -0.56, 0.34), rightHand: vector(-0.02, -0.62, 0.1), magazine: vector(0.48, -0.1, 0.4), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.48, -0.46, -0.82), switchRaiseMs: 250, fireKick: vector(0.002, 0.018, -0.05), recoil: { pitch: 0.6, yaw: 0.42, settleMs: 105 }, bob: { amplitude: 0.026, frequency: 8.8, sprintMultiplier: 1.6 }, muzzleFlashScale: 0.6 }),
  }),
  createModel({
    weaponId: 'm4a1',
    role: WEAPON_MODEL_ROLES.RIFLE,
    silhouette: 'compact carbine with carry handle rear sight, collapsible stock, and slim handguards',
    worldParts: [
      { id: 'ar-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.8, 0.2, 0.2), position: vector(0.04, 0.04, 0) },
      { id: 'ar-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.66), position: vector(0.72, 0.06, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'slim-handguard', shape: 'box', material: 'charcoal-polymer', size: vector(0.38, 0.16, 0.22), position: vector(0.44, -0.02, 0) },
      { id: 'carry-handle', shape: 'box', material: 'matte-gunmetal', size: vector(0.12, 0.22, 0.14), position: vector(0.26, 0.24, 0) },
      { id: 'col-stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.44, 0.18, 0.18), position: vector(-0.52, 0.02, 0) },
      { id: 'curved-mag', shape: 'box', material: 'dark-bore', size: vector(0.16, 0.44, 0.16), position: vector(0.02, -0.28, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-ar-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.34, 0.22, 0.88), position: vector(0.34, -0.2, -0.52) },
      { id: 'vm-ar-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.88), position: vector(0.34, -0.16, -1.32), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-flash-hider', shape: 'cylinder', material: 'dark-bore', size: vector(0.12, 0.12, 0.14), position: vector(0.34, -0.16, -1.8), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-slim-handguard', shape: 'box', material: 'charcoal-polymer', size: vector(0.44, 0.18, 0.5), position: vector(0.34, -0.28, -0.94) },
      { id: 'vm-carry-handle', shape: 'box', material: 'matte-gunmetal', size: vector(0.14, 0.28, 0.22), position: vector(0.34, 0.04, -0.42) },
      { id: 'vm-col-stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.38, 0.18, 0.34), position: vector(0.4, -0.24, 0.12) },
      { id: 'vm-pistol-grip', shape: 'box', material: 'charcoal-polymer', size: vector(0.22, 0.46, 0.22), position: vector(0.44, -0.54, -0.22), rotation: vector(-0.18, 0, -0.06) },
      { id: 'vm-curved-mag', shape: 'box', material: 'dark-bore', size: vector(0.22, 0.56, 0.22), position: vector(0.3, -0.6, -0.48), rotation: vector(-0.2, 0, 0.06) },
    ],
    hooks: createHooks({ muzzle: vector(0.34, -0.16, -1.92), shellEject: vector(0.54, -0.02, -0.44), leftHand: vector(0.16, -0.78, -0.88), rightHand: vector(0.54, -0.86, -0.1), magazine: vector(0.3, -0.76, -0.52), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.64, -0.34, -0.32), switchRaiseMs: 260, fireKick: vector(-0.004, 0.028, 0.072), recoil: { pitch: 1.05, yaw: 0.38, settleMs: 140 }, bob: { amplitude: 0.022, frequency: 7.4, sprintMultiplier: 1.48 }, muzzleFlashScale: 0.85 }),
  }),
  createModel({
    weaponId: 'famas',
    role: WEAPON_MODEL_ROLES.RIFLE,
    silhouette: 'bullpup rifle with carry handle, long integral forend, and straight magazine behind grip',
    worldParts: [
      { id: 'fam-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.82, 0.22, 0.22), position: vector(0.06, 0.02, 0) },
      { id: 'fam-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.6), position: vector(0.76, 0.06, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'long-forend', shape: 'box', material: 'charcoal-polymer', size: vector(0.56, 0.18, 0.24), position: vector(0.44, -0.06, 0) },
      { id: 'carry-handle', shape: 'box', material: 'matte-gunmetal', size: vector(0.18, 0.24, 0.14), position: vector(0.2, 0.26, 0) },
      { id: 'straight-mag', shape: 'box', material: 'dark-bore', size: vector(0.12, 0.44, 0.16), position: vector(-0.14, -0.28, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-fam-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.34, 0.24, 0.94), position: vector(0.34, -0.2, -0.52) },
      { id: 'vm-fam-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.82), position: vector(0.34, -0.16, -1.3), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-long-forend', shape: 'box', material: 'charcoal-polymer', size: vector(0.5, 0.2, 0.62), position: vector(0.34, -0.28, -0.98) },
      { id: 'vm-forend-bipod', shape: 'box', material: 'dark-bore', size: vector(0.06, 0.14, 0.46), position: vector(0.34, -0.44, -0.96) },
      { id: 'vm-carry-handle', shape: 'box', material: 'matte-gunmetal', size: vector(0.16, 0.3, 0.26), position: vector(0.34, 0.04, -0.4) },
      { id: 'vm-stock-body', shape: 'box', material: 'charcoal-polymer', size: vector(0.28, 0.22, 0.4), position: vector(0.4, -0.22, 0.14) },
      { id: 'vm-pistol-grip', shape: 'box', material: 'ribbed-black', size: vector(0.22, 0.48, 0.22), position: vector(0.44, -0.56, -0.06), rotation: vector(-0.2, 0, -0.06) },
      { id: 'vm-straight-mag', shape: 'box', material: 'dark-bore', size: vector(0.2, 0.56, 0.2), position: vector(0.26, -0.58, -0.16), rotation: vector(-0.18, 0, 0.04) },
    ],
    hooks: createHooks({ muzzle: vector(0.34, -0.16, -1.76), shellEject: vector(0.54, -0.02, -0.44), leftHand: vector(0.16, -0.78, -0.9), rightHand: vector(0.54, -0.86, -0.04), magazine: vector(0.26, -0.74, -0.2), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.64, -0.36, -0.34), switchRaiseMs: 280, fireKick: vector(-0.004, 0.026, 0.068), recoil: { pitch: 0.92, yaw: 0.36, settleMs: 135 }, bob: { amplitude: 0.022, frequency: 7.6, sprintMultiplier: 1.48 }, muzzleFlashScale: 0.8 }),
  }),
  createModel({
    weaponId: 'galil',
    role: WEAPON_MODEL_ROLES.RIFLE,
    silhouette: 'assault rifle with AK-style receiver, folding stock, ventilated handguard, and curved magazine',
    worldParts: [
      { id: 'gal-receiver', shape: 'box', material: 'oiled-black-steel', size: vector(0.82, 0.2, 0.2), position: vector(0.04, 0.02, 0) },
      { id: 'gal-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.68), position: vector(0.74, 0.04, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'vent-handguard', shape: 'box', material: 'charcoal-polymer', size: vector(0.4, 0.16, 0.24), position: vector(0.44, -0.04, 0) },
      { id: 'fold-stock', shape: 'box', material: 'dark-bore', size: vector(0.4, 0.16, 0.16), position: vector(-0.52, 0.02, 0) },
      { id: 'curved-mag', shape: 'box', material: 'oiled-black-steel', size: vector(0.16, 0.44, 0.18), position: vector(0.02, -0.3, 0), rotation: vector(0, 0, 0.18) },
    ],
    viewmodelParts: [
      { id: 'vm-gal-receiver', shape: 'box', material: 'oiled-black-steel', size: vector(0.34, 0.24, 0.92), position: vector(0.34, -0.2, -0.52) },
      { id: 'vm-gal-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.9), position: vector(0.34, -0.16, -1.34), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-front-sight', shape: 'box', material: 'dark-bore', size: vector(0.16, 0.18, 0.1), position: vector(0.34, -0.02, -1.7) },
      { id: 'vm-vent-handguard', shape: 'box', material: 'charcoal-polymer', size: vector(0.44, 0.2, 0.52), position: vector(0.34, -0.28, -0.96) },
      { id: 'vm-vent-hole', shape: 'box', material: 'dark-bore', size: vector(0.06, 0.14, 0.36), position: vector(0.34, -0.28, -0.96) },
      { id: 'vm-fold-stock', shape: 'box', material: 'dark-bore', size: vector(0.36, 0.18, 0.3), position: vector(0.4, -0.26, 0.14) },
      { id: 'vm-pistol-grip', shape: 'box', material: 'warm-wood', size: vector(0.24, 0.48, 0.24), position: vector(0.44, -0.56, -0.22), rotation: vector(-0.2, 0, -0.08) },
      { id: 'vm-curved-mag', shape: 'box', material: 'oiled-black-steel', size: vector(0.22, 0.56, 0.22), position: vector(0.3, -0.6, -0.48), rotation: vector(-0.22, 0, 0.08) },
    ],
    hooks: createHooks({ muzzle: vector(0.34, -0.16, -1.84), shellEject: vector(0.56, -0.02, -0.44), leftHand: vector(0.16, -0.78, -0.9), rightHand: vector(0.54, -0.86, -0.1), magazine: vector(0.3, -0.76, -0.52), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.64, -0.34, -0.32), switchRaiseMs: 270, fireKick: vector(-0.006, 0.03, 0.076), recoil: { pitch: 1.1, yaw: 0.4, settleMs: 145 }, bob: { amplitude: 0.022, frequency: 7.4, sprintMultiplier: 1.48 }, muzzleFlashScale: 0.88 }),
  }),
  createModel({
    weaponId: 'sg552',
    role: WEAPON_MODEL_ROLES.RIFLE,
    silhouette: 'compact assault rifle with railed handguard, scope sight, and telescoping stock',
    worldParts: [
      { id: 'sg-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.72, 0.2, 0.2), position: vector(0.04, 0.04, 0) },
      { id: 'sg-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.58), position: vector(0.68, 0.06, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'rail-handguard', shape: 'box', material: 'charcoal-polymer', size: vector(0.34, 0.16, 0.24), position: vector(0.4, -0.02, 0) },
      { id: 'scope', shape: 'cylinder', material: 'black-glass', size: vector(0.14, 0.14, 0.26), position: vector(0.18, 0.26, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'tel-stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.4, 0.18, 0.18), position: vector(-0.46, 0.02, 0) },
      { id: 'curved-mag', shape: 'box', material: 'dark-bore', size: vector(0.16, 0.42, 0.16), position: vector(0.02, -0.28, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-sg-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.3, 0.22, 0.82), position: vector(0.34, -0.2, -0.5) },
      { id: 'vm-sg-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.78), position: vector(0.34, -0.16, -1.26), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-flash-hider', shape: 'cylinder', material: 'dark-bore', size: vector(0.12, 0.12, 0.12), position: vector(0.34, -0.16, -1.68), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-rail-handguard', shape: 'box', material: 'charcoal-polymer', size: vector(0.4, 0.18, 0.46), position: vector(0.34, -0.28, -0.9) },
      { id: 'vm-rail-top', shape: 'box', material: 'dark-bore', size: vector(0.32, 0.06, 0.36), position: vector(0.34, -0.14, -0.88) },
      { id: 'vm-scope', shape: 'cylinder', material: 'black-glass', size: vector(0.18, 0.18, 0.36), position: vector(0.34, 0.04, -0.56), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-tel-stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.36, 0.18, 0.32), position: vector(0.4, -0.24, 0.14) },
      { id: 'vm-pistol-grip', shape: 'box', material: 'ribbed-black', size: vector(0.22, 0.46, 0.22), position: vector(0.44, -0.54, -0.2), rotation: vector(-0.18, 0, -0.06) },
      { id: 'vm-curved-mag', shape: 'box', material: 'dark-bore', size: vector(0.22, 0.54, 0.2), position: vector(0.3, -0.58, -0.46), rotation: vector(-0.2, 0, 0.06) },
    ],
    hooks: createHooks({ muzzle: vector(0.34, -0.16, -1.78), shellEject: vector(0.54, -0.02, -0.42), leftHand: vector(0.16, -0.78, -0.84), rightHand: vector(0.54, -0.86, -0.08), magazine: vector(0.3, -0.74, -0.5), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.64, -0.34, -0.32), switchRaiseMs: 280, fireKick: vector(-0.004, 0.03, 0.074), recoil: { pitch: 1.08, yaw: 0.4, settleMs: 140 }, bob: { amplitude: 0.022, frequency: 7.4, sprintMultiplier: 1.46 }, muzzleFlashScale: 0.82 }),
  }),
  createModel({
    weaponId: 'aug',
    role: WEAPON_MODEL_ROLES.RIFLE,
    silhouette: 'bullpup rifle with integrated scope, long barrel shroud, and forward grip',
    worldParts: [
      { id: 'aug-body', shape: 'box', material: 'forest-polymer', size: vector(0.88, 0.26, 0.22), position: vector(0.06, 0.02, 0) },
      { id: 'aug-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.66), position: vector(0.78, 0.06, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'barrel-shroud', shape: 'box', material: 'forest-polymer', size: vector(0.48, 0.2, 0.2), position: vector(0.52, -0.02, 0) },
      { id: 'int-scope', shape: 'box', material: 'black-glass', size: vector(0.2, 0.14, 0.16), position: vector(0.16, 0.28, 0) },
      { id: 'forward-grip', shape: 'box', material: 'charcoal-polymer', size: vector(0.14, 0.22, 0.18), position: vector(0.54, -0.18, 0) },
      { id: 'aug-magazine', shape: 'box', material: 'dark-bore', size: vector(0.14, 0.44, 0.16), position: vector(-0.02, -0.28, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-aug-body', shape: 'box', material: 'forest-polymer', size: vector(0.34, 0.28, 0.96), position: vector(0.34, -0.22, -0.52) },
      { id: 'vm-aug-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.88), position: vector(0.34, -0.16, -1.34), rotation: vector(1.5708, 0, 0) },
      { id: 'vm-barrel-shroud', shape: 'box', material: 'forest-polymer', size: vector(0.46, 0.22, 0.58), position: vector(0.34, -0.28, -0.96) },
      { id: 'vm-int-scope', shape: 'box', material: 'black-glass', size: vector(0.22, 0.16, 0.2), position: vector(0.34, 0.06, -0.44) },
      { id: 'vm-scope-lens', shape: 'box', material: 'black-glass', size: vector(0.08, 0.14, 0.06), position: vector(0.34, 0.06, -0.34) },
      { id: 'vm-forward-grip', shape: 'box', material: 'charcoal-polymer', size: vector(0.16, 0.28, 0.2), position: vector(0.34, -0.48, -0.86) },
      { id: 'vm-stock-body', shape: 'box', material: 'forest-polymer', size: vector(0.32, 0.24, 0.36), position: vector(0.4, -0.24, 0.16) },
      { id: 'vm-aug-magazine', shape: 'box', material: 'dark-bore', size: vector(0.22, 0.56, 0.2), position: vector(0.3, -0.6, -0.22), rotation: vector(-0.2, 0, 0.04) },
    ],
    hooks: createHooks({ muzzle: vector(0.34, -0.16, -1.84), shellEject: vector(0.56, -0.02, -0.44), leftHand: vector(0.16, -0.78, -0.84), rightHand: vector(0.56, -0.86, -0.06), magazine: vector(0.3, -0.76, -0.26), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.64, -0.36, -0.34), switchRaiseMs: 290, fireKick: vector(-0.004, 0.028, 0.07), recoil: { pitch: 1.0, yaw: 0.38, settleMs: 138 }, bob: { amplitude: 0.022, frequency: 7.4, sprintMultiplier: 1.46 }, muzzleFlashScale: 0.82 }),
  }),
  createModel({
    weaponId: 'scout',
    role: WEAPON_MODEL_ROLES.SNIPER,
    silhouette: 'slim bolt-action sniper rifle with black polymer stock and thin long barrel',
    worldParts: [
      { id: 'scout-receiver', shape: 'box', material: 'charcoal-polymer', size: vector(0.86, 0.18, 0.18), position: vector(0.04, 0.02, 0) },
      { id: 'thin-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.06, 0.06, 0.88), position: vector(0.78, 0.04, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'scout-scope', shape: 'cylinder', material: 'black-glass', size: vector(0.12, 0.12, 0.38), position: vector(0.12, 0.24, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'scout-stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.5, 0.24, 0.18), position: vector(-0.56, -0.02, 0) },
      { id: 'scout-magazine', shape: 'box', material: 'dark-bore', size: vector(0.12, 0.22, 0.14), position: vector(0.06, -0.22, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-scout-receiver', shape: 'box', material: 'charcoal-polymer', size: vector(1.0, 0.22, 0.22), position: vector(0.34, -0.22, 0.42) },
      { id: 'vm-thin-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.07, 0.07, 1.12), position: vector(1.2, -0.2, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-scout-scope', shape: 'cylinder', material: 'black-glass', size: vector(0.16, 0.16, 0.5), position: vector(0.54, 0.04, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-scout-stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.44, 0.26, 0.22), position: vector(-0.38, -0.26, 0.34) },
      { id: 'vm-stock-cheek', shape: 'box', material: 'charcoal-polymer', size: vector(0.32, 0.12, 0.16), position: vector(-0.34, -0.14, 0.34) },
      { id: 'vm-scout-magazine', shape: 'box', material: 'dark-bore', size: vector(0.14, 0.3, 0.18), position: vector(0.28, -0.52, 0.32) },
      { id: 'vm-bolt-handle', shape: 'box', material: 'dark-bore', size: vector(0.08, 0.14, 0.36), position: vector(0.52, -0.04, 0.42) },
    ],
    hooks: createHooks({ muzzle: vector(1.82, -0.2, 0.42), shellEject: vector(0.48, 0.0, 0.22), leftHand: vector(0.68, -0.52, 0.34), rightHand: vector(-0.02, -0.6, 0.1), magazine: vector(0.28, -0.56, 0.3), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.52, -0.48, -0.94), switchRaiseMs: 340, fireKick: vector(-0.01, 0.042, -0.11), recoil: { pitch: 2.4, yaw: 0.6, settleMs: 230 }, bob: { amplitude: 0.016, frequency: 6.0, sprintMultiplier: 1.38 }, muzzleFlashScale: 1.0 }),
  }),
  createModel({
    weaponId: 'g3sg1',
    role: WEAPON_MODEL_ROLES.SNIPER,
    silhouette: 'heavy battle rifle with wide receiver, scope, wide forend, and bipod',
    worldParts: [
      { id: 'g3-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(0.92, 0.24, 0.24), position: vector(0.04, 0.02, 0) },
      { id: 'g3-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.78), position: vector(0.8, 0.06, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'wide-forend', shape: 'box', material: 'warm-wood', size: vector(0.42, 0.2, 0.28), position: vector(0.44, -0.06, 0) },
      { id: 'g3-scope', shape: 'cylinder', material: 'black-glass', size: vector(0.16, 0.16, 0.42), position: vector(0.14, 0.28, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'g3-stock', shape: 'box', material: 'warm-wood', size: vector(0.48, 0.26, 0.24), position: vector(-0.56, -0.02, 0) },
      { id: 'g3-magazine', shape: 'box', material: 'dark-bore', size: vector(0.14, 0.34, 0.16), position: vector(0.02, -0.26, 0) },
    ],
    viewmodelParts: [
      { id: 'vm-g3-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(1.1, 0.28, 0.28), position: vector(0.34, -0.22, 0.42) },
      { id: 'vm-g3-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.1, 0.1, 1.02), position: vector(1.32, -0.18, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-wide-forend', shape: 'box', material: 'warm-wood', size: vector(0.52, 0.24, 0.34), position: vector(0.72, -0.44, 0.38) },
      { id: 'vm-g3-scope', shape: 'cylinder', material: 'black-glass', size: vector(0.2, 0.2, 0.56), position: vector(0.48, 0.06, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-g3-stock', shape: 'box', material: 'warm-wood', size: vector(0.46, 0.3, 0.26), position: vector(-0.48, -0.28, 0.34) },
      { id: 'vm-bipod', shape: 'box', material: 'dark-bore', size: vector(0.08, 0.18, 0.28), position: vector(0.72, -0.54, 0.38) },
      { id: 'vm-g3-magazine', shape: 'box', material: 'dark-bore', size: vector(0.16, 0.42, 0.2), position: vector(0.26, -0.58, 0.3) },
    ],
    hooks: createHooks({ muzzle: vector(1.88, -0.18, 0.42), shellEject: vector(0.52, 0.0, 0.2), leftHand: vector(0.7, -0.54, 0.34), rightHand: vector(-0.04, -0.62, 0.1), magazine: vector(0.26, -0.64, 0.28), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.54, -0.5, -0.96), switchRaiseMs: 380, fireKick: vector(-0.012, 0.044, -0.11), recoil: { pitch: 2.5, yaw: 0.7, settleMs: 250 }, bob: { amplitude: 0.014, frequency: 5.8, sprintMultiplier: 1.3 }, muzzleFlashScale: 1.1 }),
  }),
  createModel({
    weaponId: 'sg550',
    role: WEAPON_MODEL_ROLES.SNIPER,
    silhouette: 'sniper rifle with long receiver, integral bipod, scope, and curved magazine',
    worldParts: [
      { id: 'sg550-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(1.0, 0.22, 0.22), position: vector(0.04, 0.02, 0) },
      { id: 'sg550-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.08, 0.08, 0.72), position: vector(0.86, 0.06, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'sg550-forend', shape: 'box', material: 'charcoal-polymer', size: vector(0.5, 0.18, 0.26), position: vector(0.46, -0.04, 0) },
      { id: 'sg550-scope', shape: 'cylinder', material: 'black-glass', size: vector(0.14, 0.14, 0.4), position: vector(0.16, 0.26, 0), rotation: vector(0, 1.5708, 0) },
      { id: 'sg550-stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.46, 0.24, 0.2), position: vector(-0.6, -0.02, 0) },
      { id: 'sg550-magazine', shape: 'box', material: 'dark-bore', size: vector(0.14, 0.38, 0.16), position: vector(0.04, -0.28, 0), rotation: vector(0, 0, 0.14) },
    ],
    viewmodelParts: [
      { id: 'vm-sg550-receiver', shape: 'box', material: 'matte-gunmetal', size: vector(1.18, 0.26, 0.26), position: vector(0.34, -0.22, 0.42) },
      { id: 'vm-sg550-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.09, 0.09, 0.94), position: vector(1.3, -0.18, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-sg550-forend', shape: 'box', material: 'charcoal-polymer', size: vector(0.56, 0.2, 0.32), position: vector(0.76, -0.42, 0.38) },
      { id: 'vm-sg550-scope', shape: 'cylinder', material: 'black-glass', size: vector(0.18, 0.18, 0.52), position: vector(0.5, 0.06, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-sg550-stock', shape: 'box', material: 'charcoal-polymer', size: vector(0.44, 0.28, 0.24), position: vector(-0.48, -0.28, 0.34) },
      { id: 'vm-sg550-bipod', shape: 'box', material: 'dark-bore', size: vector(0.08, 0.16, 0.32), position: vector(0.76, -0.5, 0.38) },
      { id: 'vm-sg550-magazine', shape: 'box', material: 'dark-bore', size: vector(0.18, 0.48, 0.2), position: vector(0.28, -0.62, 0.3), rotation: vector(-0.16, 0, 0.06) },
    ],
    hooks: createHooks({ muzzle: vector(1.82, -0.18, 0.42), shellEject: vector(0.5, 0.0, 0.2), leftHand: vector(0.72, -0.52, 0.34), rightHand: vector(-0.02, -0.62, 0.1), magazine: vector(0.28, -0.68, 0.28), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.54, -0.5, -0.94), switchRaiseMs: 370, fireKick: vector(-0.01, 0.038, -0.1), recoil: { pitch: 2.2, yaw: 0.6, settleMs: 220 }, bob: { amplitude: 0.016, frequency: 6.0, sprintMultiplier: 1.35 }, muzzleFlashScale: 0.95 }),
  }),
]);

export const WEAPON_MODEL_REGISTRY = freezeDeep(Object.fromEntries(modelDefinitions.map((model) => [model.weaponId, model])));

const CATEGORY_MODEL_FALLBACKS = Object.freeze({
  [WEAPON_CATEGORIES.PISTOL]: 'glock18',
  [WEAPON_CATEGORIES.RIFLE]: 'ak47',
  [WEAPON_CATEGORIES.SNIPER]: 'awp',
  [WEAPON_CATEGORIES.SMG]: 'mp5',
  [WEAPON_CATEGORIES.SHOTGUN]: 'm3',
  [WEAPON_CATEGORIES.MACHINE_GUN]: 'm249',
});

export const FALLBACK_WEAPON_MODEL = freezeDeep({
  weaponId: 'unknown',
  weaponName: 'Unknown Weapon',
  category: WEAPON_CATEGORIES.EQUIPMENT,
  role: 'placeholder',
  originalAssetNote: 'Original generated safe placeholder primitive metadata.',
  silhouette: 'neutral block placeholder used when no model is registered',
  layers: Object.freeze({
    [WEAPON_MODEL_LAYERS.WORLD]: Object.freeze({
      kind: 'safe-placeholder-world-silhouette',
      parts: buildParts([
        { id: 'placeholder-body', shape: 'box', material: 'warning-matte-gray', size: vector(0.5, 0.18, 0.18), position: vector(0, 0, 0) },
        { id: 'placeholder-muzzle', shape: 'cylinder', material: 'warning-matte-gray', size: vector(0.08, 0.08, 0.2), position: vector(0.34, 0, 0), rotation: vector(0, 1.5708, 0) },
      ]),
    }),
    [WEAPON_MODEL_LAYERS.VIEWMODEL]: Object.freeze({
      kind: 'safe-placeholder-viewmodel-silhouette',
      parts: buildParts([
        { id: 'vm-placeholder-body', shape: 'box', material: 'warning-matte-gray', size: vector(0.66, 0.22, 0.22), position: vector(0.32, -0.24, 0.4) },
        { id: 'vm-placeholder-muzzle', shape: 'cylinder', material: 'warning-matte-gray', size: vector(0.1, 0.1, 0.3), position: vector(0.82, -0.24, 0.4), rotation: vector(0, 1.5708, 0) },
      ]),
    }),
  }),
  hooks: fallbackHooks,
  pose: fallbackPose,
  hud: Object.freeze({ label: 'Unknown Weapon', weaponId: 'unknown', role: 'placeholder' }),
});

export const getWeaponModel = (weaponId) => {
  const model = WEAPON_MODEL_REGISTRY[weaponId];

  if (model) {
    return Object.freeze({ ok: true, model, warning: null });
  }

  const weapon = getWeaponById(weaponId);
  const roleFallbackId = CATEGORY_MODEL_FALLBACKS[weapon?.category];
  const roleFallbackModel = WEAPON_MODEL_REGISTRY[roleFallbackId];
  if (weapon && roleFallbackModel) {
    return Object.freeze({
      ok: true,
      model: roleFallbackModel,
      warning: Object.freeze({
        code: 'weapon-model-role-fallback',
        weaponId: weapon.id,
        modelWeaponId: roleFallbackModel.weaponId,
        message: `Using ${roleFallbackModel.weaponName} role silhouette for ${weapon.name}.`,
      }),
    });
  }

  return Object.freeze({
    ok: false,
    model: FALLBACK_WEAPON_MODEL,
    warning: Object.freeze({
      code: 'weapon-model-missing',
      weaponId: String(weaponId ?? 'unknown'),
      message: `Missing weapon model for ${String(weaponId ?? 'unknown')}; using safe placeholder.`,
    }),
  });
};

export const buildWeaponLayerModel = (weaponId, layer = WEAPON_MODEL_LAYERS.WORLD) => {
  const result = getWeaponModel(weaponId);
  const selectedLayer = result.model.layers[layer] ?? result.model.layers[WEAPON_MODEL_LAYERS.WORLD];

  return freezeDeep({
    weaponId: result.model.weaponId,
    weaponName: result.model.weaponName,
    layer,
    kind: selectedLayer.kind,
    parts: selectedLayer.parts.map((entry) => ({ ...entry })),
    hooks: result.model.hooks,
    pose: result.model.pose,
    warning: result.warning,
  });
};

const rotateViewModelPoint = (point, alignment = VIEWMODEL_CAMERA_ALIGNMENT) => {
  const scaled = {
    x: point.x * alignment.scale,
    y: point.y * alignment.scale,
    z: point.z * alignment.scale,
  };
  const cosY = Math.cos(alignment.rotation.y);
  const sinY = Math.sin(alignment.rotation.y);

  return Object.freeze({
    x: Number((cosY * scaled.x + sinY * scaled.z).toFixed(6)),
    y: Number(scaled.y.toFixed(6)),
    z: Number((-sinY * scaled.x + cosY * scaled.z).toFixed(6)),
  });
};

export const summarizeViewModelCameraVisibility = (weaponId) => {
  const descriptor = buildWeaponLayerModel(weaponId, WEAPON_MODEL_LAYERS.VIEWMODEL);
  const pose = descriptor.pose.origin;
  const camera = VIEWMODEL_CAMERA_ALIGNMENT.camera;
  const orthographic = VIEWMODEL_CAMERA_ALIGNMENT.orthographic;
  const halfVertical = Math.tan((camera.fovDegrees * Math.PI / 180) / 2);
  const halfHorizontal = halfVertical * camera.aspect;
  const parts = descriptor.parts.map((entry) => {
    const rotated = rotateViewModelPoint(entry.position);
    const center = Object.freeze({
      x: Number((pose.x + rotated.x).toFixed(6)),
      y: Number((pose.y + rotated.y).toFixed(6)),
      z: Number((pose.z + rotated.z).toFixed(6)),
    });
    const depth = -center.z;
    const perspectiveVisible = depth > camera.near
      && Math.abs(center.x / depth) <= halfHorizontal
      && Math.abs(center.y / depth) <= halfVertical;
    const orthographicVisible = depth > camera.near
      && center.x >= orthographic.left
      && center.x <= orthographic.right
      && center.y >= orthographic.bottom
      && center.y <= orthographic.top;

    return Object.freeze({ id: entry.id, center, depth: Number(depth.toFixed(6)), visible: orthographicVisible, perspectiveVisible });
  });

  return freezeDeep({
    weaponId: descriptor.weaponId,
    requestedWeaponId: weaponId,
    alignment: VIEWMODEL_CAMERA_ALIGNMENT,
    visiblePartCount: parts.filter((entry) => entry.visible).length,
    parts,
  });
};

export const deriveWeaponSwitchMetadata = (weaponId) => {
  const result = getWeaponModel(weaponId);
  const weapon = getWeaponById(weaponId);

  return freezeDeep({
    weaponId: weapon?.id ?? result.model.weaponId,
    requestedWeaponId: weaponId,
    hud: Object.freeze({ ...result.model.hud, label: weapon?.name ?? result.model.hud.label, weaponId: weapon?.id ?? result.model.hud.weaponId }),
    viewmodel: Object.freeze({
      layer: buildWeaponLayerModel(weaponId, WEAPON_MODEL_LAYERS.VIEWMODEL),
      pose: result.model.pose,
      hooks: result.model.hooks,
    }),
    switch: result.model.pose.switch,
    pose: result.model.pose,
    firing: result.model.pose.firing,
    reload: Object.freeze({ path: result.model.hooks.reloadPath, magazineHook: result.model.hooks.magazine }),
    warning: result.warning,
  });
};

export const getWeaponHudLabel = (weaponId) => deriveWeaponSwitchMetadata(weaponId).hud.label;
