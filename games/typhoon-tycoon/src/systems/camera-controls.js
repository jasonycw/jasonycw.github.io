import * as THREE from 'three';
import { camera, renderer } from '../core/three-setup.js';

// ==================== CAMERA ORBIT CONTROLS ====================
// Orbit around Hong Kong center (0, 0, 0) via right-click + drag.
// Horizontal drag → rotate azimuth (clockwise/counter-clockwise around Y)
// Vertical drag   → change polar angle (top-down ↔ horizontal)

const TARGET = new THREE.Vector3(0, 0, 0);
const INITIAL_RADIUS = Math.sqrt(18 * 18 + 18 * 18 + 18 * 18); // ~31.18
const MIN_RADIUS = 14;
const MAX_RADIUS = INITIAL_RADIUS;

// Initial spherical angles derived from camera.position (18, 18, 18)
let theta = Math.PI / 4;           // azimuth (radians) — rotation around Y
let phi = Math.acos(18 / INITIAL_RADIUS);  // polar (radians) — angle from Y axis
let radius = INITIAL_RADIUS;

let isOrbiting = false;
let prevX = 0;
let prevY = 0;
let onCameraChange = null; // callback after camera position updates

const SENSITIVITY = 0.005;
const PHI_MIN = 0.05;      // near top-down
const PHI_MAX = Math.PI / 2 - 0.05; // near horizontal

function getTargetScreenY() {
  const projected = TARGET.clone().project(camera);
  return (-projected.y * 0.5 + 0.5) * window.innerHeight;
}

/** Check whether the user is currently dragging the camera */
export function isCameraOrbiting() {
  return isOrbiting;
}

/** Recompute camera position from current spherical angles */
function updateCamera() {
  phi = Math.max(PHI_MIN, Math.min(PHI_MAX, phi));

  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  const st = Math.sin(theta);
  const ct = Math.cos(theta);

  camera.position.set(
    radius * ct * sp,
    radius * cp,
    radius * st * sp
  );
  camera.lookAt(TARGET);

  if (onCameraChange) onCameraChange();
}

/**
 * Initialize camera orbit controls.
 * @param {Function} onCameraChangeCallback - called after every camera position update.
 *   Use this to recalculate depth sorting.
 */
export function initCameraControls(onCameraChangeCallback) {
  onCameraChange = onCameraChangeCallback;

  const canvas = renderer.domElement;

  // Prevent browser context menu on right-click
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, radius * Math.exp(e.deltaY * 0.001)));
    updateCamera();
  }, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2) {
      isOrbiting = true;
      prevX = e.clientX;
      prevY = e.clientY;
      canvas.style.cursor = 'grabbing';
    }
  });

  // Listen on window so dragging continues even if cursor leaves canvas
  window.addEventListener('pointermove', (e) => {
    if (!isOrbiting) return;
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    const targetScreenY = getTargetScreenY();
    const dragSideSign = prevY < targetScreenY ? 1 : -1;
    prevX = e.clientX;
    prevY = e.clientY;

    theta -= dx * dragSideSign * SENSITIVITY;
    phi   += dy * dragSideSign * SENSITIVITY;

    updateCamera();
  });

  window.addEventListener('pointerup', (e) => {
    if (e.button === 2) {
      isOrbiting = false;
      canvas.style.cursor = '';
    }
  });
}
