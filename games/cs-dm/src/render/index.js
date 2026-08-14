import * as THREE from 'three';

import { LOCAL_PLAYER_SLOT_INDEX } from '../config/index.js';
import { MAP_COLLISION_VOLUMES, MAP_GEOMETRY_PRIMITIVES, MAP_MATERIALS } from '../map/index.js';
import { buildMapRenderGeometry, mapToScenePosition } from './mapGeometry.js';
import { PLAYER_MODEL_IDS, buildPlayerModel } from './playerModels.js';
import { createRendererFallbackState, getSafeViewportSize, hasUsableWebGL } from './state.js';
import { VIEWMODEL_CAMERA_ALIGNMENT, WEAPON_MODEL_LAYERS, WEAPON_MODEL_REGISTRY, buildWeaponLayerModel } from './weaponModels.js';

export * from './state.js';
export * from './mapGeometry.js';
export * from './weaponModels.js';

const setVisible = (element, visible) => {
  element.hidden = !visible;
};

const segmentIntersectsRect = (from, to, rect) => {
  const minX = rect.center.x - rect.size.width / 2;
  const maxX = rect.center.x + rect.size.width / 2;
  const minZ = rect.center.z - rect.size.depth / 2;
  const maxZ = rect.center.z + rect.size.depth / 2;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let tMin = 0;
  let tMax = 1;
  for (const [origin, delta, min, max] of [[from.x, dx, minX, maxX], [from.z, dz, minZ, maxZ]]) {
    if (Math.abs(delta) < 1e-8) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const near = (min - origin) / delta;
    const far = (max - origin) / delta;
    const entry = Math.min(near, far);
    const exit = Math.max(near, far);
    tMin = Math.max(tMin, entry);
    tMax = Math.min(tMax, exit);
    if (tMin > tMax) return false;
  }
  return tMax > 0.015 && tMin < 0.985;
};

const isOpponentOccluded = (from, to) => MAP_COLLISION_VOLUMES.some((volume) => segmentIntersectsRect(from, to, volume));

const createWallMaterial = (THREE, baseColor, accentColor) => {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.fillStyle = baseColor;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 12) {
    for (let x = 0; x < canvas.width; x += 16) {
      context.fillStyle = (x + y) % 32 === 0 ? accentColor : 'rgba(255, 244, 205, 0.08)';
      context.fillRect(x + 1, y + 1, 14, 10);
      context.fillStyle = 'rgba(38, 28, 16, 0.16)';
      context.fillRect(x, y + 10, 16, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ color: baseColor, map: texture, roughness: 0.96 });
};

const createBox = (THREE, size, position, material) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.set(position.x, position.y, position.z);
  return mesh;
};

const createPartMesh = (THREE, part, materials) => {
  const material = materials[part.material] ?? materials['matte-gunmetal'];
  const mesh = part.shape === 'cylinder'
    ? new THREE.Mesh(new THREE.CylinderGeometry(part.size.x / 2, part.size.y / 2, part.size.z, 12), material)
    : new THREE.Mesh(new THREE.BoxGeometry(part.size.x, part.size.y, part.size.z), material);
  mesh.position.set(part.position.x, part.position.y, part.position.z);
  mesh.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z);
  mesh.name = part.id;
  return mesh;
};

