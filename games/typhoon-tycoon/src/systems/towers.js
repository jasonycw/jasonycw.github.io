import * as THREE from 'three';
import { scene } from '../core/three-setup.js';
import { state, getStructConfig } from '../core/state.js';
import { enemies, damageEnemy } from './enemies.js';
import { effects, spawnBurst, spawnLaserBeam } from './effects.js';
import { playLaserSound, startFreezeSound, stopFreezeSound, playRepelSound } from './audio.js';
import { setStatus } from './ui.js';
import { playPowerDownSound, playPowerUpSound } from './audio.js';

export const towers = [];
export const buildings = [];
const smokeGeom = new THREE.SphereGeometry(1, 6, 6);
const towerUpVector = new THREE.Vector3(0, 1, 0);
const towerTargetDir = new THREE.Vector3();
window.__towers = towers;
window.__buildings = buildings;

// Shared tower geometries — created once per page load, reused by all towers of the same type
const towerGeoms = {
  // LaserTower
  laserBase: new THREE.CylinderGeometry(0.5, 0.6, 0.3, 8),
  laserBarrel: new THREE.CylinderGeometry(0.08, 0.12, 0.7, 8),
  laserRing: new THREE.TorusGeometry(0.2, 0.05, 8, 12),
  // FreezeTower
  freezeBase: new THREE.CylinderGeometry(0.5, 0.55, 0.3, 8),
  freezeBody: new THREE.OctahedronGeometry(0.4),
  freezeRing: new THREE.TorusGeometry(0.35, 0.04, 8, 16),
  // RepelTower
  repelBase: new THREE.CylinderGeometry(0.6, 0.65, 0.3, 8),
  repelFieldRing0: new THREE.RingGeometry(0.34, 0.37, 8),
  repelFieldRing1: new THREE.RingGeometry(0.47, 0.50, 8),
  repelFieldRing2: new THREE.RingGeometry(0.60, 0.63, 8),
  repelFieldRing3: new THREE.RingGeometry(0.73, 0.77, 8),
  repelRing0: new THREE.TorusGeometry(0.25, 0.03, 8, 16),
  repelRing1: new THREE.TorusGeometry(0.40, 0.03, 8, 16),
};
const unitCylinderGeom = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
const repelPulseGeom = new THREE.TorusGeometry(0.16, 0.018, 8, 32);
export const sharedTowerGeoms = new Set([...Object.values(towerGeoms), unitCylinderGeom, repelPulseGeom]);

