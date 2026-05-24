import * as THREE from 'three';
import { scene, camera } from '../core/three-setup.js';
import { CONFIG } from '../core/config.js';
import { gridCells, useHitareaClassification, isSeaAt, MAP_PLANE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Z } from '../world/map.js';
import { effects } from './effects.js';

/** Set uniform renderOrder on all meshes of a composite object based on camera distance from its geometric center */
function applyRenderOrderToParts(parts, centerWorld) {
  const dx = centerWorld.x - camera.position.x;
  const dy = centerWorld.y - camera.position.y;
  const dz = centerWorld.z - camera.position.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const ro = Math.round(-dist * 100);
  console.log(`applyRenderOrder: parts=${parts.length} center=(${centerWorld.x.toFixed(2)},${centerWorld.y.toFixed(2)},${centerWorld.z.toFixed(2)}) dist=${dist.toFixed(2)} ro=${ro}`);
  for (const p of parts) p.renderOrder = ro;
}

/** Recalculate renderOrder on all alive scenery based on current camera position */
export function updateSceneryDepthSort(cameraPos) {
  for (const s of scenery) {
    if (!s.alive) continue;
    if (!s.worldCenter) continue;
    const dx = s.worldCenter.x - cameraPos.x;
    const dy = s.worldCenter.y - cameraPos.y;
    const dz = s.worldCenter.z - cameraPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const ro = Math.round(-dist * 100);
    for (const part of s.parts) {
      part.renderOrder = ro;
    }
  }
}

export const sceneryGroup = new THREE.Group();
scene.add(sceneryGroup);
export const scenery = [];
window.__scenery = scenery;

