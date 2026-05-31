import { WEAPON_CATEGORIES, getWeaponById } from '../weapons/index.js';

export const WEAPON_MODEL_ROLES = Object.freeze({
  PISTOL: 'pistol',
  RIFLE: 'rifle',
  SNIPER: 'sniper',
  SMG: 'smg',
  SHOTGUN: 'shotgun',
  MACHINE_GUN: 'machine-gun',
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
  muzzle: vector(0, 0.06, 0.52),
  shellEject: vector(0.12, 0.08, 0.1),
  leftHand: vector(-0.12, -0.16, 0.1),
  rightHand: vector(0.14, -0.18, -0.12),
  magazine: vector(0, -0.1, -0.02),
  reloadPath: sharedReloadPath,
});

const fallbackPose = createPose({
  origin: vector(0.42, -0.38, -0.74),
  switchRaiseMs: 220,
  fireKick: vector(0, 0.02, -0.05),
  recoil: { pitch: 0.6, yaw: 0.2, settleMs: 120 },
  bob: { amplitude: 0.018, frequency: 7.5, sprintMultiplier: 1.4 },
  muzzleFlashScale: 0.7,
});

const modelDefinitions = Object.freeze([
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
      { id: 'vm-slide', shape: 'box', material: 'matte-gunmetal', size: vector(0.78, 0.22, 0.24), position: vector(0.28, -0.12, 0.46) },
      { id: 'vm-frame', shape: 'box', material: 'charcoal-polymer', size: vector(0.62, 0.16, 0.18), position: vector(0.16, -0.3, 0.36) },
      { id: 'vm-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.14, 0.14, 0.32), position: vector(0.74, -0.12, 0.46), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-grip', shape: 'box', material: 'ribbed-black', size: vector(0.22, 0.48, 0.2), position: vector(-0.04, -0.56, 0.22), rotation: vector(0, 0, -0.16) },
    ],
    hooks: createHooks({ muzzle: vector(0.92, -0.12, 0.46), shellEject: vector(0.46, 0, 0.32), leftHand: vector(-0.18, -0.56, 0.18), rightHand: vector(0.1, -0.62, 0.08), magazine: vector(-0.02, -0.62, 0.18), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.34, -0.42, -0.68), switchRaiseMs: 180, fireKick: vector(0, 0.018, -0.044), recoil: { pitch: 0.75, yaw: 0.24, settleMs: 105 }, bob: { amplitude: 0.018, frequency: 8.5, sprintMultiplier: 1.35 }, muzzleFlashScale: 0.58 }),
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
      { id: 'vm-receiver', shape: 'box', material: 'oiled-black-steel', size: vector(1.02, 0.24, 0.26), position: vector(0.34, -0.2, 0.42) },
      { id: 'vm-barrel', shape: 'cylinder', material: 'dark-bore', size: vector(0.1, 0.1, 0.92), position: vector(1.18, -0.18, 0.42), rotation: vector(0, 1.5708, 0) },
      { id: 'vm-handguard', shape: 'box', material: 'warm-wood', size: vector(0.56, 0.2, 0.3), position: vector(0.78, -0.24, 0.42) },
      { id: 'vm-stock-tail', shape: 'box', material: 'warm-wood', size: vector(0.36, 0.2, 0.24), position: vector(-0.34, -0.2, 0.38), rotation: vector(0, 0, -0.08) },
      { id: 'vm-curved-magazine', shape: 'box', material: 'oiled-black-steel', size: vector(0.2, 0.62, 0.22), position: vector(0.26, -0.66, 0.3), rotation: vector(0, 0, 0.22) },
    ],
    hooks: createHooks({ muzzle: vector(1.68, -0.18, 0.42), shellEject: vector(0.48, -0.02, 0.22), leftHand: vector(0.72, -0.52, 0.36), rightHand: vector(0.02, -0.58, 0.12), magazine: vector(0.26, -0.74, 0.24), reloadPath: sharedReloadPath }),
    pose: createPose({ origin: vector(0.52, -0.46, -0.88), switchRaiseMs: 270, fireKick: vector(-0.006, 0.032, -0.082), recoil: { pitch: 1.25, yaw: 0.42, settleMs: 155 }, bob: { amplitude: 0.024, frequency: 7.2, sprintMultiplier: 1.5 }, muzzleFlashScale: 0.92 }),
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
]);

export const WEAPON_MODEL_REGISTRY = freezeDeep(Object.fromEntries(modelDefinitions.map((model) => [model.weaponId, model])));

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

export const deriveWeaponSwitchMetadata = (weaponId) => {
  const result = getWeaponModel(weaponId);

  return freezeDeep({
    weaponId: result.model.weaponId,
    requestedWeaponId: weaponId,
    hud: result.model.hud,
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