const createWeaponMaterialRegistry = (THREE) => Object.freeze({
  'matte-gunmetal': new THREE.MeshStandardMaterial({ color: '#20231f', metalness: 0.35, roughness: 0.58 }),
  'oiled-black-steel': new THREE.MeshStandardMaterial({ color: '#2a2a22', metalness: 0.42, roughness: 0.48 }),
  'dark-bore': new THREE.MeshStandardMaterial({ color: '#080907', metalness: 0.55, roughness: 0.42 }),
  'charcoal-polymer': new THREE.MeshStandardMaterial({ color: '#1c211d', roughness: 0.74 }),
  'ribbed-black': new THREE.MeshStandardMaterial({ color: '#11140f', roughness: 0.86 }),
  'warm-wood': new THREE.MeshStandardMaterial({ color: '#b4763a', roughness: 0.72 }),
  'forest-polymer': new THREE.MeshStandardMaterial({ color: '#4f5a38', roughness: 0.76 }),
  'black-glass': new THREE.MeshStandardMaterial({ color: '#050706', metalness: 0.2, roughness: 0.22 }),
  'blued-steel': new THREE.MeshStandardMaterial({ color: '#202b31', metalness: 0.42, roughness: 0.52 }),
  'olive-steel': new THREE.MeshStandardMaterial({ color: '#4d5638', metalness: 0.32, roughness: 0.58 }),
  'perforated-black': new THREE.MeshStandardMaterial({ color: '#121611', metalness: 0.4, roughness: 0.62 }),
  'olive-canvas': new THREE.MeshStandardMaterial({ color: '#59603e', roughness: 0.9 }),
  'warning-matte-gray': new THREE.MeshStandardMaterial({ color: '#60605a', roughness: 0.82 }),
  'sandstone-trim': new THREE.MeshStandardMaterial({ color: '#e0bc78', roughness: 0.94 }),
});

const createPartOutline = (THREE, part) => {
  const outline = new THREE.Mesh(new THREE.BoxGeometry(part.size.x * 1.025, part.size.y * 1.025, part.size.z * 1.025), new THREE.MeshBasicMaterial({ color: '#050403', transparent: true, opacity: 0.16 }));
  outline.position.set(part.position.x, part.position.y, part.position.z);
  outline.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z);
  outline.name = `${part.id}-shadow-outline`;
  return outline;
};

const buildViewModelGroup = (THREE, weaponId, materials) => {
  const descriptor = buildWeaponLayerModel(weaponId, WEAPON_MODEL_LAYERS.VIEWMODEL);
  const group = new THREE.Group();
  group.name = `viewmodel-${descriptor.weaponId}`;
  descriptor.parts.forEach((part) => {
    group.add(createPartMesh(THREE, part, materials));
    if (part.shape === 'box' && part.id.includes('vm-')) {
      group.add(createPartOutline(THREE, part));
    }
  });

  const gloveMaterial = new THREE.MeshStandardMaterial({ color: '#1d1b15', roughness: 0.86 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: '#8b6449', roughness: 0.82 });
  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.16), skinMaterial);
  leftForearm.position.set(descriptor.hooks.hands.left.x, descriptor.hooks.hands.left.y - 0.22, descriptor.hooks.hands.left.z + 0.18);
  leftForearm.rotation.z = -0.08;
  const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), gloveMaterial);
  leftGlove.position.set(descriptor.hooks.hands.left.x, descriptor.hooks.hands.left.y, descriptor.hooks.hands.left.z);
  const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.16), skinMaterial);
  rightForearm.position.set(descriptor.hooks.hands.right.x - 0.06, descriptor.hooks.hands.right.y - 0.24, descriptor.hooks.hands.right.z + 0.22);
  rightForearm.rotation.z = 0.28;
  const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), gloveMaterial);
  rightGlove.position.set(descriptor.hooks.hands.right.x, descriptor.hooks.hands.right.y, descriptor.hooks.hands.right.z);
  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.18 * descriptor.pose.firing.muzzleFlash.scale, 0.58 * descriptor.pose.firing.muzzleFlash.scale, 14),
    new THREE.MeshBasicMaterial({ color: '#ffd45d', transparent: true, opacity: 0 }),
  );
  muzzleFlash.name = 'muzzleFlash';
  muzzleFlash.rotation.x = -Math.PI / 2;
  muzzleFlash.position.set(descriptor.hooks.muzzle.x, descriptor.hooks.muzzle.y, descriptor.hooks.muzzle.z);
  group.add(muzzleFlash, leftForearm, leftGlove, rightForearm, rightGlove);
  group.traverse((child) => {
    if (!child.material) return;
    child.renderOrder = 20;
    child.material.depthTest = false;
    child.material.depthWrite = false;
  });
  group.position.set(descriptor.pose.origin.x, descriptor.pose.origin.y, descriptor.pose.origin.z);
  group.rotation.set(VIEWMODEL_CAMERA_ALIGNMENT.rotation.x, VIEWMODEL_CAMERA_ALIGNMENT.rotation.y, VIEWMODEL_CAMERA_ALIGNMENT.rotation.z);
  group.scale.setScalar(VIEWMODEL_CAMERA_ALIGNMENT.scale);
  group.userData = Object.freeze({ weaponId: descriptor.weaponId, pose: descriptor.pose, cameraAlignment: VIEWMODEL_CAMERA_ALIGNMENT });
  return group;
};

