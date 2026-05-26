import * as THREE from 'three';
import { scene } from '../core/three-setup.js';

// ==================== VISUAL EFFECTS ====================
const effectGeom = new THREE.SphereGeometry(1, 6, 6);
const burstGeom = new THREE.SphereGeometry(1, 4, 4);
const laserGlowGeom = new THREE.CylinderGeometry(0.045, 0.045, 1, 10, 1, true);

export const effects = [];

export function spawnEffect(x, y, z, color, duration) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  const mesh = new THREE.Mesh(effectGeom, mat);
  mesh.scale.setScalar(0.1);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  effects.push({ mesh, mat, geom: effectGeom, life: duration, maxLife: duration, _baseScale: 0.1 });
}

/** Multi-particle burst flying outward from a point */
export function spawnBurst(x, y, z, color, count) {
  const n = count || 8;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = 1.5 + Math.random() * 3;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(burstGeom, mat);
    mesh.scale.setScalar(0.04);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    effects.push({
      mesh, mat, life: 0.5, maxLife: 0.5, geom: burstGeom, _baseScale: 0.04,
      _vx: Math.cos(angle) * speed,
      _vz: Math.sin(angle) * speed,
      _vy: 0.8 + Math.random() * 1.5,
      _burst: true
    });
  }
}

/** Thin glowing beam between two points (for LaserTower) */
export function spawnLaserBeam(x1, y1, z1, x2, y2, z2, color) {
  const start = new THREE.Vector3(x1, y1, z1);
  const end = new THREE.Vector3(x2, y2, z2);
  const dir = end.clone().sub(start);
  const len = dir.length();
  if (len < 0.1) return;
  const cols = color || 0xffeb3b;

  // Core line
  const lineGeom = new THREE.BufferGeometry().setFromPoints([start, end]);
  const lineMat = new THREE.LineBasicMaterial({
    color: cols,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
  const line = new THREE.Line(lineGeom, lineMat);
  scene.add(line);
  effects.push({ mesh: line, mat: lineMat, life: 0.2, maxLife: 0.2, geom: lineGeom, _laserBeam: true, _baseOpacity: 0.95 });

  // Soft beam glow — no dots along the laser.
  const glowMat = new THREE.MeshBasicMaterial({
    color: cols,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
  const glow = new THREE.Mesh(laserGlowGeom, glowMat);
  glow.scale.set(1, len, 1);
  glow.position.copy(start).add(dir.clone().multiplyScalar(0.5));
  glow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  scene.add(glow);
  effects.push({ mesh: glow, mat: glowMat, life: 0.2, maxLife: 0.2, geom: laserGlowGeom, _laserBeam: true, _baseOpacity: 0.28 });
}

/** Spawn muzzle flash at the computed barrel tip position */
export function spawnLaserMuzzle(tower, target) {
  const dx = target.x - tower.wx;
  const dz = target.z - tower.wz;
  const aimDist = Math.sqrt(dx * dx + 0.55 * 0.55 + dz * dz);
  if (aimDist > 0.01) {
    const bx = tower.wx + 0.35 * dx / aimDist;
    const by = 0.45 + 0.35 * 0.55 / aimDist;
    const bz = tower.wz + 0.35 * dz / aimDist;
    spawnEffect(bx, by, bz, 0xffeb3b, 0.15);
    spawnEffect(bx, by, bz, 0xffffff, 0.08);
  }
}

/** Clear all active effects — safe for game restart (preserves shared geometries) */
export function clearEffects() {
  for (const e of effects) {
    scene.remove(e.mesh);
    e.mat.dispose();
    if (e.geom && e.geom !== effectGeom && e.geom !== burstGeom && e.geom !== laserGlowGeom) {
      e.geom.dispose();
    }
  }
  effects.length = 0;
}

export function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    if (e.life <= 0) {
      scene.remove(e.mesh);
      e.mat.dispose();
      if (e.geom && e.geom !== effectGeom && e.geom !== burstGeom && e.geom !== laserGlowGeom) e.geom.dispose();
      effects.splice(i, 1);
      continue;
    }
    const ratio = e.life / e.maxLife;
    e.mat.opacity = (e._baseOpacity ?? 1) * ratio;

    if (e._tornado) {
      // Tree parts fly upward and outward with spin (tornado effect)
      e.mesh.position.x += e._vx * dt;
      e.mesh.position.z += e._vz * dt;
      e.mesh.position.y += e._upSpeed * dt;
      e._upSpeed -= 0.5 * dt; // gravity
      e.mesh.rotation.x += e._spin * dt;
      e.mesh.rotation.z += e._spin * 0.7 * dt;
      e.mesh.scale.setScalar(0.9 + ratio * 0.3);
    } else if (e._explosionFlash) {
      // Smoke flash expands quickly then fades
      e.mesh.scale.setScalar(1 + (1 - ratio) * 3);
    } else if (e._burst) {
      // Burst particles fly outward with gravity
      e.mesh.position.x += e._vx * dt;
      e.mesh.position.z += e._vz * dt;
      e.mesh.position.y += e._vy * dt;
      e._vx *= 0.96;
      e._vz *= 0.96;
      e._vy -= 2.5 * dt;
      e.mesh.scale.setScalar((e._baseScale ?? 1) * (0.8 + (1 - ratio) * 0.6));
      // Building debris tumbles as it flies
      if (e._tumbleX) e.mesh.rotation.x += e._tumbleX * dt;
      if (e._tumbleY) e.mesh.rotation.y += e._tumbleY * dt;
    } else if (e._repelRing) {
      e.mesh.position.x += e._vx * dt;
      e.mesh.position.y += e._vy * dt;
      e.mesh.position.z += e._vz * dt;
      const grow = 0.55 + (1 - ratio) * 1.65;
      e.mesh.scale.set(grow, grow, grow);
    } else if (!e._laserBeam) {
      e.mesh.scale.setScalar((e._baseScale ?? 1) * (1 + (1 - ratio) * 2));
    }
  }
}