// ==================== TOWER MESHES ====================
export function createTowerMesh(type) {
  const group = new THREE.Group();

  if (type === 'LaserTower') {
    const base = new THREE.Mesh(
      towerGeoms.laserBase,
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.4 })
    );
    base.position.y = 0.15;
    group.add(base);
    const barrel = new THREE.Mesh(
      towerGeoms.laserBarrel,
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x4fc3f7, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.2 })
    );
    barrel.position.y = 0.45;
    group.add(barrel);
    const ring = new THREE.Mesh(
      towerGeoms.laserRing,
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x4fc3f7, emissiveIntensity: 0.2 })
    );
    ring.position.y = 0.3;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    group.userData.turret = barrel;
    group.userData.ring = ring;
    group.userData.centerOffset = new THREE.Vector3(0, 0.4, 0);
  } else if (type === 'FreezeTower') {
    const base = new THREE.Mesh(
      towerGeoms.freezeBase,
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.4 })
    );
    base.position.y = 0.15;
    group.add(base);
    const body = new THREE.Mesh(
      towerGeoms.freezeBody,
      new THREE.MeshStandardMaterial({ color: 0x81d4fa, emissive: 0x4fc3f7, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.5 })
    );
    body.position.y = 0.5;
    body.rotation.y = Math.PI / 4;
    group.add(body);
    const iceRing = new THREE.Mesh(
      towerGeoms.freezeRing,
      new THREE.MeshBasicMaterial({ color: 0xb3e5fc, transparent: true, opacity: 0.7 })
    );
    iceRing.position.y = 0.5;
    iceRing.rotation.x = Math.PI / 2;
    group.add(iceRing);
    group.userData.body = body;
    group.userData.iceRing = iceRing;
    group.userData.centerOffset = new THREE.Vector3(0, 0.4, 0);
  } else if (type === 'RepelTower') {
    const base = new THREE.Mesh(
      towerGeoms.repelBase,
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.4 })
    );
    base.position.y = 0.15;
    group.add(base);
    const fieldHead = new THREE.Group();
    fieldHead.position.y = 0.78;
    const fieldLayers = [
      { geom: towerGeoms.repelFieldRing0, color: 0xfff176, opacity: 0.95, z: 0.000 },
      { geom: towerGeoms.repelFieldRing1, color: 0xffd54f, opacity: 0.85, z: 0.012 },
      { geom: towerGeoms.repelFieldRing2, color: 0xffa000, opacity: 0.72, z: 0.024 },
      { geom: towerGeoms.repelFieldRing3, color: 0xff6d00, opacity: 0.58, z: 0.036 }
    ];
    for (const layer of fieldLayers) {
      const octagon = new THREE.Mesh(
        layer.geom,
        new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      octagon.position.z = layer.z;
      fieldHead.add(octagon);
    }
    group.add(fieldHead);
    group.userData.atField = fieldHead;
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(
        i === 0 ? towerGeoms.repelRing0 : towerGeoms.repelRing1,
        new THREE.MeshBasicMaterial({ color: 0xffab40, transparent: true, opacity: 0.6 - i * 0.15 })
      );
      r.position.y = 0.3 + i * 0.1;
      r.rotation.x = Math.PI / 2 + i * 0.3;
      group.add(r);
      group.userData.rings = group.userData.rings || [];
      group.userData.rings.push(r);
    }
    group.userData.centerOffset = new THREE.Vector3(0, 0.25, 0);
  }

  group.castShadow = true;
  return group;
}