const createMapMaterialRegistry = (THREE) => Object.freeze(Object.fromEntries(Object.values(MAP_MATERIALS).map((material) => {
  const accentColor = material.id === MAP_MATERIALS.METAL.id ? '#b7c0bd'
    : material.id === MAP_MATERIALS.WOOD.id ? '#d18a45'
      : material.id === MAP_MATERIALS.SITE_PAINT.id ? '#f6d768'
        : '#f1d08a';
  const wallMaterial = createWallMaterial(THREE, material.tint, accentColor);
  wallMaterial.name = `map-material-${material.id}`;
  return [material.id, wallMaterial];
})));

const addMapAccentGeometry = (THREE, scene, descriptor, materials) => {
  if (!['doorway', 'cover', 'site-marking', 'ledge', 'ramp'].includes(descriptor.kind)) return;

  const trimMaterial = descriptor.kind === 'site-marking'
    ? materials[MAP_MATERIALS.SITE_PAINT.id]
    : new THREE.MeshStandardMaterial({ color: descriptor.visualRole === 'crates' ? '#3d2515' : '#f0cf8b', roughness: 0.88 });
  const accentHeight = descriptor.kind === 'site-marking' ? 0.045 : Math.max(0.04, descriptor.size.y * 0.12);
  const accentSize = descriptor.kind === 'cover'
    ? { x: descriptor.size.x * 0.9, y: accentHeight, z: descriptor.size.z * 0.12 }
    : { x: descriptor.size.x, y: accentHeight, z: Math.max(0.04, descriptor.size.z * 0.16) };
  const accent = createBox(THREE, accentSize, { x: descriptor.position.x, y: descriptor.position.y + descriptor.size.y / 2 + accentHeight / 2, z: descriptor.position.z }, trimMaterial);
  accent.name = `map-${descriptor.id}-accent`;
  scene.add(accent);

  if (descriptor.kind === 'doorway') {
    const panelMaterial = materials[MAP_MATERIALS.METAL.id];
    const panelSize = { x: Math.max(0.06, descriptor.size.x * 0.38), y: Math.max(0.35, descriptor.size.y * 0.72), z: Math.max(0.04, descriptor.size.z * 0.08) };
    [-0.22, 0.22].forEach((offset, index) => {
      const panel = createBox(THREE, panelSize, { x: descriptor.position.x + descriptor.size.x * offset, y: descriptor.position.y + descriptor.size.y * 0.42, z: descriptor.position.z + descriptor.size.z * 0.51 }, panelMaterial);
      panel.name = `map-${descriptor.id}-door-panel-${index}`;
      scene.add(panel);
    });
  }

  if (descriptor.kind === 'cover') {
    const sideMaterial = materials[MAP_MATERIALS.WOOD.id];
    const side = createBox(THREE, { x: Math.max(0.04, descriptor.size.x * 0.08), y: descriptor.size.y * 0.82, z: descriptor.size.z * 0.92 }, { x: descriptor.position.x - descriptor.size.x * 0.42, y: descriptor.position.y, z: descriptor.position.z }, sideMaterial);
    side.name = `map-${descriptor.id}-crate-side`;
    scene.add(side);
  }
};

