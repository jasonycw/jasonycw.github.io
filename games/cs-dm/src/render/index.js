import * as THREE from 'three';

import { PLAYER_MODEL_IDS, buildPlayerModel } from './playerModels.js';
import { createRendererFallbackState, getSafeViewportSize, hasUsableWebGL } from './state.js';

export * from './state.js';
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
      destroy() {},
    };
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#6f91ad');
  scene.fog = new THREE.Fog('#8f7d59', 20, 72);

  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 120);
  camera.position.set(0, 1.65, 7.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1, false);

  mount.replaceChildren(renderer.domElement);

  const sandstoneMaterial = createWallMaterial(THREE, '#b99058', '#d2b77d');
  const shadowStoneMaterial = createWallMaterial(THREE, '#8a6a3e', '#aa8753');
  const floorMaterial = createWallMaterial(THREE, '#8b7650', '#ad9362');
  floorMaterial.map.repeat.set(9, 7);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(54, 42), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(54, 8),
    new THREE.MeshStandardMaterial({ color: '#5b5342', roughness: 1 }),
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.y = 0.01;
  scene.add(lane);

  const crateMaterial = new THREE.MeshStandardMaterial({ color: '#8a5f35', roughness: 0.95 });
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    crateMaterial,
  );
  crate.position.set(-1.8, 0.7, -3.4);
  scene.add(crate);

  const farCrate = crate.clone();
  farCrate.position.set(3.2, 0.7, -9);
  farCrate.scale.set(1.3, 1.3, 1.3);
  scene.add(farCrate);

  const wallMaterial = sandstoneMaterial;
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 4.2, 30), wallMaterial);
  leftWall.position.set(-7.5, 2.1, -6);
  scene.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.position.x = 7.5;
  scene.add(rightWall);

  const archTop = createBox(THREE, { x: 7, y: 1.2, z: 1 }, { x: 0, y: 3.35, z: -14 }, wallMaterial);
  const archLeft = createBox(THREE, { x: 1.15, y: 3.6, z: 1 }, { x: -3.4, y: 1.8, z: -14 }, wallMaterial);
  const archRight = createBox(THREE, { x: 1.15, y: 3.6, z: 1 }, { x: 3.4, y: 1.8, z: -14 }, wallMaterial);
  scene.add(archTop, archLeft, archRight);

  const balcony = createBox(THREE, { x: 6.4, y: 0.48, z: 5.4 }, { x: -4.1, y: 2.65, z: -9.2 }, shadowStoneMaterial);
  const balconyWall = createBox(THREE, { x: 6.4, y: 1.4, z: 0.46 }, { x: -4.1, y: 3.3, z: -11.8 }, shadowStoneMaterial);
  scene.add(balcony, balconyWall);

  const doorMaterial = new THREE.MeshStandardMaterial({ color: '#4d3825', roughness: 0.9 });
  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.7, 0.28), doorMaterial);
  leftDoor.position.set(-1.05, 1.35, -13.4);
  leftDoor.rotation.y = 0.16;
  scene.add(leftDoor);

  const rightDoor = leftDoor.clone();
  rightDoor.position.x = 1.05;
  rightDoor.rotation.y = -0.16;
  scene.add(rightDoor);

  const siteMark = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.2, 48),
    new THREE.MeshBasicMaterial({ color: '#e8bd51', transparent: true, opacity: 0.42 }),
  );
  siteMark.rotation.x = -Math.PI / 2;
  siteMark.position.set(0.6, 0.035, -5.8);
  scene.add(siteMark);

  const players = [
    createPlayerWithWeapon(THREE, PLAYER_MODEL_IDS.T_RAIDER, { x: -2.25, y: 0, z: -5.7 }, 0.92),
    createPlayerWithWeapon(THREE, PLAYER_MODEL_IDS.CT_RANGER, { x: 2.1, y: 0, z: -7.6 }, 0.88),
    createPlayerWithWeapon(THREE, PLAYER_MODEL_IDS.T_RAIDER, { x: -4.7, y: 2.72, z: -10.3 }, 0.72),
    createPlayerWithWeapon(THREE, PLAYER_MODEL_IDS.CT_RANGER, { x: 4.9, y: 0, z: -11.4 }, 0.7),
    createPlayerWithWeapon(THREE, PLAYER_MODEL_IDS.T_RAIDER, { x: 0.25, y: 0, z: -12.7 }, 0.66),
  ];
  players.forEach((player, index) => {
    player.rotation.y = index % 2 === 0 ? 0.08 : -0.12;
    scene.add(player);
  });

  const viewModel = new THREE.Group();
  const gunMaterial = new THREE.MeshStandardMaterial({ color: '#1e211d', metalness: 0.32, roughness: 0.5 });
  const woodMaterial = new THREE.MeshStandardMaterial({ color: '#9a5f2f', roughness: 0.7 });
  const gloveMaterial = new THREE.MeshStandardMaterial({ color: '#26241d', roughness: 0.86 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: '#9b7557', roughness: 0.82 });
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.24, 0.28), gunMaterial);
  receiver.position.set(0.48, -0.32, -1.02);
  const dustCover = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.08, 0.3), gunMaterial);
  dustCover.position.set(0.38, -0.17, -1.02);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 12), gunMaterial);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(1.28, -0.27, -1.02);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.052, 0.18, 12), gunMaterial);
  muzzle.rotation.z = Math.PI / 2;
  muzzle.position.set(1.94, -0.27, -1.02);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.34), woodMaterial);
  handguard.position.set(0.9, -0.42, -1.02);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.28), woodMaterial);
  stock.position.set(-0.28, -0.34, -1.02);
  stock.rotation.z = -0.1;
  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.72, 0.23), gunMaterial);
  magazine.position.set(0.36, -0.82, -0.98);
  magazine.rotation.z = 0.24;
  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.24), skinMaterial);
  leftForearm.position.set(0.72, -0.72, -0.86);
  leftForearm.rotation.z = -0.08;
  const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.28), gloveMaterial);
  leftGlove.position.set(0.9, -0.58, -0.96);
  const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.22), skinMaterial);
  rightForearm.position.set(-0.04, -0.82, -0.78);
  rightForearm.rotation.z = 0.28;
  const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.26), gloveMaterial);
  rightGlove.position.set(0.2, -0.66, -0.9);
  viewModel.add(receiver, dustCover, barrel, muzzle, handguard, stock, magazine, leftForearm, leftGlove, rightForearm, rightGlove);
  viewModel.rotation.set(-0.05, -0.28, 0.02);
  viewModel.scale.setScalar(1.16);
  camera.add(viewModel);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight('#dbe9ff', '#7a5a32', 1.05));
  scene.add(new THREE.AmbientLight('#fff0cf', 0.64));

  const sun = new THREE.DirectionalLight('#ffd9b0', 1.4);
  sun.position.set(4, 8, 3);
  sun.castShadow = false;
  scene.add(sun);

  const onResize = () => {
    const { width, height } = getSafeViewportSize(mount);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
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
    const bob = Math.sin(time * 0.004) * 0.018;
    viewModel.position.set(0.25, bob, 0);
    crate.rotation.y = time * 0.00022;
    farCrate.rotation.y = -time * 0.00018;
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(tick);
  });

  onResize();

  return {
    state: Object.freeze({ ok: true, reason: 'webgl-ready', viewport: getSafeViewportSize(mount), recoverable: true }),
    requestPointerLock,
    resize: onResize,
    destroy() {
      window.cancelAnimationFrame(animationFrame);
      renderer.domElement.removeEventListener('click', requestPointerLock);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      renderer.dispose();
    },
  };
}