export function createBuildingMesh(type) {
  const group = new THREE.Group();

  if (type === 'PowerPlant') {
    // Blue-ish main body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.4, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.6, metalness: 0.1 })
    );
    body.position.y = 0.2;
    group.add(body);
    // Roof slab (darker)
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.05, 0.82),
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.8 })
    );
    roof.position.y = 0.425;
    group.add(roof);
    // 3 gray smoke pipes arranged in a triangle (not centered)
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.9 });
    const pipeGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8);
    const pipePositions = [
      [-0.2, 0.45, 0.15],
      [0.2, 0.45, 0.15],
      [0, 0.45, -0.2]
    ];
    for (const pos of pipePositions) {
      const pipe = new THREE.Mesh(pipeGeom, pipeMat);
      pipe.position.set(pos[0], pos[1] + 0.15, pos[2]);
      group.add(pipe);
    }
    // Store pipe top positions for smoke emission
    group.userData.smokePositions = pipePositions.map(p => new THREE.Vector3(p[0], p[1] + 0.3, p[2]));
    group.userData.hasSmoke = true;
    // Depth-sorting center offset (geometric center of all parts in local space)
    group.userData.centerOffset = new THREE.Vector3(0, 0.375, 0);
  } else if (type === 'NuclearPlant') {
    // Thin-walled cooling tower: wide base, slightly smaller top, large open center.
    const tubeHeight = 0.78;
    const segments = 40;
    const outerBottomRadius = 0.62;
    const outerTopRadius = 0.48;
    const wallThickness = 0.055;
    const innerBottomRadius = outerBottomRadius - wallThickness;
    const innerTopRadius = outerTopRadius - wallThickness;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x607d8b,
      roughness: 0.7,
      metalness: 0.3,
      side: THREE.DoubleSide
    });
    const innerWallMat = new THREE.MeshStandardMaterial({
      color: 0x263238,
      roughness: 0.85,
      metalness: 0.15,
      side: THREE.DoubleSide
    });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.75, metalness: 0.25, side: THREE.DoubleSide });

    const coolingCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(outerBottomRadius, 0, 0),
      new THREE.Vector3(0.54, tubeHeight * 0.35, 0),
      new THREE.Vector3(0.50, tubeHeight * 0.7, 0),
      new THREE.Vector3(outerTopRadius, tubeHeight, 0)
    ]);
    const outerPoints = coolingCurve.getPoints(12).map(p => new THREE.Vector2(p.x, p.y));
    const innerPoints = outerPoints.map(p => new THREE.Vector2(p.x - wallThickness, p.y));

    const outerWall = new THREE.Mesh(
      new THREE.LatheGeometry(outerPoints, segments),
      wallMat
    );
    group.add(outerWall);

    const innerWall = new THREE.Mesh(
      new THREE.LatheGeometry(innerPoints, segments),
      innerWallMat
    );
    group.add(innerWall);

    const topRing = new THREE.Mesh(new THREE.RingGeometry(innerTopRadius, outerTopRadius, segments), capMat);
    topRing.rotation.x = -Math.PI / 2;
    topRing.position.y = tubeHeight + 0.002;
    group.add(topRing);

    const bottomRing = new THREE.Mesh(new THREE.RingGeometry(innerBottomRadius, outerBottomRadius, segments), capMat.clone());
    bottomRing.rotation.x = -Math.PI / 2;
    bottomRing.position.y = 0.002;
    group.add(bottomRing);

    // Concrete base ring
    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(outerBottomRadius + 0.02, 0.035, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.8 })
    );
    baseRing.position.y = 0.05;
    baseRing.rotation.x = Math.PI / 2;
    group.add(baseRing);
    // Glow ring around base
    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(innerBottomRadius - 0.02, 0.022, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x00e676, transparent: true, opacity: 0.5 })
    );
    glowRing.position.y = 0.035;
    glowRing.rotation.x = Math.PI / 2;
    group.add(glowRing);
    // Smoke from the narrow opening at top
    group.userData.smokePositions = [
      new THREE.Vector3(0, tubeHeight + 0.03, 0),
      new THREE.Vector3(0.14, tubeHeight + 0.03, 0.08),
      new THREE.Vector3(-0.12, tubeHeight + 0.03, 0.13),
      new THREE.Vector3(0.12, tubeHeight + 0.03, -0.13),
      new THREE.Vector3(-0.16, tubeHeight + 0.03, -0.06),
      new THREE.Vector3(0.04, tubeHeight + 0.03, 0.18)
    ];
    group.userData.hasSmoke = true;
    group.userData.smokeChance = 0.8;
    group.userData.centerOffset = new THREE.Vector3(0, tubeHeight / 2, 0);
  } else if (type === 'University') {
    // Brownish main body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.45, 0.7),
      bodyMat
    );
    body.position.y = 0.225;
    group.add(body);
    // Small windows on all walls (thin boxes for correct depth rendering)
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xffe0b2, emissive: 0xffe0b2, emissiveIntensity: 0.2 });
    const windowGeom = new THREE.BoxGeometry(0.06, 0.08, 0.003);
    // Front (+Z) and back (-Z)
    for (let side = -1; side <= 1; side += 2) {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const w = new THREE.Mesh(windowGeom, windowMat);
          w.position.set(-0.25 + col * 0.25, 0.13 + row * 0.15, side * 0.351);
          group.add(w);
        }
      }
    }
    // Left (-X) and right (+X)
    for (let side = -1; side <= 1; side += 2) {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const w = new THREE.Mesh(windowGeom, windowMat);
          w.position.set(side * 0.451, 0.13 + row * 0.15, -0.1 + col * 0.3);
          group.add(w);
        }
      }
    }
    // Church-style gable roof (triangular prism)
    const roofShape = new THREE.Shape();
    const rw = 0.48, rh = 0.2;
    roofShape.moveTo(-rw, 0);
    roofShape.lineTo(0, rh);
    roofShape.lineTo(rw, 0);
    roofShape.lineTo(-rw, 0);
    const roofGeom = new THREE.ExtrudeGeometry(roofShape, { depth: 0.72, bevelEnabled: false });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.9 });
    const roofMesh = new THREE.Mesh(roofGeom, roofMat);
    roofMesh.position.set(0, 0.45, -0.36);
    group.add(roofMesh);
    // Clock tower at right end
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const towerBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.3, 0.18),
      towerMat
    );
    towerBase.position.set(0.3, 0.6, 0);
    group.add(towerBase);
    const towerTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.08, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 0.7 })
    );
    towerTop.position.set(0.3, 0.84, 0);
    group.add(towerTop);
    // Clock face (white circle)
    const clockFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 })
    );
    clockFace.position.set(0.39, 0.72, 0);
    clockFace.rotation.y = Math.PI / 2;
    group.add(clockFace);
    // Pointed spire on top of tower
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.15, 6),
      new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 })
    );
    spire.position.set(0.3, 0.95, 0);
    group.add(spire);
    group.userData.centerOffset = new THREE.Vector3(0, 0.35, 0);
  } else if (type === 'ResearchCenter') {
    // Gray main body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.6, metalness: 0.3 });
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.45, 0.8),
      bodyMat
    );
    body.position.y = 0.225;
    group.add(body);
    // Windows on all sides (glowing blue tint, thin boxes for correct depth)
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, emissive: 0x4fc3f7, emissiveIntensity: 0.1 });
    const windowGeom = new THREE.BoxGeometry(0.08, 0.06, 0.003);
    // Front (+Z) and back (-Z)
    for (let side = -1; side <= 1; side += 2) {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const w = new THREE.Mesh(windowGeom, windowMat);
          w.position.set(-0.2 + col * 0.2, 0.13 + row * 0.17, side * 0.401);
          group.add(w);
        }
      }
    }
    // Left (-X) and right (+X)
    for (let side = -1; side <= 1; side += 2) {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const w = new THREE.Mesh(windowGeom, windowMat);
          w.position.set(side * 0.401, 0.13 + row * 0.17, -0.2 + col * 0.2);
          group.add(w);
        }
      }
    }
    // Roof slab
    const roofSlab = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.04, 0.82),
      new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.7 })
    );
    roofSlab.position.y = 0.47;
    group.add(roofSlab);
    // Radio dish pole
    const dishPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.03, 0.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.5, metalness: 0.7 })
    );
    dishPole.position.y = 0.6;
    group.add(dishPole);
    // Radio dish — wider frustum shape (wide top, narrow bottom) like a satellite dish
    // Outer group rotates around Y for scanning; inner tilt group angles the dish
    const dishGroup = new THREE.Group();
    dishGroup.position.y = 0.7;
    // Tilt group holds the dish at an angle so it looks like it's searching the sky
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.x = 0.6; // tilt angle (radians) — dish points diagonally upward
    dishGroup.add(tiltGroup);
    // Concave parabolic radio dish — open bowl shape like a satellite receiver.
    const dishProfile = [
      new THREE.Vector2(0.04, -0.05),
      new THREE.Vector2(0.12, -0.035),
      new THREE.Vector2(0.22, 0.015),
      new THREE.Vector2(0.32, 0.085)
    ];
    const dishMesh = new THREE.Mesh(
      new THREE.LatheGeometry(dishProfile, 24),
      new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.4, metalness: 0.8, side: THREE.DoubleSide })
    );
    tiltGroup.add(dishMesh);
    // Antenna spike in the center of the dish
    const dishAntenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4),
      new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.3, metalness: 0.9 })
    );
    dishAntenna.position.y = 0.08;
    tiltGroup.add(dishAntenna);
    // Cross-bars across the dish opening for detail
    const barMat = new THREE.MeshBasicMaterial({ color: 0x90a4ae });
    for (let i = 0; i < 3; i++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.005, 0.005),
        barMat
      );
      bar.rotation.y = (i / 3) * Math.PI;
      bar.position.y = 0.07;
      tiltGroup.add(bar);
    }
    group.add(dishGroup);
    // Store dish group reference for rotation animation in updateBuildings()
    group.userData.dish = dishGroup;
    group.userData.centerOffset = new THREE.Vector3(0, 0.35, 0);
  } else if (type === 'CheungKong') {
    // Tall skyscraper — 4 stacked sections with windows on all sides
    const sections = [
      { h: 0.5, w: 0.5, y: 0.25, color: 0xb0bec5 },
      { h: 0.4, w: 0.45, y: 0.7, color: 0x90a4ae },
      { h: 0.4, w: 0.4, y: 1.1, color: 0x78909c },
      { h: 0.36, w: 0.35, y: 1.48, color: 0x607d8b }
    ];
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, emissive: 0xbbdefb, emissiveIntensity: 0.15 });
    for (const sec of sections) {
      const secMat = new THREE.MeshStandardMaterial({ color: sec.color, roughness: 0.3, metalness: 0.7 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(sec.w, sec.h, sec.w), secMat);
      box.position.y = sec.y;
      group.add(box);
      // Window grid — scale row count and spacing with section height
      const cols = 3;
      const rows = Math.max(2, Math.floor(sec.h / 0.12));
      const spacingX = sec.w * 0.6 / cols;
      const spacingZ = sec.w * 0.6 / cols;
      const spacingY = sec.h * 0.28;
      const startX = -spacingX * (cols - 1) / 2;
      const startZ = -spacingZ * (cols - 1) / 2;
      const yBase = sec.y - sec.h / 2 + 0.05;
      const wDepth = 0.003;
      const wH = rows > 2 ? 0.07 : 0.06;
      // Front (+Z) and back (-Z)
      for (let side = -1; side <= 1; side += 2) {
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const w = new THREE.Mesh(new THREE.BoxGeometry(0.05, wH, wDepth), windowMat);
            w.position.set(startX + col * spacingX, yBase + row * spacingY, side * (sec.w / 2 + 0.002));
            group.add(w);
          }
        }
      }
      // Left (-X) and right (+X)
      for (let side = -1; side <= 1; side += 2) {
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const w = new THREE.Mesh(new THREE.BoxGeometry(wDepth, wH, 0.05), windowMat);
            w.position.set(side * (sec.w / 2 + 0.002), yBase + row * spacingY, startZ + col * spacingZ);
            group.add(w);
          }
        }
      }
    }
    // Flat roof slab
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.3, metalness: 0.8 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.04, 0.37), roofMat);
    const totalHeight = 0.5 + 0.4 + 0.4 + 0.36; // sum of section heights
    roof.position.y = totalHeight + 0.02;
    group.add(roof);
    // Small antenna on roof
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.015, 0.1, 6),
      new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.3, metalness: 0.9 })
    );
    antenna.position.y = totalHeight + 0.08;
    group.add(antenna);
    group.userData.centerOffset = new THREE.Vector3(0, 0.9, 0);
  }

  group.castShadow = true;
  return group;
}