const createMapMesh = (THREE, descriptor, materials) => {
  const material = materials[descriptor.materialId] ?? materials[MAP_MATERIALS.CONCRETE.id];
  const mesh = createBox(THREE, descriptor.size, descriptor.position, material);
  mesh.name = `map-${descriptor.id}`;
  mesh.userData = Object.freeze({
    mapSource: descriptor.kind === 'blocking-box' ? 'MAP_COLLISION_VOLUMES' : 'MAP_GEOMETRY_PRIMITIVES',
    mapId: descriptor.id,
    mapCenter: descriptor.mapCenter,
  });
  return mesh;
};

const buildWorldWeaponGroup = (THREE, weaponId, materials) => {
  const descriptor = buildWeaponLayerModel(weaponId, WEAPON_MODEL_LAYERS.WORLD);
  const weapon = new THREE.Group();
  weapon.name = `world-weapon-${descriptor.weaponId}`;
  descriptor.parts.forEach((part) => {
    weapon.add(createPartMesh(THREE, part, materials));
  });
  weapon.scale.setScalar(0.46);
  weapon.rotation.y = -Math.PI / 2;
  weapon.position.set(0.34, 1.08, 0.28);
  weapon.traverse((child) => {
    if (!child.material) return;
    child.renderOrder = 0;
    child.material.depthTest = true;
    child.material.depthWrite = true;
  });
  weapon.userData = Object.freeze({ weaponId: descriptor.weaponId, source: 'WEAPON_MODEL_LAYERS.WORLD', depthMode: 'world-occluded' });
  return weapon;
};

const createPlayerWithWeapon = (THREE, modelId, weaponId, position, scale = 1, weaponMaterials) => {
  const player = buildPlayerModel(THREE, modelId);
  player.position.set(position.x, position.y, position.z);
  player.scale.setScalar(scale);
  player.add(buildWorldWeaponGroup(THREE, weaponId, weaponMaterials));
  player.traverse((child) => {
    if (!child.material) return;
    child.renderOrder = 0;
    child.material.depthTest = true;
    child.material.depthWrite = true;
  });

  return player;
};

