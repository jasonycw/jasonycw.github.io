import * as THREE from 'three';
import { scene } from '../core/three-setup.js';
import { CONFIG } from '../core/config.js';
import { state, getStructConfig } from '../core/state.js';
import { enemies, damageEnemy } from './enemies.js';
import { effects, spawnBurst, spawnEffect, spawnLaserBeam, spawnLaserMuzzle } from './effects.js';
import { playLaserSound } from './audio.js';
import { setStatus } from './ui.js';

export const towers = [];
export const buildings = [];
// Shared unit sphere for beam glow spheres — scales per instance to avoid per-frame geometry allocation
const sharedBeamSphereGeom = new THREE.SphereGeometry(1, 6, 6);
// ==================== TOWER MESHES ====================
export function createTowerMesh(type) {
  const group = new THREE.Group();
  const cfg = getStructConfig(type);

  if (type === 'LaserTower') {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.4 })
    );
    base.position.y = 0.15;
    group.add(base);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x4fc3f7, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.2 })
    );
    barrel.position.y = 0.45;
    group.add(barrel);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.05, 8, 12),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x4fc3f7, emissiveIntensity: 0.2 })
    );
    ring.position.y = 0.3;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    group.userData.turret = barrel;
    group.userData.ring = ring;
  } else if (type === 'FreezeTower') {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.55, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.4 })
    );
    base.position.y = 0.15;
    group.add(base);
    const body = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4),
      new THREE.MeshStandardMaterial({ color: 0x81d4fa, emissive: 0x4fc3f7, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.5 })
    );
    body.position.y = 0.5;
    body.rotation.y = Math.PI / 4;
    group.add(body);
    const iceRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.04, 8, 16),
      new THREE.MeshBasicMaterial({ color: 0xb3e5fc, transparent: true, opacity: 0.7 })
    );
    iceRing.position.y = 0.5;
    iceRing.rotation.x = Math.PI / 2;
    group.add(iceRing);
    group.userData.body = body;
    group.userData.iceRing = iceRing;
  } else if (type === 'RepelTower') {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.65, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.4 })
    );
    base.position.y = 0.15;
    group.add(base);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xff8a65, emissive: 0xff6d00, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.4 })
    );
    dome.position.y = 0.4;
    group.add(dome);
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(0.25 + i * 0.15, 0.03, 8, 16),
        new THREE.MeshBasicMaterial({ color: 0xffab40, transparent: true, opacity: 0.6 - i * 0.15 })
      );
      r.position.y = 0.3 + i * 0.1;
      r.rotation.x = Math.PI / 2 + i * 0.3;
      group.add(r);
      group.userData.rings = group.userData.rings || [];
      group.userData.rings.push(r);
    }
  }

  group.castShadow = true;
  return group;
}

export function createBuildingMesh(type) {
  const group = new THREE.Group();
  const cfg = getStructConfig(type);

  if (type === 'PowerPlant') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.7, metalness: 0.2 })
    );
    body.position.y = 0.25;
    group.add(body);
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.8 })
    );
    chimney.position.set(0.2, 0.55, 0.2);
    group.add(chimney);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x69f0ae })
    );
    glow.position.set(0.2, 0.6, 0.2);
    group.add(glow);
  } else if (type === 'NuclearPlant') {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 0.15, 12),
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.7 })
    );
    base.position.y = 0.075;
    group.add(base);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x43a047, emissive: 0x00e676, emissiveIntensity: 0.15, roughness: 0.4 })
    );
    dome.position.y = 0.7;
    group.add(dome);
  } else if (type === 'University') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.4, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x7e57c2, roughness: 0.6, metalness: 0.2 })
    );
    body.position.y = 0.2;
    group.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 0.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x9575cd, roughness: 0.5 })
    );
    roof.position.y = 0.4;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  } else if (type === 'ResearchCenter') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xab47bc, roughness: 0.5, metalness: 0.3 })
    );
    body.position.y = 0.25;
    group.add(body);
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6),
      new THREE.MeshStandardMaterial({ color: 0xce93d8, emissive: 0xce93d8, emissiveIntensity: 0.3 })
    );
    antenna.position.y = 0.55;
    group.add(antenna);
  } else if (type === 'CheungKong') {
    for (let i = 0; i < 3; i++) {
      const section = new THREE.Mesh(
        new THREE.BoxGeometry(0.5 - i * 0.08, 0.3, 0.5 - i * 0.08),
        new THREE.MeshStandardMaterial({
          color: i === 0 ? 0x37474f : (i === 1 ? 0x455a64 : 0x546e7a),
          roughness: 0.5, metalness: 0.5
        })
      );
      section.position.y = 0.15 + i * 0.3;
      group.add(section);
    }
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffd54f, emissiveIntensity: 0.5 })
    );
    top.position.y = 0.85;
    group.add(top);
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

  spawnLaserMuzzle(tower, target);
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
        const up = new THREE.Vector3(0, 1, 0);
        const targetDir = new THREE.Vector3(dx, 1.0 - 0.45, dz).normalize();
        t.mesh.userData.turret.quaternion.setFromUnitVectors(up, targetDir);
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
        nearest.isSlowed = 2.0;
        nearest.slowFactor = 0.5;
        updateTowerBeam(t, nearest, 0x4fc3f7);
      } else {
        removeTowerBeam(t);
      }
      continue;
    }

    // Repel Tower
    if (t.type === 'RepelTower') {
      if (nearest) {
        const dx = nearest.x - t.wx;
        const dz = nearest.z - t.wz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0) {
          nearest.repelX += (dx / dist) * 8 * dt;
          nearest.repelZ += (dz / dist) * 8 * dt;
        }
        updateTowerBeam(t, nearest, 0xff6d00);
      } else {
        removeTowerBeam(t);
      }
      continue;
    }

    // LaserTower
    if (nearest && t.cooldown <= 0) {
      t.cooldown = getStructConfig(t.type).attackInterval;
      console.log(`TOWER_FIRE: ${t.type} at (${t.wx},${t.wz}) → enemy dist=${Math.sqrt((nearest.x-t.wx)**2+(nearest.z-t.wz)**2).toFixed(1)} hp=${nearest.hp.toFixed(0)}`);
      fireProjectile(t);
    }
  }
}