// ==================== PROJECTILE SYSTEM ====================
function fireProjectile(tower) {
  if (tower.type !== 'LaserTower') return;

  const target = tower.target;
  if (!target || !target.alive) return;

  const dx = target.x - tower.wx;
  const dz = target.z - tower.wz;
  const aimDist = Math.sqrt(dx * dx + 0.55 * 0.55 + dz * dz);
  if (aimDist > 0.01) {
    const bx = tower.wx + 0.35 * dx / aimDist;
    const by = 0.45 + 0.35 * 0.55 / aimDist;
    const bz = tower.wz + 0.35 * dz / aimDist;
    spawnLaserBeam(bx, by, bz, target.x, 1.0, target.z, 0xffeb3b);
  } else {
    spawnLaserBeam(tower.wx, 0.5, tower.wz, target.x, 1.0, target.z, 0xffeb3b);
  }

  playLaserSound();

  const cfg = getStructConfig('LaserTower');
  let dmg = cfg.damage;
  if (state.universityCount > 0) dmg += state.universityCount * 5;
  if (state.researchCenterCount > 0) dmg += state.researchCenterCount * 3;
  damageEnemy(target, dmg);

  spawnBurst(target.x, 0.5, target.z, 0xffeb3b, 6);
}

// ==================== TOWER UPDATE ====================
export function updateTowers(dt) {
  for (const t of towers) {
    if (!t.online) continue;

    t.cooldown -= dt;

    let nearest = null;
    let nearDistSq = t.range * t.range;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - t.wx;
      const dz = e.z - t.wz;
      const distSq = dx * dx + dz * dz;
      if (distSq < nearDistSq) {
        nearDistSq = distSq;
        nearest = e;
      }
    }

    t.target = nearest;

    if (nearest && t.mesh.userData.turret) {
      const dx = nearest.x - t.wx;
      const dz = nearest.z - t.wz;
      const dist2d = Math.sqrt(dx * dx + dz * dz);
      if (dist2d > 0.1) {
        towerTargetDir.set(dx, 1.0 - 0.45, dz).normalize();
        t.mesh.userData.turret.quaternion.setFromUnitVectors(towerUpVector, towerTargetDir);
        if (t.mesh.userData.ring) {
          t.mesh.userData.ring.rotation.z = Math.atan2(dx, dz);
        }
      }
    }

    if (t.type === 'FreezeTower' && t.mesh.userData.body) {
      t.mesh.userData.body.rotation.y += dt * 1.5;
    }
    if (t.type === 'RepelTower' && t.mesh.userData.rings) {
      for (const r of t.mesh.userData.rings) {
        r.rotation.z += dt * 2;
      }
    }

    // Freeze Tower
    if (t.type === 'FreezeTower') {
      if (nearest) {
        if (!t._hadFreezeTarget) { t._hadFreezeTarget = true; startFreezeSound(t); }
        nearest.isSlowed = 2.0;
        nearest.slowFactor = 0.5;
        updateFreezeBeam(t, nearest, dt);
      } else {
        if (t._hadFreezeTarget) { t._hadFreezeTarget = false; stopFreezeSound(t); }
        removeTowerBeam(t);
      }
      continue;
    }

    // Repel Tower
    if (t.type === 'RepelTower') {
      if (nearest) {
        if (!t._hadRepelTarget) { t._hadRepelTarget = true; playRepelSound(); }
        const dx = nearest.x - t.wx;
        const dz = nearest.z - t.wz;
        if (t.mesh.userData.atField) {
          t.mesh.userData.atField.rotation.y = Math.atan2(dx, dz);
        }
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0) {
          const repelConfig = getStructConfig('RepelTower');
          const repelForce = repelConfig.repelForce + (state.hasCheungKong ? repelConfig.repelForceBoost : 0);
          nearest.repelX = (dx / dist) * repelForce;
          nearest.repelZ = (dz / dist) * repelForce;
        }
        updateRepelPulse(t, nearest, dt);
      } else {
        t._hadRepelTarget = false;
        removeTowerBeam(t);
      }
      continue;
    }

    // LaserTower
    if (nearest && t.cooldown <= 0) {
      t.cooldown = getStructConfig(t.type).attackInterval;
      fireProjectile(t);
    }
  }
}