export function createRendererShell({ mount, pointerLockHelp, webglError }) {
  if (!hasUsableWebGL(window)) {
    setVisible(webglError, true);
    const fallbackState = createRendererFallbackState({ mount });
    return {
      state: fallbackState,
      requestPointerLock() {},
      resize: () => fallbackState,
      updateMatchState() {},
      triggerFireFeedback() {},
      destroy() {},
    };
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#6f91ad');
  scene.fog = new THREE.Fog('#8f7d59', 20, 72);

  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 120);
  camera.position.set(0, 1.65, 7.5);
  const viewModelScene = new THREE.Scene();
  const viewModelCamera = new THREE.PerspectiveCamera(VIEWMODEL_CAMERA_ALIGNMENT.camera.fovDegrees, 16 / 9, 0.01, 10);
  viewModelCamera.position.set(0, 0, 0);
  viewModelCamera.lookAt(0, 0, -1);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  const viewModelRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  viewModelRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1, false);
  viewModelRenderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1, false);
  renderer.domElement.className = 'match-stage__world-canvas';
  viewModelRenderer.domElement.className = 'match-stage__viewmodel-canvas';
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  viewModelRenderer.domElement.style.position = 'absolute';
  viewModelRenderer.domElement.style.inset = '0';
  viewModelRenderer.domElement.style.pointerEvents = 'none';
  viewModelRenderer.domElement.setAttribute('aria-hidden', 'true');

  mount.replaceChildren(renderer.domElement, viewModelRenderer.domElement);

  const mapMaterials = createMapMaterialRegistry(THREE);
  const weaponMaterials = createWeaponMaterialRegistry(THREE);
  const mapRenderGeometry = buildMapRenderGeometry({ collisionVolumes: MAP_COLLISION_VOLUMES, geometryPrimitives: MAP_GEOMETRY_PRIMITIVES });
  scene.add(createMapMesh(THREE, mapRenderGeometry.floor, mapMaterials));
  mapRenderGeometry.primitives.forEach((primitive) => {
    scene.add(createMapMesh(THREE, primitive, mapMaterials));
    addMapAccentGeometry(THREE, scene, primitive, mapMaterials);
  });
  mapRenderGeometry.blockers.forEach((blocker) => {
    scene.add(createMapMesh(THREE, blocker, mapMaterials));
  });

  const players = Array.from({ length: 15 }, (_, index) => createPlayerWithWeapon(
    THREE,
    index % 2 === 0 ? PLAYER_MODEL_IDS.T_RAIDER : PLAYER_MODEL_IDS.CT_RANGER,
    index % 3 === 0 ? 'glock18' : 'ak47',
    { x: -2.25 + (index % 5) * 1.25, y: 0, z: -5.7 - Math.floor(index / 5) * 2.2 },
    0.9,
    weaponMaterials,
  ));
  players.forEach((player, index) => {
    player.rotation.y = index % 2 === 0 ? 0.08 : -0.12;
    player.traverse((child) => {
      if (child.material?.color && index % 2 === 0) {
        child.material.emissive = new THREE.Color('#2a1208');
        child.material.emissiveIntensity = 0.08;
      } else if (child.material?.color) {
        child.material.emissive = new THREE.Color('#061a24');
        child.material.emissiveIntensity = 0.1;
      }
    });
    scene.add(player);
  });

  let viewModel = buildViewModelGroup(THREE, 'ak47', weaponMaterials);
  viewModelScene.add(viewModel);
  scene.add(camera);

  viewModelScene.add(new THREE.HemisphereLight('#fff4dc', '#2a241d', 1.4));
  const viewModelKeyLight = new THREE.DirectionalLight('#ffe0a8', 1.7);
  viewModelKeyLight.position.set(1.6, 2.2, 2.4);
  viewModelScene.add(viewModelKeyLight);

  scene.add(new THREE.HemisphereLight('#dbe9ff', '#7a5a32', 1.05));
  scene.add(new THREE.AmbientLight('#fff0cf', 0.64));

  const sun = new THREE.DirectionalLight('#ffd9b0', 1.4);
  sun.position.set(4, 8, 3);
  sun.castShadow = false;
  scene.add(sun);

  let latestMatchState = null;
  let fireFeedbackUntil = 0;
  let activeViewModelWeaponId = 'ak47';
  let reloadAnimStartMs = 0;
  let wasReloading = false;

  const updateMatchState = (matchState) => {
    latestMatchState = matchState;
    const localController = matchState.controllersBySlotIndex?.[LOCAL_PLAYER_SLOT_INDEX];
    const activeWeaponId = matchState.matchState?.players?.[LOCAL_PLAYER_SLOT_INDEX]?.loadout?.activeWeaponId ?? localController?.activeWeaponId ?? 'ak47';
    if (activeWeaponId !== activeViewModelWeaponId) {
      viewModelScene.remove(viewModel);
      viewModel = buildViewModelGroup(THREE, activeWeaponId, weaponMaterials);
      viewModelScene.add(viewModel);
      activeViewModelWeaponId = activeWeaponId;
    }
    if (localController) {
      const mapped = mapToScenePosition(localController.position);
      camera.position.set(mapped.x, 1.62 + mapped.y, mapped.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = localController.view?.yaw ?? 0;
      camera.rotation.x = localController.view?.pitch ?? 0;
    }

    players.forEach((player, index) => {
      const slotIndex = index + 1;
      const controller = matchState.controllersBySlotIndex?.[slotIndex];
      const slot = matchState.matchState?.players?.[slotIndex];
      if (!controller || !slot) return;
      const mapped = mapToScenePosition(controller.position);
      const localPosition = localController?.position;
      const occluded = localPosition && Math.hypot(localPosition.x - controller.position.x, localPosition.z - controller.position.z) > 2
        ? isOpponentOccluded(localPosition, controller.position)
        : false;
      const feedback = matchState.visualFeedbackBySlotIndex?.[slotIndex];
      const deathFlash = Number.isFinite(feedback?.recentDeathAtMs)
        ? matchState.nowMs - feedback.recentDeathAtMs
        : Number.POSITIVE_INFINITY;
      const feedbackAgeMs = Number.isFinite(feedback?.recentDamageAtMs) && !Number.isFinite(feedback?.recentDeathAtMs)
        ? matchState.nowMs - feedback.recentDamageAtMs
        : deathFlash;
      const feedbackActive = feedbackAgeMs >= 0 && feedbackAgeMs < 220;
      const deathAnimActive = deathFlash >= 0 && deathFlash < 350;
      player.position.set(mapped.x, mapped.y, mapped.z);
      player.rotation.y = controller.view?.yaw ?? player.rotation.y;
      player.visible = (slot.lifeState === 'alive' || deathAnimActive) && !occluded;
      player.scale.setScalar(feedbackActive ? 1 : 0.9);
    });

    if (matchState.lastLocalShot) {
      fireFeedbackUntil = performance.now() + 160;
    }
  };

  const triggerFireFeedback = () => {
    fireFeedbackUntil = performance.now() + 160;
  };

  const onResize = () => {
    const { width, height } = getSafeViewportSize(mount);
    camera.aspect = width / height;
    viewModelCamera.aspect = width / height;
    camera.updateProjectionMatrix();
    viewModelCamera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    viewModelRenderer.setSize(width, height, false);
    return Object.freeze({ ok: true, width, height, aspect: camera.aspect });
  };

  const onPointerLockChange = () => {
    setVisible(pointerLockHelp, document.pointerLockElement !== renderer.domElement);
  };

  const onPointerLockError = () => {
    setVisible(pointerLockHelp, true);
  };

  const requestPointerLock = () => {
    try {
      const result = renderer.domElement.requestPointerLock();
      if (result && typeof result.catch === 'function') {
        result.catch(() => setVisible(pointerLockHelp, true));
      }
    } catch {
      setVisible(pointerLockHelp, true);
    }
  };

  renderer.domElement.addEventListener('click', requestPointerLock);
  window.addEventListener('resize', onResize);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);

  let animationFrame = window.requestAnimationFrame(function tick(time) {
    const localController = latestMatchState?.controllersBySlotIndex?.[LOCAL_PLAYER_SLOT_INDEX];
    const localWeaponState = latestMatchState?.weaponStatesBySlotIndex?.[LOCAL_PLAYER_SLOT_INDEX];
    const speed = localController ? Math.hypot(localController.velocity.x, localController.velocity.z) : 0;
    const moving = speed > 0.05;
    const pose = viewModel.userData.pose;
    const firing = time < fireFeedbackUntil;

    // ---- Walking / Idle Bob ----
    const bobFreq = moving ? 0.008 + speed * 0.004 : 0.0035;
    const bobAmp = moving ? Math.min(0.035 + speed * 0.025, 0.07) : 0.005;
    const bob = Math.sin(time * bobFreq) * bobAmp;
    const bobStrafe = Math.sin(time * bobFreq * 0.67) * bobAmp * 0.4;

    // ---- Reload Animation ----
    let reloadOffset = { x: 0, y: 0, z: 0 };
    const weaponModelData = WEAPON_MODEL_REGISTRY[activeViewModelWeaponId];
    const reloadPath = weaponModelData?.hooks?.reloadPath;
    if (localWeaponState?.isReloading) {
      if (!wasReloading) {
        reloadAnimStartMs = latestMatchState.nowMs;
      }
      wasReloading = true;

      if (reloadPath && reloadPath.length > 0) {
        const totalPathMs = reloadPath.reduce((sum, step) => sum + step.durationMs, 0);
        const elapsed = Math.min(latestMatchState.nowMs - reloadAnimStartMs, totalPathMs);
        let cumulativeMs = 0;
        for (let i = 0; i < reloadPath.length; i++) {
          const step = reloadPath[i];
          if (elapsed <= cumulativeMs + step.durationMs) {
            const t = step.durationMs > 0 ? (elapsed - cumulativeMs) / step.durationMs : 1;
            const prevOffset = i > 0 ? reloadPath[i - 1].offset : { x: 0, y: 0, z: 0 };
            reloadOffset = {
              x: prevOffset.x + (step.offset.x - prevOffset.x) * t,
              y: prevOffset.y + (step.offset.y - prevOffset.y) * t,
              z: prevOffset.z + (step.offset.z - prevOffset.z) * t,
            };
            break;
          }
          cumulativeMs += step.durationMs;
        }
        if (elapsed >= totalPathMs) {
          reloadOffset = { ...reloadPath[reloadPath.length - 1].offset };
        }
      }
    } else {
      wasReloading = false;
    }

    // ---- Fire Recoil ----
    const kickX = firing ? pose.firing.kickOffset.x : 0;
    const kickY = firing ? pose.firing.kickOffset.y : 0;
    const kickZ = firing ? pose.firing.kickOffset.z : 0;

    viewModel.position.set(
      pose.origin.x + kickX + reloadOffset.x + bobStrafe,
      pose.origin.y + bob + kickY + reloadOffset.y,
      pose.origin.z + kickZ + reloadOffset.z,
    );

    // Fire recoil rotation — kick on fire, smooth settle
    if (firing) {
      viewModel.rotation.x = VIEWMODEL_CAMERA_ALIGNMENT.rotation.x - 0.018;
      viewModel.rotation.z = VIEWMODEL_CAMERA_ALIGNMENT.rotation.z + 0.006;
    } else {
      viewModel.rotation.x += (VIEWMODEL_CAMERA_ALIGNMENT.rotation.x - viewModel.rotation.x) * 0.1;
      viewModel.rotation.z += (VIEWMODEL_CAMERA_ALIGNMENT.rotation.z - viewModel.rotation.z) * 0.1;
    }

    // Muzzle flash
    const muzzleFlash = viewModel.getObjectByName('muzzleFlash');
    if (muzzleFlash) muzzleFlash.material.opacity = firing ? 0.86 : 0;

    // ---- Player Model Animation ----
    players.forEach((player, index) => {
      if (!player.visible) return;
      const slotIndex = index + 1;
      const slot = latestMatchState?.matchState?.players?.[slotIndex];
      const controller = latestMatchState?.controllersBySlotIndex?.[slotIndex];
      if (!slot || !controller) return;

      const pSpeed = Math.hypot(controller.velocity.x, controller.velocity.z);
      const pMoving = pSpeed > 0.05;

      // Death tilt — briefly rotate model on death
      const feedback = latestMatchState?.visualFeedbackBySlotIndex?.[slotIndex];
      const deathAgeMs = Number.isFinite(feedback?.recentDeathAtMs)
        ? latestMatchState.nowMs - feedback.recentDeathAtMs
        : Number.POSITIVE_INFINITY;
      const dying = deathAgeMs >= 0 && deathAgeMs < 350;

      if (dying) {
        // Tilt backward and slightly roll
        player.rotation.x = -0.35 + deathAgeMs * 0.001;
      } else if (slot.lifeState === 'alive') {
        // Smoothly return to upright when alive
        player.rotation.x += (0 - player.rotation.x) * 0.05;

        // Idle sway (gentle breathing bounce)
        const idleBob = Math.sin(time * 0.003 + index * 2.1) * 0.005;

        // Walk bob — synced to movement speed
        const walkBob = pMoving ? Math.sin(time * 0.01 + index * 0.9) * 0.028 : 0;
        const walkSway = pMoving ? Math.sin(time * 0.007 + index * 1.3) * 0.012 : 0;

        player.position.y += idleBob + walkBob;
        player.position.x += walkSway;
      }
    });

    renderer.render(scene, camera);
    viewModelRenderer.clear();
    viewModelRenderer.render(viewModelScene, viewModelCamera);
    animationFrame = window.requestAnimationFrame(tick);
  });

  onResize();

  return {
    state: Object.freeze({ ok: true, reason: 'webgl-ready', viewport: getSafeViewportSize(mount), recoverable: true }),
    requestPointerLock,
    resize: onResize,
    updateMatchState,
    triggerFireFeedback,
    destroy() {
      window.cancelAnimationFrame(animationFrame);
      renderer.domElement.removeEventListener('click', requestPointerLock);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      renderer.dispose();
      viewModelRenderer.dispose();
    },
  };
}
