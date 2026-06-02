import * as THREE from 'three';

import { LOCAL_PLAYER_SLOT_INDEX } from '../config/index.js';
import { MAP_COLLISION_VOLUMES, MAP_GEOMETRY_PRIMITIVES, MAP_MATERIALS } from '../map/index.js';
import { buildMapRenderGeometry, mapToScenePosition } from './mapGeometry.js';
import { PLAYER_MODEL_IDS, buildPlayerModel } from './playerModels.js';
import { createRendererFallbackState, getSafeViewportSize, hasUsableWebGL } from './state.js';
import { VIEWMODEL_CAMERA_ALIGNMENT, WEAPON_MODEL_LAYERS, buildWeaponLayerModel } from './weaponModels.js';

export * from './state.js';
export * from './mapGeometry.js';
export * from './weaponModels.js';

const setVisible = (element, visible) => {
  element.hidden = !visible;
};

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
  return new THREE.MeshStandardMaterial({ color: '#d0ad73', map: texture, roughness: 0.96 });
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
  if (part.shape === 'cylinder' && Math.abs(part.rotation.y) > 1) {
    mesh.rotation.set(part.rotation.x, 0, Math.PI / 2 + part.rotation.z);
  }
  mesh.name = part.id;
  return mesh;
};

const createWeaponMaterialRegistry = (THREE) => Object.freeze({
  'matte-gunmetal': new THREE.MeshStandardMaterial({ color: '#20231f', metalness: 0.35, roughness: 0.58 }),
  'oiled-black-steel': new THREE.MeshStandardMaterial({ color: '#171915', metalness: 0.42, roughness: 0.48 }),
  'dark-bore': new THREE.MeshStandardMaterial({ color: '#080907', metalness: 0.55, roughness: 0.42 }),
  'charcoal-polymer': new THREE.MeshStandardMaterial({ color: '#1c211d', roughness: 0.74 }),
  'ribbed-black': new THREE.MeshStandardMaterial({ color: '#11140f', roughness: 0.86 }),
  'warm-wood': new THREE.MeshStandardMaterial({ color: '#9a5f2f', roughness: 0.7 }),
  'forest-polymer': new THREE.MeshStandardMaterial({ color: '#4f5a38', roughness: 0.76 }),
  'black-glass': new THREE.MeshStandardMaterial({ color: '#050706', metalness: 0.2, roughness: 0.22 }),
  'blued-steel': new THREE.MeshStandardMaterial({ color: '#202b31', metalness: 0.42, roughness: 0.52 }),
  'olive-steel': new THREE.MeshStandardMaterial({ color: '#4d5638', metalness: 0.32, roughness: 0.58 }),
  'perforated-black': new THREE.MeshStandardMaterial({ color: '#121611', metalness: 0.4, roughness: 0.62 }),
  'olive-canvas': new THREE.MeshStandardMaterial({ color: '#59603e', roughness: 0.9 }),
  'warning-matte-gray': new THREE.MeshStandardMaterial({ color: '#60605a', roughness: 0.82 }),
});

const buildViewModelGroup = (THREE, weaponId, materials) => {
  const descriptor = buildWeaponLayerModel(weaponId, WEAPON_MODEL_LAYERS.VIEWMODEL);
  const group = new THREE.Group();
  group.name = `viewmodel-${descriptor.weaponId}`;
  descriptor.parts.forEach((part) => {
    group.add(createPartMesh(THREE, part, materials));
  });

  const gloveMaterial = new THREE.MeshStandardMaterial({ color: '#26241d', roughness: 0.86 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: '#9b7557', roughness: 0.82 });
  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.24), skinMaterial);
  leftForearm.position.set(descriptor.hooks.hands.left.x, descriptor.hooks.hands.left.y - 0.16, descriptor.hooks.hands.left.z + 0.1);
  leftForearm.rotation.z = -0.08;
  const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.28), gloveMaterial);
  leftGlove.position.set(descriptor.hooks.hands.left.x, descriptor.hooks.hands.left.y, descriptor.hooks.hands.left.z);
  const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.22), skinMaterial);
  rightForearm.position.set(descriptor.hooks.hands.right.x - 0.12, descriptor.hooks.hands.right.y - 0.18, descriptor.hooks.hands.right.z + 0.14);
  rightForearm.rotation.z = 0.28;
  const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.26), gloveMaterial);
  rightGlove.position.set(descriptor.hooks.hands.right.x, descriptor.hooks.hands.right.y, descriptor.hooks.hands.right.z);
  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.18 * descriptor.pose.firing.muzzleFlash.scale, 0.58 * descriptor.pose.firing.muzzleFlash.scale, 14),
    new THREE.MeshBasicMaterial({ color: '#ffd45d', transparent: true, opacity: 0 }),
  );
  muzzleFlash.name = 'muzzleFlash';
  muzzleFlash.rotation.z = -Math.PI / 2;
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
  const wallMaterial = createWallMaterial(THREE, material.tint, '#f1d08a');
  wallMaterial.name = `map-material-${material.id}`;
  return [material.id, wallMaterial];
})));

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