// ==================== TOWER ATTACK VISUALS ====================
function updateFreezeBeam(tower, target, dt) {
  const wx = tower.wx, wz = tower.wz;
  const tx = target.x, tz = target.z;
  const start = new THREE.Vector3(wx, 0.5, wz);
  const end = new THREE.Vector3(tx, 1.0, tz);
  if (end.distanceTo(start) < 0.1) return;

  if (tower._beamGroup) {
    for (const line of tower._beamGroup.children) {
      if (!line.isLine) continue;
      const pos = line.geometry.attributes.position;
      pos.setXYZ(0, start.x, start.y, start.z);
      pos.setXYZ(1, end.x, end.y, end.z);
      pos.needsUpdate = true;
    }
    for (const child of tower._beamGroup.children) {
      if (child.userData?.freezeTube) updateBeamTube(child, start, end);
    }
    tower._freezeTrailTimer = (tower._freezeTrailTimer || 0) - dt;
    const changed = !tower._freezeLastEnd || tower._freezeLastEnd.distanceTo(end) > 0.08;
    if (tower._freezeTrailTimer <= 0) {
      spawnFreezeAfterimage(changed ? (tower._freezeLastStart || start) : start, changed ? (tower._freezeLastEnd || end) : end);
      tower._freezeTrailTimer = 0.08;
    }
    tower._freezeLastStart = start.clone();
    tower._freezeLastEnd = end.clone();
    return;
  }

  const group = new THREE.Group();
  scene.add(group);

  group.add(makeBeamLine(start, end, 0xc8ffff, 1.0, 3));
  group.add(makeBeamLine(start, end, 0x00e5ff, 0.62, 7));
  group.add(makeBeamTube(start, end, 0.055, 0x00e5ff, 0.32));

  tower._freezeLastStart = start.clone();
  tower._freezeLastEnd = end.clone();
  tower._freezeTrailTimer = 0.08;

  tower._beamGroup = group;
}

