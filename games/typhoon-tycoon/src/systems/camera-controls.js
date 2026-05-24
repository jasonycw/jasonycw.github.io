import * as THREE from 'three';
import { camera, renderer } from '../core/three-setup.js';

// ==================== CAMERA ORBIT CONTROLS ====================
// Orbit around Hong Kong center (0, 0, 0) via right-click + drag.
// Horizontal drag → rotate azimuth (clockwise/counter-clockwise around Y)
// Vertical drag   → change polar angle (top-down ↔ horizontal)

const TARGET = new THREE.Vector3(0, 0, 0);
const RADIUS = Math.sqrt(18 * 18 + 18 * 18 + 18 * 18); // ~31.18

// Initial spherical angles derived from camera.position (18, 18, 18)
let theta = Math.PI / 4;           // azimuth (radians) — rotation around Y
let phi = Math.acos(18 / RADIUS);  // polar (radians) — angle from Y axis

let isOrbiting = false;
let prevX = 0;
let prevY = 0;
let onCameraChange = null; // callback after camera position updates

const SENSITIVITY = 0.005;
const PHI_MIN = 0.05;      // near top-down
const PHI_MAX = Math.PI / 2 - 0.05; // near horizontal

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
    RADIUS * ct * sp,
    RADIUS * cp,
    RADIUS * st * sp
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
    prevX = e.clientX;
    prevY = e.clientY;

    theta -= dx * SENSITIVITY;
    phi   += dy * SENSITIVITY;

    updateCamera();
  });

  window.addEventListener('pointerup', (e) => {
    if (e.button === 2) {
      isOrbiting = false;
      canvas.style.cursor = '';
    }
  });
}