// Track destroyed tree positions for regrowth
export const destroyedSpots = [];
// Trees currently growing (scale animation)
export const growingTrees = [];
// Regrowth cooldown: seconds after destruction before regrowth can start
const REGROW_COOLDOWN = 5;
// Probability per second per spot that a new tree grows
const REGROW_CHANCE_PER_SEC = 0.15;

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

    const totalH = 0.2 + Math.random() * 0.3;
    const w = 0.2 + Math.random() * 0.15;
    const bodyColor1 = bodyColors[Math.floor(Math.random() * bodyColors.length)];
    const bodyColor2 = bodyColors[Math.floor(Math.random() * bodyColors.length)];
    const crownColor = crownColors[Math.floor(Math.random() * crownColors.length)];

    // Lower body (70% of height)
    const lowerH = totalH * 0.7;
    const bodyMat1 = new THREE.MeshBasicMaterial({ color: bodyColor1 });
    const bodyGeom1 = new THREE.BoxGeometry(w, lowerH, w);
    const body1 = new THREE.Mesh(bodyGeom1, bodyMat1);
    body1.position.set(wx, elev + lowerH / 2, wz);
    sceneryGroup.add(body1);
    parts.push(body1);
    allocs.push({ mat: bodyMat1, geom: bodyGeom1 });

    // Upper body (30% of height, different color)
    const upperH = totalH - lowerH;
    const bodyMat2 = new THREE.MeshBasicMaterial({ color: bodyColor2 });
    const bodyGeom2 = new THREE.BoxGeometry(w * 0.9, upperH, w * 0.9);
    const body2 = new THREE.Mesh(bodyGeom2, bodyMat2);
    body2.position.set(wx, elev + lowerH + upperH / 2, wz);
    sceneryGroup.add(body2);
    parts.push(body2);
    allocs.push({ mat: bodyMat2, geom: bodyGeom2 });

    // Horizontal glass bands on lower body — frequent and thin
    const bandH = 0.015;
    const bandSpread = 0.025;
    const bandInterval = 0.05 + Math.random() * 0.03;
    const bandCount = Math.floor(Math.max(0, lowerH - 0.1) / bandInterval);
    for (let i = 0; i < bandCount; i++) {
      const yPos = 0.08 + i * bandInterval + bandH / 2;
      if (yPos + bandH / 2 > lowerH) break;
      const c = glassColors[Math.floor(Math.random() * glassColors.length)];
      const bandMat = new THREE.MeshBasicMaterial({ color: c });
      const bandGeom = new THREE.BoxGeometry(w + bandSpread, bandH, w + bandSpread);
      const band = new THREE.Mesh(bandGeom, bandMat);
      band.position.set(wx, elev + yPos, wz);
      sceneryGroup.add(band);
      parts.push(band);
      allocs.push({ mat: bandMat, geom: bandGeom });
    }

    // A few vertical accent strips on multiple faces
    const stripColors = [glassColors[Math.floor(Math.random() * glassColors.length)]];
    const stripColors2 = [glassColors[Math.floor(Math.random() * glassColors.length)]];
    for (let side = -1; side <= 1; side += 2) {
      if (Math.random() < 0.4) {
        const sMat = new THREE.MeshBasicMaterial({ color: stripColors[Math.floor(Math.random() * stripColors.length)] });
        const sGeom = new THREE.BoxGeometry(0.015, lowerH * 0.6, 0.005);
        const strip = new THREE.Mesh(sGeom, sMat);
        strip.position.set(wx + side * w * 0.4, elev + lowerH * 0.3, wz + w / 2 + 0.005);
        sceneryGroup.add(strip);
        parts.push(strip);
        allocs.push({ mat: sMat, geom: sGeom });
      }
      if (Math.random() < 0.3) {
        const sMat = new THREE.MeshBasicMaterial({ color: stripColors2[Math.floor(Math.random() * stripColors2.length)] });
        const sGeom = new THREE.BoxGeometry(0.005, lowerH * 0.5, 0.015);
        const strip = new THREE.Mesh(sGeom, sMat);
        strip.position.set(wx, elev + lowerH * 0.25, wz + side * w * 0.4 + 0.005);
        sceneryGroup.add(strip);
        parts.push(strip);
        allocs.push({ mat: sMat, geom: sGeom });
      }
    }

    // Base entrance detail
    if (Math.random() < 0.6) {
      const entMat = new THREE.MeshBasicMaterial({ color: 0x263238 });
      const entGeom = new THREE.BoxGeometry(w * 0.3, 0.06, 0.02);
      const ent = new THREE.Mesh(entGeom, entMat);
      ent.position.set(wx, elev + 0.03, wz + w / 2 + 0.001);
      sceneryGroup.add(ent);
      parts.push(ent);
      allocs.push({ mat: entMat, geom: entGeom });
    }

    // Crown / roof element — two styles
    const crownStyle = Math.floor(Math.random() * 3);
    if (crownStyle === 0) {
      // Flat crown
      const cH = 0.04 + Math.random() * 0.04;
      const cMat = new THREE.MeshBasicMaterial({ color: crownColor });
      const cGeom = new THREE.BoxGeometry(w * 0.85, cH, w * 0.85);
      const crown = new THREE.Mesh(cGeom, cMat);
      crown.position.set(wx, elev + totalH - cH / 2, wz);
      sceneryGroup.add(crown);
      parts.push(crown);
      allocs.push({ mat: cMat, geom: cGeom });
    } else if (crownStyle === 1) {
      // Step-back crown (wider base, narrower top)
      const cH = 0.06 + Math.random() * 0.05;
      const cMat = new THREE.MeshBasicMaterial({ color: crownColor });
      // Base step
      const cGeom1 = new THREE.BoxGeometry(w * 0.8, cH * 0.5, w * 0.8);
      const crown1 = new THREE.Mesh(cGeom1, cMat);
      crown1.position.set(wx, elev + totalH - cH, wz);
      sceneryGroup.add(crown1);
      parts.push(crown1);
      allocs.push({ mat: cMat, geom: cGeom1 });
      // Top step
      const cGeom2 = new THREE.BoxGeometry(w * 0.5, cH * 0.5, w * 0.5);
      const crown2 = new THREE.Mesh(cGeom2, cMat.clone());
      crown2.position.set(wx, elev + totalH - cH / 2, wz);
      sceneryGroup.add(crown2);
      parts.push(crown2);
      allocs.push({ mat: crown2.material, geom: cGeom2 });
    } else {
      // Peaked crown (pyramid-like)
      const cMat = new THREE.MeshBasicMaterial({ color: crownColor });
      const cGeom = new THREE.ConeGeometry(w * 0.55, 0.08 + Math.random() * 0.08, 4);
      const crown = new THREE.Mesh(cGeom, cMat);
      crown.position.set(wx, elev + totalH, wz);
      sceneryGroup.add(crown);
      parts.push(crown);
      allocs.push({ mat: cMat, geom: cGeom });
    }

    // Antenna (reduced chance for shorter buildings — only when tall enough)
    if (totalH > 0.3 && Math.random() < 0.35) {
      const antMat = new THREE.MeshBasicMaterial({ color: 0x616161 });
      const antH = 0.08 + Math.random() * 0.12;
      const antGeom = new THREE.CylinderGeometry(0.006, 0.01, antH, 3);
      const ant = new THREE.Mesh(antGeom, antMat);
      ant.position.set(wx, elev + totalH + antH / 2, wz);
      sceneryGroup.add(ant);
      parts.push(ant);
      allocs.push({ mat: antMat, geom: antGeom });
      if (Math.random() < 0.5) {
        const tipMat = new THREE.MeshBasicMaterial({ color: 0xFF1744 });
        const tipGeom = new THREE.SphereGeometry(0.008, 4, 4);
        const tip = new THREE.Mesh(tipGeom, tipMat);
        tip.position.set(wx, elev + totalH + antH + 0.005, wz);
        sceneryGroup.add(tip);
        parts.push(tip);
        allocs.push({ mat: tipMat, geom: tipGeom });
      }
    }

    // Accent ring (more common)
    if (Math.random() < 0.5) {
      const accColor = accentColors[Math.floor(Math.random() * accentColors.length)];
      const accMat = new THREE.MeshBasicMaterial({ color: accColor });
      const accH = 0.025;
      const accGeom = new THREE.BoxGeometry(w * 1.12, accH, w * 1.12);
      const accRing = new THREE.Mesh(accGeom, accMat);
      accRing.position.set(wx, elev + lowerH * (0.4 + Math.random() * 0.5), wz);
      sceneryGroup.add(accRing);
      parts.push(accRing);
      allocs.push({ mat: accMat, geom: accGeom });
    }

    const centerY = totalH / 2;
    applyRenderOrderToParts(parts, { x: wx, y: centerY, z: wz });

    scenery.push({ type: 'building', parts, worldX: wx, worldZ: wz, worldCenter: { x: wx, y: centerY, z: wz }, alive: true, allocs });
  }

  function makeMidrise(wx, wz) {
    const parts = [];
    const allocs = [];
    const totalH = 0.2 + Math.random() * 0.3;
    const w = 0.2 + Math.random() * 0.1;
    const color = bodyColors[Math.floor(Math.random() * bodyColors.length)];

    const bodyMat = new THREE.MeshBasicMaterial({ color });
    const bodyGeom = new THREE.BoxGeometry(w, totalH, w);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.set(wx, elev + totalH / 2, wz);
    sceneryGroup.add(body);
    parts.push(body);
    allocs.push({ mat: bodyMat, geom: bodyGeom });

    const roofMat = new THREE.MeshBasicMaterial({ color: crownColors[Math.floor(Math.random() * crownColors.length)] });
    const roofGeom = new THREE.BoxGeometry(w * 1.05, 0.03, w * 1.05);
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(wx, elev + totalH, wz);
    sceneryGroup.add(roof);
    parts.push(roof);
    allocs.push({ mat: roofMat, geom: roofGeom });

    const midCenterY = totalH / 2;
    applyRenderOrderToParts(parts, { x: wx, y: midCenterY, z: wz });

    scenery.push({ type: 'building', parts, worldX: wx, worldZ: wz, worldCenter: { x: wx, y: midCenterY, z: wz }, alive: true, allocs });
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

  // Trees — randomly placed on land across the full map, not grid-bound
  const treeCount = 22 + Math.floor(Math.random() * 14);
  const mapHalf = MAP_PLANE_SIZE / 2 - 1;
  for (let attempt = 0; attempt < treeCount * 4 && scenery.filter(s => s.type === 'tree' && s.alive).length < treeCount; attempt++) {
    const wx = MAP_OFFSET_X + (Math.random() - 0.5) * MAP_PLANE_SIZE * 0.9;
    const wz = MAP_OFFSET_Z + (Math.random() - 0.5) * MAP_PLANE_SIZE * 0.9;
    if (isValidTreeSpot(wx, wz)) {
      spawnTree(wx, wz, false);
    }
  }
}