function makeBeamLine(start, end, color, opacity, lineWidth = 1) {
  const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    linewidth: lineWidth,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
  return new THREE.Line(geom, mat);
}

function makeBeamTube(start, end, radius, color, opacity) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
  const mesh = new THREE.Mesh(unitCylinderGeom, mat);
  mesh.userData.freezeTube = true;
  mesh.userData.radius = radius;
  updateBeamTube(mesh, start, end);
  return mesh;
}

function updateBeamTube(mesh, start, end) {
  const dir = end.clone().sub(start);
  const len = dir.length();
  if (len < 0.1) return;
  mesh.position.copy(start).add(dir.clone().multiplyScalar(0.5));
  const radius = mesh.userData.radius ?? 1;
  mesh.scale.set(radius, len, radius);
  mesh.quaternion.setFromUnitVectors(towerUpVector, dir.normalize());
}

function spawnFreezeAfterimage(start, end) {
  const line = makeBeamLine(start, end, 0x8ff8ff, 0.42, 6);
  scene.add(line);
  effects.push({ mesh: line, mat: line.material, life: 0.75, maxLife: 0.75, geom: line.geometry, _laserBeam: true, _baseOpacity: 0.42 });

  const tube = makeBeamTube(start, end, 0.04, 0x00e5ff, 0.24);
  scene.add(tube);
  effects.push({ mesh: tube, mat: tube.material, life: 0.75, maxLife: 0.75, geom: null, _laserBeam: true, _baseOpacity: 0.24 });
}