const createPlayerWithWeapon = (THREE, modelId, position, scale = 1) => {
  const player = buildPlayerModel(THREE, modelId);
  player.position.set(position.x, position.y, position.z);
  player.scale.setScalar(scale);

  const weaponMaterial = new THREE.MeshStandardMaterial({ color: '#141514', metalness: 0.25, roughness: 0.62 });
  const weapon = new THREE.Group();
  const body = createBox(THREE, { x: 0.62, y: 0.12, z: 0.16 }, { x: 0.46, y: 1.18, z: 0.38 }, weaponMaterial);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.58, 10), weaponMaterial);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.86, 1.2, 0.38);
  weapon.add(body, barrel);
  player.add(weapon);

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
  const viewModelCamera = new THREE.OrthographicCamera(-1.6, 1.6, 0.9, -0.9, 0.01, 10);
  viewModelCamera.position.set(0, 0, 2.5);
  viewModelCamera.lookAt(0, 0, 0);

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
  const mapRenderGeometry = buildMapRenderGeometry({ collisionVolumes: MAP_COLLISION_VOLUMES, geometryPrimitives: MAP_GEOMETRY_PRIMITIVES });
  scene.add(createMapMesh(THREE, mapRenderGeometry.floor, mapMaterials));
  mapRenderGeometry.primitives.forEach((primitive) => {
    scene.add(createMapMesh(THREE, primitive, mapMaterials));
  });
  mapRenderGeometry.blockers.forEach((blocker) => {
    scene.add(createMapMesh(THREE, blocker, mapMaterials));
  });

  const players = Array.from({ length: 15 }, (_, index) => createPlayerWithWeapon(THREE, index % 2 === 0 ? PLAYER_MODEL_IDS.T_RAIDER : PLAYER_MODEL_IDS.CT_RANGER, { x: -2.25 + (index % 5) * 1.25, y: 0, z: -5.7 - Math.floor(index / 5) * 2.2 }, 0.72));
  players.forEach((player, index) => {
    player.rotation.y = index % 2 === 0 ? 0.08 : -0.12;
    scene.add(player);
  });

  const weaponMaterials = createWeaponMaterialRegistry(THREE);
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
      player.position.set(mapped.x, mapped.y, mapped.z);
      player.rotation.y = controller.view?.yaw ?? player.rotation.y;
      player.visible = slot.lifeState === 'alive';
    });

    if (matchState.lastLocalShot) {
      fireFeedbackUntil = performance.now() + 95;
    }
  };

  const triggerFireFeedback = () => {
    fireFeedbackUntil = performance.now() + 95;
  };

  const onResize = () => {
    const { width, height } = getSafeViewportSize(mount);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
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
    const moving = localController ? Math.hypot(localController.velocity.x, localController.velocity.z) > 0.05 : false;
    const bob = Math.sin(time * 0.008) * (moving ? 0.035 : 0.014);
    const pose = viewModel.userData.pose;
    const firing = time < fireFeedbackUntil;
    const recoil = firing ? pose.firing.kickOffset.z : 0;
    viewModel.position.set(pose.origin.x, pose.origin.y + bob, pose.origin.z + recoil);
    const muzzleFlash = viewModel.getObjectByName('muzzleFlash');
    if (muzzleFlash) muzzleFlash.material.opacity = firing ? 0.86 : 0;
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
