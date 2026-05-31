import * as THREE from 'three';

import { createRendererFallbackState, getSafeViewportSize, hasUsableWebGL } from './state.js';

export * from './state.js';
export * from './weaponModels.js';

const setVisible = (element, visible) => {
  element.hidden = !visible;
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
  scene.background = new THREE.Color('#091019');
  scene.fog = new THREE.Fog('#091019', 14, 60);

  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 120);
  camera.position.set(0, 2.2, 7.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1, false);

  mount.replaceChildren(renderer.domElement);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: '#2f3f30', roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshStandardMaterial({ color: '#b37c4a', roughness: 0.95 }),
  );
  crate.position.set(0, 0.7, 0);
  scene.add(crate);

  scene.add(new THREE.AmbientLight('#ffffff', 1.15));

  const sun = new THREE.DirectionalLight('#ffd9b0', 1.4);
  sun.position.set(4, 8, 3);
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
    crate.rotation.y = time * 0.0005;
    crate.rotation.x = time * 0.0003;
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