function updateRepelPulse(tower, target, dt) {
  tower._repelPulseTimer = (tower._repelPulseTimer || 0) - dt;
  if (tower._repelPulseTimer > 0) return;
  tower._repelPulseTimer = 0.13;

  const start = new THREE.Vector3(tower.wx, 0.5, tower.wz);
  const end = new THREE.Vector3(target.x, 1.0, target.z);
  const dir = end.clone().sub(start);
  const len = dir.length();
  if (len < 0.1) return;
  const dirNorm = dir.normalize();
  const life = 0.42;
  const geom = new THREE.TorusGeometry(0.16, 0.018, 8, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff8a00,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
  const ring = new THREE.Mesh(geom, mat);
  ring.position.copy(start).add(dirNorm.clone().multiplyScalar(0.35));
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirNorm);
  scene.add(ring);
  const speed = len / life;
  effects.push({
    mesh: ring, mat, geom,
    life, maxLife: life,
    _repelRing: true,
    _baseOpacity: 0.82,
    _vx: dirNorm.x * speed,
    _vy: dirNorm.y * speed,
    _vz: dirNorm.z * speed
  });
}

export function removeTowerBeam(tower) {
  if (tower._beamGroup) {
    scene.remove(tower._beamGroup);
    disposeTowerBeam(tower._beamGroup);
    tower._beamGroup = null;
  }
  tower._freezeLastStart = null;
  tower._freezeLastEnd = null;
  tower._repelPulseTimer = 0;
  tower._hadFreezeTarget = false;
  tower._hadRepelTarget = false;
  stopFreezeSound(tower);
}

function disposeTowerBeam(group) {
  group.traverse(child => {
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => { m.dispose(); });
      else child.material.dispose();
    }
    if (child.geometry) child.geometry.dispose();
  });
}