// ==================== TOWER BEAMS ====================
function updateTowerBeam(tower, target, color) {
  const wx = tower.wx, wz = tower.wz;
  const tx = target.x, tz = target.z;
  const start = new THREE.Vector3(wx, 0.5, wz);
  const end = new THREE.Vector3(tx, 1.0, tz);
  const dir = end.clone().sub(start);
  const len = dir.length();
  if (len < 0.1) return;

  if (tower._beamGroup) {
    // Update existing beam — reposition vertices instead of recreating
    const line = tower._beamGroup.children[0];
    if (line && line.isLine) {
      const pos = line.geometry.attributes.position;
      pos.setXYZ(0, start.x, start.y, start.z);
      pos.setXYZ(1, end.x, end.y, end.z);
      pos.needsUpdate = true;
    }
    // Reposition glow spheres along the updated beam
    for (let i = 0; i < 5; i++) {
      const child = tower._beamGroup.children[i + 1];
      if (!child) break;
      const t = (i + 1) / 6;
      const pos = start.clone().add(dir.clone().multiplyScalar(t));
      child.position.copy(pos);
      // Pulse opacity for visual interest
      child.material.opacity = 0.6 + Math.sin(state.gameTime * 8 + i) * 0.2;
    }
    return;
  }

  // First frame: create beam group once
  const group = new THREE.Group();
  scene.add(group);

  const lineGeom = new THREE.BufferGeometry().setFromPoints([start, end]);
  const lineMat = new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
  });
  group.add(new THREE.Line(lineGeom, lineMat));
  tower._beamLineMat = lineMat;

  for (let i = 0; i < 5; i++) {
    const t = (i + 1) / 6;
    const pos = start.clone().add(dir.clone().multiplyScalar(t));
    const r = 0.04 + t * 0.05;
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.6 + Math.sin(state.gameTime * 8 + i) * 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    });
    const mesh = new THREE.Mesh(sharedBeamSphereGeom, mat);
    mesh.scale.setScalar(r);
    mesh.position.copy(pos);
    group.add(mesh);
  }

  tower._beamGroup = group;
}

export function removeTowerBeam(tower) {
  if (tower._beamGroup) {
    scene.remove(tower._beamGroup);
    disposeTowerBeam(tower._beamGroup);
    tower._beamGroup = null;
  }
}

function disposeTowerBeam(group) {
  group.traverse(child => {
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => { m.dispose(); });
      else child.material.dispose();
    }
    if (child.geometry && child.geometry !== sharedBeamSphereGeom) child.geometry.dispose();
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
  } else if (!isOverload && state.powerOutage) {
    state.powerOutage = false;
    for (const t of towers) t.online = true;
    setStatus('Power restored!', '#69f0ae');
  }

  const fill = document.getElementById('batteryFill');
  const text = document.getElementById('powerText');
  const maxPower = Math.max(state.powerQuota, Math.abs(state.powerUsed), 1);
  const ratio = Math.max(0, Math.min(1, available / maxPower));
  fill.style.height = (ratio * 100) + '%';
  fill.classList.toggle('overload', isOverload);
  fill.classList.toggle('low', !isOverload && ratio < 0.3);
  text.textContent = `${Math.round(available)} / ${state.powerQuota}`;
}
