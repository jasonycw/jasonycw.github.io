import * as THREE from 'three';
import { CONFIG } from '../core/config.js';

// ==================== MAP CREATION ====================

// Hong Kong position on the 960×600 map.png (yellow cluster center)
const HK_MAP_PX = { x: 376, y: 236 };
// UV coordinate of Hong Kong on the texture
const HK_UV = { u: HK_MAP_PX.x / 960, v: 1 - HK_MAP_PX.y / 600 };
// Shift map so Hong Kong texture pixel aligns with world origin (0,0,0)
export const MAP_PLANE_SIZE = 28;
const HK_LOCAL_X = (HK_UV.u - 0.5) * MAP_PLANE_SIZE;
const HK_LOCAL_Y = (HK_UV.v - 0.5) * MAP_PLANE_SIZE;
export const MAP_OFFSET_X = -HK_LOCAL_X;
export const MAP_OFFSET_Z = HK_LOCAL_Y;

// Grid cells data (invisible — for placement logic only)
export const gridCells = [];
export const cellHalf = CONFIG.cellSize / 2;
export const halfCells = 7; // -7 to +7

// Hitarea-based terrain classification — fallback: simple circle
export let useHitareaClassification = false;

/** Check if a world position falls within the visible map texture (UV 0…1) */
export function isOnMap(wx, wz) {
  const lx = wx - MAP_OFFSET_X;
  const ly = MAP_OFFSET_Z - wz;
  const half = MAP_PLANE_SIZE / 2;
  const uvx = (lx + half) / MAP_PLANE_SIZE;
  const uvy = (ly + half) / MAP_PLANE_SIZE;
  return uvx >= 0 && uvx <= 1 && uvy >= 0 && uvy <= 1;
}

/** Check if a world position is over sea (using hitarea-classified grid) */
export function isSeaAt(wx, wz) {
  const cx = Math.round(wx / CONFIG.cellSize);
  const cz = Math.round(wz / CONFIG.cellSize);
  if (Math.abs(cx) > halfCells || Math.abs(cz) > halfCells) return true; // outside grid = sea
  const cols = halfCells * 2 + 1;
  const cell = gridCells[(cx + halfCells) * cols + (cz + halfCells)];
  return cell ? !cell.isLand : true;
}

// ==================== MAP GEOMETRY SETUP ====================
// This must be called after the renderer/scene exist but before gameplay.
export function createMap(scene) {
  // Load map texture
  const textureLoader = new THREE.TextureLoader();
  const mapTexture = textureLoader.load('assets/map.png');

  // Map ground plane (uses original map.png of South China Sea / HK region)
  const mapGeom = new THREE.PlaneGeometry(MAP_PLANE_SIZE, MAP_PLANE_SIZE);
  const mapMat = new THREE.MeshStandardMaterial({
    map: mapTexture,
    roughness: 0.9,
    metalness: 0.0
  });
  const mapMesh = new THREE.Mesh(mapGeom, mapMat);
  mapMesh.rotation.x = -Math.PI / 2;
  mapMesh.position.set(MAP_OFFSET_X, -0.01, MAP_OFFSET_Z);
  mapMesh.receiveShadow = true;
  scene.add(mapMesh);

  // Concentric circle rings (like original game's danger zones around HK)
  const RING_RADII = [3, 5, 7, 9.5];
  for (let i = 0; i < RING_RADII.length; i++) {
    const r = RING_RADII[i];
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.04, r + 0.04, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.10 + i * 0.03,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);
  }

  // Glow marker for center target
  const targetGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.3, 0.05, 12),
    new THREE.MeshBasicMaterial({ color: 0xff5722 })
  );
  targetGlow.position.set(0, 0.01, 0);
  scene.add(targetGlow);

  // Initialize grid cells
  for (let cx = -halfCells; cx <= halfCells; cx++) {
    for (let cz = -halfCells; cz <= halfCells; cz++) {
      const wx = cx * CONFIG.cellSize;
      const wz = cz * CONFIG.cellSize;
      const dist = Math.sqrt(wx * wx + wz * wz);
      const isLand = dist < CONFIG.islandRadius;

      gridCells.push({
        cx, cz, wx, wz,
        isLand,
        occupied: null // reference to structure object
      });
    }
  }

  // Load hitarea mask to classify land vs sea from the actual map
  const hitareaImg = new Image();
  hitareaImg.onerror = () => {
    console.warn('MAP: hitarea failed to load, using circular fallback classification');
    useHitareaClassification = true;
  };
  hitareaImg.onload = () => {
    const cvs = document.createElement('canvas');
    cvs.width = hitareaImg.width;
    cvs.height = hitareaImg.height;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(hitareaImg, 0, 0);
    const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data;

    // Convert pixel-coord → world-coord → UV → hitarea sample
    function sampleHitarea(wx, wz) {
      const lx = wx - MAP_OFFSET_X;
      const ly = MAP_OFFSET_Z - wz;
      const uvx = (lx + MAP_PLANE_SIZE / 2) / MAP_PLANE_SIZE;
      const uvy = (ly + MAP_PLANE_SIZE / 2) / MAP_PLANE_SIZE;
      if (uvx < 0 || uvx > 1 || uvy < 0 || uvy > 1) return false;
      const px = Math.min(hitareaImg.width - 1, Math.floor(uvx * hitareaImg.width));
      const py = Math.min(hitareaImg.height - 1, Math.floor((1 - uvy) * hitareaImg.height));
      const idx = (py * hitareaImg.width + px) * 4;
      return data[idx] > 128;
    }

    // Re-classify all cells
    for (const cell of gridCells) {
      cell.isLand = sampleHitarea(cell.wx, cell.wz);
    }
    useHitareaClassification = true;
    console.log('MAP: hitarea loaded, cells classified');
  };
  hitareaImg.src = 'assets/map-hitarea.png';
}
