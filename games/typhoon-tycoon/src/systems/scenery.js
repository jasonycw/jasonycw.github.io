import * as THREE from 'three';
import { scene } from '../core/three-setup.js';
import { CONFIG } from '../core/config.js';
import { gridCells, useHitareaClassification } from '../world/map.js';
import { effects } from './effects.js';

export const scenery = [];

// Track destroyed tree positions for regrowth
export const destroyedSpots = [];
// Trees currently growing (scale animation)
const growingTrees = [];
// Regrowth cooldown: seconds after destruction before regrowth can start
const REGROW_COOLDOWN = 12;
// Probability per second per spot that a new tree grows
const REGROW_CHANCE_PER_SEC = 0.08;

// ==================== SCENERY SHARED GEOMETRIES ====================
export const treeTrunkGeom = new THREE.CylinderGeometry(0.03, 0.04, 0.2, 4);
export const treeTrunkMat = new THREE.MeshBasicMaterial({ color: 0x5d4037 });
export const treeCrownGeom = new THREE.ConeGeometry(0.18, 0.25, 6);
export const treeCrownMat = new THREE.MeshBasicMaterial({ color: 0x4caf50 });
export const treeCrown2Geom = new THREE.ConeGeometry(0.12, 0.18, 6);
export const treeCrown2Mat = new THREE.MeshBasicMaterial({ color: 0x388e3c });

/** Populate land with decorative scenery — free-placed (not grid-aligned) */
export function setupScenery() {
  const elev = CONFIG.groundY;

  // --- Skyscraper palette ---
  const bodyColors = [0x263238, 0x37474F, 0x455A64, 0x546E7A, 0x616161, 0x4E342E, 0x3E2723];
  const glassColors = [0x1565C0, 0x1976D2, 0x0D47A1, 0x00838F, 0x0277BD, 0x1A237E, 0x00ACC1, 0x2962FF, 0x448AFF, 0x82B1FF];
  const accentColors = [0xFF6F00, 0xE65100, 0x1B5E20, 0xBF360C, 0x4A148C, 0xC62828];
  const crownColors = [0x607D8B, 0x78909C, 0x90A4AE, 0xB0BEC5, 0xCFD8DC, 0xECEFF1];

  function makeSkyscraper(wx, wz) {
    const parts = [];
    const allocs = [];

    const totalH = 0.8 + Math.random() * 1.2;
    const w = 0.08 + Math.random() * 0.08;
    const bodyColor = bodyColors[Math.floor(Math.random() * bodyColors.length)];
    const glassColor = glassColors[Math.floor(Math.random() * glassColors.length)];
    const crownColor = crownColors[Math.floor(Math.random() * crownColors.length)];

    const bodyMat = new THREE.MeshBasicMaterial({ color: bodyColor });
    const bodyGeom = new THREE.BoxGeometry(w, totalH, w);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.set(wx, elev + totalH / 2, wz);
    scene.add(body);
    parts.push(body);
    allocs.push({ mat: bodyMat, geom: bodyGeom });

    const bandH = 0.025;
    const bandSpread = 0.02;
    const bandMat = new THREE.MeshBasicMaterial({ color: glassColor });
    const bandGeom = new THREE.BoxGeometry(w + bandSpread, bandH, w + bandSpread);
    const bandInterval = 0.25 + Math.random() * 0.15;
    const bandCount = Math.floor(Math.max(0, totalH - 0.4) / bandInterval);
    for (let i = 0; i < bandCount; i++) {
      const yPos = 0.2 + i * bandInterval + bandH / 2;
      if (yPos + bandH / 2 > totalH) break;
      const band = new THREE.Mesh(bandGeom, bandMat);
      band.position.set(wx, elev + yPos, wz);
      scene.add(band);
      parts.push(band);
      allocs.push({ mat: bandMat, geom: bandGeom });
    }

    const crownW = w * (0.5 + Math.random() * 0.25);
    const crownH = 0.15 + Math.random() * 0.2;
    const crownMat = new THREE.MeshBasicMaterial({ color: crownColor });
    const crownGeom = new THREE.BoxGeometry(crownW, crownH, crownW);
    const crown = new THREE.Mesh(crownGeom, crownMat);
    crown.position.set(wx, elev + totalH - crownH / 2, wz);
    scene.add(crown);
    parts.push(crown);
    allocs.push({ mat: crownMat, geom: crownGeom });

    if (Math.random() < 0.4) {
      const antMat = new THREE.MeshBasicMaterial({ color: 0x616161 });
      const antH = 0.15 + Math.random() * 0.2;
      const antGeom = new THREE.CylinderGeometry(0.008, 0.012, antH, 3);
      const ant = new THREE.Mesh(antGeom, antMat);
      ant.position.set(wx, elev + totalH + antH / 2, wz);
      scene.add(ant);
      parts.push(ant);
      allocs.push({ mat: antMat, geom: antGeom });
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xFF1744 });
      const tipGeom = new THREE.SphereGeometry(0.012, 4, 4);
      const tip = new THREE.Mesh(tipGeom, tipMat);
      tip.position.set(wx, elev + totalH + antH + 0.01, wz);
      scene.add(tip);
      parts.push(tip);
      allocs.push({ mat: tipMat, geom: tipGeom });
    }

    if (Math.random() < 0.3) {
      const accColor = accentColors[Math.floor(Math.random() * accentColors.length)];
      const accMat = new THREE.MeshBasicMaterial({ color: accColor });
      const accH = 0.03;
      const accGeom = new THREE.BoxGeometry(w * 1.15, accH, w * 1.15);
      const accRing = new THREE.Mesh(accGeom, accMat);
      accRing.position.set(wx, elev + totalH * 0.85, wz);
      scene.add(accRing);
      parts.push(accRing);
      allocs.push({ mat: accMat, geom: accGeom });
    }

    scenery.push({ type: 'building', parts, worldX: wx, worldZ: wz, alive: true, allocs });
  }

  function makeMidrise(wx, wz) {
    const parts = [];
    const allocs = [];
    const totalH = 0.6 + Math.random() * 0.8;
    const w = 0.14 + Math.random() * 0.1;
    const color = bodyColors[Math.floor(Math.random() * bodyColors.length)];

    const bodyMat = new THREE.MeshBasicMaterial({ color });
    const bodyGeom = new THREE.BoxGeometry(w, totalH, w);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.set(wx, elev + totalH / 2, wz);
    scene.add(body);
    parts.push(body);
    allocs.push({ mat: bodyMat, geom: bodyGeom });

    const roofMat = new THREE.MeshBasicMaterial({ color: crownColors[Math.floor(Math.random() * crownColors.length)] });
    const roofGeom = new THREE.BoxGeometry(w * 1.05, 0.03, w * 1.05);
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(wx, elev + totalH, wz);
    scene.add(roof);
    parts.push(roof);
    allocs.push({ mat: roofMat, geom: roofGeom });

    scenery.push({ type: 'building', parts, worldX: wx, worldZ: wz, alive: true, allocs });
  }

  // Skyscrapers
  const numSkyscrapers = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < numSkyscrapers; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.3 + Math.random() * 1.5;
    const wx = Math.cos(angle) * dist;
    const wz = Math.sin(angle) * dist;
    if (Math.random() < 0.7) makeSkyscraper(wx, wz);
    else makeMidrise(wx, wz);
  }

  // Trees — randomly placed on land, not grid-bound
  const treeCount = 18 + Math.floor(Math.random() * 12); // 18-29 trees
  for (let attempt = 0; attempt < treeCount * 3 && scenery.filter(s => s.type === 'tree' && s.alive).length < treeCount; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * CONFIG.islandRadius * 0.95;
    const wx = Math.cos(angle) * dist;
    const wz = Math.sin(angle) * dist;
    if (isValidTreeSpot(wx, wz)) {
      spawnTree(wx, wz, false);
    }
  }
}