// ==================== POWER UPDATE ====================
export function updatePower() {
  const available = state.powerQuota + state.powerUsed;
  const isOverload = available < 0;

  if (isOverload && !state.powerOutage) {
    state.powerOutage = true;
    for (const t of towers) {
      t.online = false;
      removeTowerBeam(t);
    }
    setStatus('POWER OUTAGE — Build more Power Plants!', '#ff5252');
    clearSmokeParticles();
    document.getElementById('powerOverlay').classList.remove('hidden');
    document.getElementById('powerOverlay').classList.add('active');
    document.getElementById('powerTip').classList.remove('hidden');
    playPowerDownSound();
  } else if (!isOverload && state.powerOutage) {
    state.powerOutage = false;
    for (const t of towers) t.online = !t.constructing;
    setStatus('Power restored!', '#69f0ae');
    document.getElementById('powerOverlay').classList.remove('active');
    document.getElementById('powerOverlay').classList.add('hidden');
    document.getElementById('powerTip').classList.add('hidden');
    playPowerUpSound();
  }

  const fill = document.getElementById('batteryFill');
  const text = document.getElementById('powerText');
  const maxPower = Math.max(state.powerQuota, Math.abs(state.powerUsed), 1);
  const ratio = Math.max(0, Math.min(1, available / maxPower));
  fill.style.width = (ratio * 100) + '%';
  fill.classList.toggle('overload', isOverload);
  fill.classList.toggle('low', !isOverload && ratio < 0.3);
  text.textContent = `${Math.round(available)} / ${state.powerQuota}`;
}

// ==================== BUILDING VISUAL EFFECTS ====================
/** Smoke particles floating upward from building chimneys */
const smokeParticles = [];

function spawnSmokeParticle(wx, wz, buildingY, localPos) {
  const size = 0.06 + Math.random() * 0.07;
  const brightness = 0.85 + Math.random() * 0.15;
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(brightness, brightness, brightness),
    transparent: true,
    opacity: 0.45 + Math.random() * 0.25,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(smokeGeom, mat);
  mesh.scale.setScalar(size);
  mesh.position.set(
    wx + localPos.x + (Math.random() - 0.5) * 0.08,
    buildingY + localPos.y,
    wz + localPos.z + (Math.random() - 0.5) * 0.08
  );
  scene.add(mesh);
  smokeParticles.push({
    mesh, mat,
    baseSize: size,
    vx: (Math.random() - 0.5) * 0.25,
    vy: 0.3 + Math.random() * 0.4,
    vz: (Math.random() - 0.5) * 0.25,
    life: 1.5 + Math.random() * 1.0,
    maxLife: 2.5
  });
}

export function updateBuildings(dt) {
  // ResearchCenter dish rotation
  for (const b of buildings) {
    if (!state.powerOutage && b.mesh.userData.dish) {
      b.mesh.userData.dish.rotation.y += dt * 0.6;
    }
  }

  // Spawn smoke from buildings (skip during construction animation)
  for (const b of buildings) {
    if (b.constructing) continue;
    if (state.powerOutage) continue;
    if (!b.mesh.userData.hasSmoke || !b.mesh.userData.smokePositions) continue;
    if (!b._smokeTimer) b._smokeTimer = 0;
    b._smokeTimer += dt;
    if (b._smokeTimer > 0.12) {
      b._smokeTimer = 0;
      const buildingY = b.mesh.position.y;
      const smokeChance = b.mesh.userData.smokeChance ?? 0.5;
      for (const sp of b.mesh.userData.smokePositions) {
        if (Math.random() < smokeChance) {
          spawnSmokeParticle(b.wx, b.wz, buildingY, sp);
        }
      }
    }
  }

  // Update smoke particles
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const p = smokeParticles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mat.dispose();
      smokeParticles.splice(i, 1);
      continue;
    }
    const ratio = p.life / p.maxLife;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vx *= 0.97;
    p.vy *= 0.98;
    p.vz *= 0.97;
    p.mat.opacity = ratio * 0.5;
    const grow = 0.5 + (1 - ratio) * 1.2;
    p.mesh.scale.setScalar(p.baseSize * grow);
  }
}

export function clearSmokeParticles() {
  for (const p of smokeParticles) {
    scene.remove(p.mesh);
    p.mat.dispose();
  }
  smokeParticles.length = 0;
}