/** Check if a world position is valid for a decorative tree */
function isValidTreeSpot(wx, wz) {
  // Must be on land (use hitarea-based check, not grid cells, for full island coverage)
  if (isSeaAt(wx, wz)) return false;
  // Not too close to existing alive trees or structures
  for (const s of scenery) {
    if (s.type === 'tree' && s.alive && Math.hypot(s.worldX - wx, s.worldZ - wz) < 0.4) return false;
  }
  // Check no grid cell occupant (player-built structure)
  const cx = Math.round(wx / CONFIG.cellSize);
  const cz = Math.round(wz / CONFIG.cellSize);
  const half = 7;
  if (Math.abs(cx) <= half && Math.abs(cz) <= half) {
    const cols = half * 2 + 1;
    const cell = gridCells[(cx + half) * cols + (cz + half)];
    if (cell && cell.occupied) return false;
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

  sceneryGroup.add(trunk);
  sceneryGroup.add(crown1);
  sceneryGroup.add(crown2);
  const parts = [trunk, crown1, crown2];
  const treeCenter = { x: wx, y: CONFIG.groundY + 0.2, z: wz };
  applyRenderOrderToParts(parts, treeCenter);
  scenery.push({ type: 'tree', parts, worldX: wx, worldZ: wz, worldCenter: treeCenter, alive: true });
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
    if (ds.age > REGROW_COOLDOWN && Math.random() < REGROW_CHANCE_PER_SEC * dt) {
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
      sceneryGroup.remove(part);
    }
    if (s.type === 'building' && s.allocs) {
      for (const a of s.allocs) {
        if (a.geom) a.geom.dispose();
        if (a.mat) a.mat.dispose();
      }
    } else {
      for (const part of s.parts) {
        if (part.geometry &&
            part.geometry !== treeTrunkGeom && part.geometry !== treeCrownGeom && part.geometry !== treeCrown2Geom) {
          part.geometry.dispose();
        }
        if (part.material &&
            part.material !== treeTrunkMat && part.material !== treeCrownMat && part.material !== treeCrown2Mat) {
          part.material.dispose();
        }
      }
    }

    // ===== DRAMATIC DESTRUCTION ANIMATION =====
    if (s.type === 'tree') {
      // Trees fly into the sky like getting hit by a tornado
      for (const part of s.parts) {
        const angle = Math.random() * Math.PI * 2;
        const outSpeed = 1.5 + Math.random() * 3;
        const upSpeed = 3 + Math.random() * 4;
        const spinSpeed = (Math.random() - 0.5) * 8;
        // Detach from scenery group — effect system handles removal from main scene
        sceneryGroup.remove(part);
        scene.add(part);
    effects.push({
      mesh: part, mat: part.material.clone(), life: 1.5, maxLife: 1.5, geom: null,
      _tornado: true, _spin: spinSpeed, _upSpeed: upSpeed,
      _vx: Math.cos(angle) * outSpeed,
      _vz: Math.sin(angle) * outSpeed
    });
      }
      // Green burst of leaves
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const s2 = 1.5 + Math.random() * 2.5;
        const g = new THREE.SphereGeometry(0.03, 3, 3);
        const m = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x66bb6a : 0x4caf50, transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(s.worldX, CONFIG.groundY + 0.3, s.worldZ);
        scene.add(mesh);
        effects.push({ mesh, mat: m, life: 0.7, maxLife: 0.7, geom: g,
          _vx: Math.cos(a) * s2, _vz: Math.sin(a) * s2, _vy: 2 + Math.random() * 2, _burst: true });
      }
    } else {
      // Buildings — dramatic collapse/explosion
      // Large smoke flash at center
      const flashG = new THREE.SphereGeometry(0.5, 8, 8);
      const flashM = new THREE.MeshBasicMaterial({ color: 0xff8a65, transparent: true, opacity: 0.9 });
      const flash = new THREE.Mesh(flashG, flashM);
      flash.position.set(s.worldX, CONFIG.groundY + 0.5, s.worldZ);
      scene.add(flash);
      effects.push({ mesh: flash, mat: flashM, life: 0.4, maxLife: 0.4, geom: flashG, _explosionFlash: true });

      // Concrete debris chunks (larger than current debris spheres)
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
        const speed = 2 + Math.random() * 4;
        const dGeom = i % 3 === 0
          ? new THREE.BoxGeometry(0.06, 0.06, 0.06)
          : new THREE.SphereGeometry(0.04 + Math.random() * 0.04, 4, 4);
        const dMat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x90a4ae : 0x607d8b,
          transparent: true, opacity: 1
        });
        const dMesh = new THREE.Mesh(dGeom, dMat);
        dMesh.position.set(s.worldX, CONFIG.groundY + 0.3 + Math.random() * 0.4, s.worldZ);
        scene.add(dMesh);
        effects.push({
          mesh: dMesh, mat: dMat, life: 0.9, maxLife: 0.9, geom: dGeom,
          _vx: Math.cos(angle) * speed, _vz: Math.sin(angle) * speed,
          _vy: 2 + Math.random() * 3, _burst: true,
          _tumbleX: (Math.random() - 0.5) * 10,
          _tumbleY: (Math.random() - 0.5) * 10
        });
      }
    }
  }
}

/** Silently remove scenery at a world position (no debris burst) */
export function removeSceneryAt(wx, wz) {
  const hit = scenery.filter(s => s.alive && Math.hypot(s.worldX - wx, s.worldZ - wz) < 0.6);
  for (const s of hit) {
    s.alive = false;
    for (const part of s.parts) sceneryGroup.remove(part);
    if (s.type === 'building' && s.allocs) {
      for (const a of s.allocs) {
        if (a.geom) a.geom.dispose();
        if (a.mat) a.mat.dispose();
      }
    }
  }
}