/** Check if a world position is valid for a decorative tree */
function isValidTreeSpot(wx, wz) {
  // Must be on land
  const cx = Math.round(wx / CONFIG.cellSize);
  const cz = Math.round(wz / CONFIG.cellSize);
  const half = 7;
  if (Math.abs(cx) > half || Math.abs(cz) > half) return false;
  const cols = half * 2 + 1;
  const cell = gridCells[(cx + half) * cols + (cz + half)];
  if (!cell || !cell.isLand || cell.occupied) return false;
  // Not too close to existing alive trees
  for (const s of scenery) {
    if (s.type === 'tree' && s.alive && Math.hypot(s.worldX - wx, s.worldZ - wz) < 0.35) return false;
  }
  return true;
}

/** Spawn a single tree at a world position with optional growth animation */
export function spawnTree(wx, wz, withGrowth) {
  const elev = CONFIG.groundY;
  const trunk = new THREE.Mesh(treeTrunkGeom, treeTrunkMat);
  trunk.position.set(wx, elev + 0.1, wz);
  const crown1 = new THREE.Mesh(treeCrownGeom, treeCrownMat);
  crown1.position.set(wx, elev + 0.35, wz);
  const crown2 = new THREE.Mesh(treeCrown2Geom, treeCrown2Mat);
  crown2.position.set(wx, elev + 0.25, wz);

  if (withGrowth) {
    trunk.scale.set(0, 0, 0);
    crown1.scale.set(0, 0, 0);
    crown2.scale.set(0, 0, 0);
    growingTrees.push({ parts: [trunk, crown1, crown2], age: 0, maxAge: 0.6 });
  }

  scene.add(trunk);
  scene.add(crown1);
  scene.add(crown2);
  scenery.push({ type: 'tree', parts: [trunk, crown1, crown2], worldX: wx, worldZ: wz, alive: true });
}

/** Update growing tree scale animations */
function updateGrowingTrees(dt) {
  for (let i = growingTrees.length - 1; i >= 0; i--) {
    const gt = growingTrees[i];
    gt.age += dt;
    const t = Math.min(1, gt.age / gt.maxAge);
    // Elastic ease-out
    const scale = 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI * 2) * (1 - t) * 0.15;
    for (const part of gt.parts) {
      part.scale.setScalar(Math.max(0, scale));
    }
    if (gt.age >= gt.maxAge) {
      for (const part of gt.parts) part.scale.setScalar(1);
      growingTrees.splice(i, 1);
    }
  }
}

/** Check destroyed spots for regrowth opportunities */
export function updateTreeRegrowth(dt) {
  // Accumulate time on each destroyed spot
  for (const ds of destroyedSpots) ds.age += dt;

  // Remove old spots that have had a chance to regrow
  for (let i = destroyedSpots.length - 1; i >= 0; i--) {
    const ds = destroyedSpots[i];
    if (ds.age > REGROW_COOLDOWN + 10) {
      destroyedSpots.splice(i, 1);
      continue;
    }
    // After cooldown, chance to regrow
    if (ds.age > REGROW_COOLDOWN && Math.random() < REGROW_CHANCE_PER_SEC * dt * 60) {
      // Spawn near original spot with some jitter
      const jx = ds.x + (Math.random() - 0.5) * 1.2;
      const jz = ds.z + (Math.random() - 0.5) * 1.2;
      if (isValidTreeSpot(jx, jz)) {
        spawnTree(jx, jz, true);
        destroyedSpots.splice(i, 1);
      }
    }
  }

  updateGrowingTrees(dt);
}

/** Destroy and burst scenery within a radius of a world position */
export function destroySceneryNear(wx, wz, radius) {
  const hit = scenery.filter(s => s.alive && Math.hypot(s.worldX - wx, s.worldZ - wz) < radius);
  for (const s of hit) {
    s.alive = false;
    // Track destroyed tree position for regrowth
    if (s.type === 'tree') {
      destroyedSpots.push({ x: s.worldX, z: s.worldZ, age: 0 });
    }
    for (const part of s.parts) {
      scene.remove(part);
    }
    if (s.type === 'building' && s.allocs) {
      for (const a of s.allocs) {
        if (a.geom) a.geom.dispose();
        if (a.mat) a.mat.dispose();
      }
    } else {
      for (const part of s.parts) {
        if (part.geometry &&
            part !== treeTrunkGeom && part !== treeCrownGeom && part !== treeCrown2Geom) {
          part.geometry.dispose();
        }
        if (part.material &&
            part !== treeTrunkMat && part !== treeCrownMat && part !== treeCrown2Mat) {
          part.material.dispose();
        }
      }
    }
    const debrisCount = s.type === 'building' ? 6 : 3;
    for (let i = 0; i < debrisCount; i++) {
      const angle = (i / debrisCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const speed = 1 + Math.random() * 2;
      const dGeom = new THREE.SphereGeometry(0.04, 3, 3);
      const dMat = new THREE.MeshBasicMaterial({
        color: s.type === 'tree' ? 0x4caf50 : 0x78909C,
        transparent: true, opacity: 1
      });
      const dMesh = new THREE.Mesh(dGeom, dMat);
      dMesh.position.set(s.worldX, CONFIG.groundY + 0.2, s.worldZ);
      scene.add(dMesh);
      effects.push({
        mesh: dMesh, mat: dMat, life: 0.6, maxLife: 0.6, geom: dGeom,
        _vx: Math.cos(angle) * speed, _vz: Math.sin(angle) * speed,
        _vy: 1.2 + Math.random() * 1.5, _burst: true
      });
    }
  }
}

/** Silently remove scenery at a world position (no debris burst) */
export function removeSceneryAt(wx, wz) {
  const hit = scenery.filter(s => s.alive && Math.hypot(s.worldX - wx, s.worldZ - wz) < 0.6);
  for (const s of hit) {
    s.alive = false;
    for (const part of s.parts) scene.remove(part);
    if (s.type === 'building' && s.allocs) {
      for (const a of s.allocs) {
        if (a.geom) a.geom.dispose();
        if (a.mat) a.mat.dispose();
      }
    }
  }
}
